/** Headless, seeded industrial logistics simulation. No React or DOM dependencies. */
import type { Charter, NetworkMetrics } from "@/shared/types";
import { COMMODITIES, RAW_MATERIALS, RECIPES, emptyStock, type Commodity, type CompanyKind, type FreightContract, type RawMaterial, type Stock } from "@/shared/factory";
import { CONFIG } from "./config";
import { Ground, Terrain, type SegmentSurvey } from "./terrain";
import { type Pt } from "./projection";
import { Rng } from "./rng";
import { generateWorld } from "./world";
import { findGridPath, samePoint, pointOnRoute, snapPoint } from "./grid";

export interface FactoryNode {
  index: number; name: string; realName: string; pos: Pt; type: "hub" | "company" | "transfer";
  material?: RawMaterial; companyKind?: CompanyKind; stock: Stock; progress: number;
  produced: number; working: boolean; collection: number; rotation?: number; paidCost?: number;
}
export interface Deposit { id: number; kind: RawMaterial; pos: Pt; remaining: number; hub: number | null; forest?: boolean }
export interface Crate { good: Commodity; destination: number; born: number; transfers: number }
export interface FreightTrain { id: number; seg: number; t: number; dir: 1 | -1; cargo: Crate[]; dwell: number; started: boolean; visits?: Record<number,number> }
export interface FreightSegment { a: number; b: number; survey: SegmentSurvey; crossings: ("bridge" | "tunnel")[]; cost: number; path?: Pt[] | undefined; waterPath?: Pt[] }
export interface FreightLine { id: number; name: string; stops: number[]; segments: FreightSegment[]; trains: FreightTrain[]; carriages: number; type: "rail" | "tube" | "boat" }
export interface BuildPlan { ok: boolean; error?: string | undefined; cost?: number; survey?: SegmentSurvey; crossings?: ("bridge" | "tunnel")[]; from?: number | undefined; path?: Pt[] | undefined }
export interface FactoryEvent { type: "deliver" | "week" | "complete" | "contract"; week?: number; title?: string; station?: number }
export interface Upgrade { id: string; label: string; description: string; apply: () => void }
export type GiftKind = "collectors" | "track" | "locomotives" | "carriages" | "bridges" | "tunnels" | "boats" | "tubes";
const emptyGifts = (): Record<GiftKind, number> => ({collectors:0,track:0,locomotives:0,carriages:0,bridges:0,tunnels:0,boats:0,tubes:0});
const F = CONFIG.factory;
export class FactoryGame {
  readonly rng: Rng; readonly terrain: Terrain; readonly proj; readonly world;
  readonly stations: FactoryNode[]; readonly resources: Deposit[] = [];
  readonly lines: FreightLine[] = [];
  readonly inv: Charter["start"];
  boats = 0;
  private purchasedTrainCosts:number[]=[];
  readonly gifts = emptyGifts();
  private giftLoss = emptyGifts();
  credits = F.startingCredits; hubsAvailable = F.startingHubs;
  time = 0; week = 1; weekTime = 0; phase: "running" | "picking" | "complete" = "running";
  offers: Upgrade[] = []; contracts: FreightContract[] = [];
  delivered = 0; products = 0; revenue = 0; trackUsed = 0;
  contractsCompleted = 0; contractsMissed = 0;
  private orderAllocated = new Map<string, number>(); private orderStock = new Map<string, number>();
  private history: { snapshot: string; spent: number; lossBase: number; gifts: Record<GiftKind, number> }[] = [];
  private undoLoss = 0;
  private contractClock = 0; private nextContract = 1; private nextTrain = 1;
  private tripSum = 0; private transferSum = 0;
  private listeners = new Set<(e: FactoryEvent) => void>();
  constructor(readonly charter: Charter, seed: number) {
    this.rng = new Rng(seed); this.world = generateWorld(seed, charter.slug); this.proj = this.world.projection;
    this.terrain = new Terrain({ ...this.world.geography, water: [], woods: [] }, this.proj, F.worldWidth, F.worldHeight);
    // Rasterise from the continuous fields directly; painting huge contour rings cell by cell is far too slow.
    { const cell = CONFIG.terrain.cell, t = this.terrain; for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.cols; c++) { const x=(c+.5)*cell,y=(r+.5)*cell; t.ground[r*t.cols+c] = this.world.isWater(x,y) ? Ground.Water : this.world.isForest(x,y) ? Ground.Woods : Ground.Land; } }
    this.inv = { ...charter.start, track: Math.max(charter.start.track, F.startingTrack), locomotives: F.startingLocomotives, bridges: 0, tunnels: 0 };
    const kinds: CompanyKind[] = ["foundry", "sawmill", "works", "exporter"];
    this.stations = [];
    charter.districts.forEach((d, index) => {
      const companyKind = kinds[index % kinds.length] ?? "foundry";
      this.stations.push({ index, name: `${RECIPES[companyKind].label} ${Math.floor(index/4)+1}`, realName: RECIPES[companyKind].label,
        pos: this.gridLand(this.spiralPoint(index, charter.districts.length)), type: "company", companyKind,
        stock: emptyStock(), progress: 0, produced: 0, working: false, collection: 0 });
    });
    for (let i = 0; i < 5; i++) this.lines.push({ id: i, name: `Freight ${i + 1}`, stops: [], segments: [], trains: [], carriages: 0, type: "rail" });
    for (const kind of RAW_MATERIALS) for (let n = 0; n < F.depositsPerKind; n++) this.spawnDeposit(kind, n);
    this.issueContract();
  }
  /** Spawning stays inside a circle around the map centre that widens every week. */
  get frontier() { return { center: [F.worldWidth/2, F.worldHeight/2] as Pt, radius: Math.min(Math.hypot(F.worldWidth, F.worldHeight)/2, F.frontierStart + (this.week-1)*F.frontierGrowth) }; }
  inFrontier(p: Pt, margin = 0) { const f=this.frontier; return Math.hypot(p[0]-f.center[0],p[1]-f.center[1]) <= f.radius - margin; }
  private spiralPoint(i: number, n: number): Pt { const f=this.frontier, r=(f.radius-F.buildingHalfWidth*2)*Math.sqrt((i+.5)/Math.max(1,n)), a=i*2.39996; return [f.center[0]+Math.cos(a)*r, f.center[1]+Math.sin(a)*r]; }
  private expandFrontier() {
    const kinds: CompanyKind[] = ["foundry", "sawmill", "works", "exporter"], f=this.frontier, inner=f.radius-F.frontierGrowth;
    for (let k=0;k<F.weeklyCompanies;k++) {
      const index=this.stations.length, kind=kinds[(this.companies.length)%kinds.length] ?? "foundry";
      let spot: Pt | null = null;
      for (let attempt=0;attempt<80&&!spot;attempt++) { const a=this.rng.next()*Math.PI*2, r=inner+(f.radius-inner)*(.25+.5*this.rng.next()); const q=snapPoint([f.center[0]+Math.cos(a)*r,f.center[1]+Math.sin(a)*r]);
        if (this.terrain.inBounds(q[0]-F.portReach,q[1]-F.portReach)&&this.terrain.inBounds(q[0]+F.portReach,q[1]+F.portReach)&&this.inFrontier(q,F.buildingHalfWidth)&&this.facilityGround(q)&&!this.stations.some(s=>Math.abs(s.pos[0]-q[0])<F.companySpacing&&Math.abs(s.pos[1]-q[1])<F.companySpacing)&&!this.lines.some(l=>l.segments.some(seg=>(seg.path??[]).some(p=>Math.abs(p[0]-q[0])<F.companySpacing/2&&Math.abs(p[1]-q[1])<F.companySpacing/2)))) spot=q; }
      if (!spot) continue;
      const node: FactoryNode = { index, name: `${RECIPES[kind].label} ${this.companies.filter(c=>c.companyKind===kind).length+1}`, realName: RECIPES[kind].label, pos: spot, type: "company", companyKind: kind, stock: emptyStock(), progress: 0, produced: 0, working: false, collection: 0 };
      this.stations.push(node);
      for (const raw of RAW_MATERIALS) if (RECIPES[kind].inputs[raw]) this.spawnDeposit(raw, 0, node);
    }
    for (const raw of RAW_MATERIALS) { const near=this.companies.filter(c=>c.companyKind&&RECIPES[c.companyKind].inputs[raw]&&Math.hypot(c.pos[0]-f.center[0],c.pos[1]-f.center[1])>inner-F.companySpacing); const anchor=near[this.rng.int(Math.max(1,near.length))]; if (anchor) this.spawnDeposit(raw, 0, anchor); }
  }
  /** Nearest forest point within collection range, if any. */
  forestNear(p: Pt): Pt | null { let best: Pt | null = null, d = Infinity; for (let dy = -F.collectionRadius; dy <= F.collectionRadius; dy += F.grid) for (let dx = -F.collectionRadius; dx <= F.collectionRadius; dx += F.grid) { const q: Pt = [p[0]+dx, p[1]+dy], h = Math.hypot(dx, dy); if (h <= F.collectionRadius && h < d && this.world.isForest(...q) && !this.world.isWater(...q) && !this.world.isMountain(...q)) { best = q; d = h; } } return best; }
  private gridLand(p: Pt): Pt {
    const seek=(origin:Pt):Pt|null=>{const base=snapPoint(this.terrain.nearestLand(origin));
      for(let radius=0;radius<Math.ceil(F.worldWidth/F.grid);radius++) for(let x=-radius;x<=radius;x++) for(let y=-radius;y<=radius;y++) {
        const q:Pt=[base[0]+x*F.grid,base[1]+y*F.grid];
        if(this.terrain.inBounds(q[0]-F.portReach,q[1]-F.portReach)&&this.terrain.inBounds(q[0]+F.portReach,q[1]+F.portReach)&&this.inFrontier(q,F.buildingHalfWidth)&&this.facilityGround(q)&&!this.stations.some(s=>Math.abs(s.pos[0]-q[0])<F.companySpacing&&Math.abs(s.pos[1]-q[1])<F.companySpacing))return q;
      }
      return null;};
    // Facilities must stay inside the surveyed frontier; fall back to its centre when the spiral point lands outside.
    return seek(p)??seek(this.frontier.center)??snapPoint(this.terrain.nearestLand(p));
  }
  portCapacity(s:FactoryNode,side:"input"|"output") { return s.type==="transfer"?F.transferPorts:s.type==="hub"?(side==="input"?F.hubInputPorts:F.hubOutputPorts):(side==="input"?Object.keys(RECIPES[s.companyKind??"foundry"].inputs).length*F.inputPorts:(RECIPES[s.companyKind??"foundry"].output?F.outputPorts:0)); }
  portUsage(index:number,side:"input"|"output") { return this.lines.reduce((n,l)=>n+l.segments.filter(seg=>side==="input"?seg.b===index:seg.a===index).length,0); }
  portPosition(index:number,side:"input"|"output",slot:number):Pt { const s=this.stations[index];if(!s)return[0,0];const count=this.portCapacity(s,side);const x=side==="input"?-F.portReach:F.portReach,y=(slot-Math.floor(count/2))*F.portSpacing;const r=s.rotation??0;const offsets:Pt[]=[[x,y],[-y,x],[-x,-y],[y,-x]];const offset=offsets[r%4]??[x,y];return[s.pos[0]+offset[0],s.pos[1]+offset[1]]; }
  portOccupied(index:number,side:"input"|"output",slot:number):boolean {const pos=this.portPosition(index,side,slot);return this.lines.some(l=>l.segments.some(seg=>{const p=side==="input"?seg.path?.at(-1):seg.path?.[0];return (side==="input"?seg.b===index:seg.a===index)&&p?.[0]===pos[0]&&p?.[1]===pos[1];}));}
  firstFreePort(index:number,side:"input"|"output") {const node=this.stations[index];if(!node)return -1;for(let i=0;i<this.portCapacity(node,side);i++)if(!this.portOccupied(index,side,i))return i;return -1;}
  portAt(p:Pt,side:"input"|"output",radius=F.portSnapRadius) {let nearest:{index:number;slot:number}|null=null,best=radius;for(const s of this.stations)for(let slot=0;slot<this.portCapacity(s,side);slot++){if(this.portOccupied(s.index,side,slot))continue;const pos=this.portPosition(s.index,side,slot),distance=Math.hypot(p[0]-pos[0],p[1]-pos[1]);if(distance<best){best=distance;nearest={index:s.index,slot};}}return nearest;}
  private facilityGround(p:Pt) {return [-F.buildingHalfWidth,0,F.buildingHalfWidth].every(dx=>[-F.buildingHalfWidth,0,F.buildingHalfWidth].every(dy=>!this.terrain.isWater(p[0]+dx,p[1]+dy)&&!this.world.isMountain(p[0]+dx,p[1]+dy)));}
  terrainBlocked(p:Pt, crossing?:"bridge"|"tunnel") {return (this.terrain.isWater(...p)&&crossing!=="bridge")||(this.world.isMountain(...p)&&crossing!=="tunnel");}
  routeCellBlocked(p:Pt,crossing?:"bridge"|"tunnel") {return this.trackBlocked(p)||[-F.grid/2,-F.grid/4,0,F.grid/4,F.grid/2].some(offset=>this.terrainBlocked([p[0]+offset,p[1]],crossing)||this.terrainBlocked([p[0],p[1]+offset],crossing));}

  trackBlocked(p:Pt) {return p[0]<F.grid||p[1]<F.grid||p[0]>F.worldWidth-F.grid||p[1]>F.worldHeight-F.grid||this.stations.some(s=>Math.abs(s.pos[0]-p[0])<F.buildingHalfWidth+F.buildingClearance&&Math.abs(s.pos[1]-p[1])<F.buildingHalfWidth+F.buildingClearance);}
  segmentPath(a:number,b:number,_lineId:number,crossing?:"bridge"|"tunnel"):Pt[] {
    const A=this.stations[a],B=this.stations[b];if(!A||!B)return[];
    let best:Pt[]=[];
    for(let output=0;output<this.portCapacity(A,"output");output++)for(let input=0;input<this.portCapacity(B,"input");input++) {
      if(this.portOccupied(a,"output",output)||this.portOccupied(b,"input",input))continue;
      const start=this.portPosition(a,"output",output),end=this.portPosition(b,"input",input);
      if(this.routeCellBlocked(start,crossing)||this.routeCellBlocked(end,crossing))continue;
      const path=findGridPath(start,end,p=>this.routeCellBlocked(p,crossing));
      if(path.length&&(!best.length||path.length<best.length))best=path;
    }
    return best;
  }
  private pathError(path:Pt[],from:number,to:number):string|null {
    if(path.length<2)return "Draw track between a green output and a blue input dot.";
    const starts=Array.from({length:this.portCapacity(this.stations[from] as FactoryNode,"output")},(_,i)=>i).some(i=>!this.portOccupied(from,"output",i)&&samePoint(this.portPosition(from,"output",i),path[0] as Pt));
    const ends=Array.from({length:this.portCapacity(this.stations[to] as FactoryNode,"input")},(_,i)=>i).some(i=>!this.portOccupied(to,"input",i)&&samePoint(this.portPosition(to,"input",i),path.at(-1) as Pt));
    if(!starts||!ends)return "Use free output and input dots.";
    for(let i=0;i<path.length;i++){const p=path[i],prev=path[i-1];if(!p)continue;if(!samePoint(p,snapPoint(p)))return "Tracks must follow grid intersections.";if(this.trackBlocked(p))return "Track cannot pass through a factory.";if(prev&&Math.abs(p[0]-prev[0])+Math.abs(p[1]-prev[1])!==F.grid)return "Lay track one grid cell at a time.";}
    return null;
  }
  connect(id:number,from:number,to:number,path?:Pt[],crossing?:"bridge"|"tunnel"):BuildPlan {
    const l=this.lines[id];if(!l)return{ok:false,error:"Choose a route."};
    if(!l.stops.length){const first=this.extend(id,from);if(!first.ok)return first;const result=this.extend(id,to,path,from,crossing);if(!result.ok)l.stops=[];return result;}
    if(!l.stops.includes(from)&&l.stops.includes(to))return this.extend(id,to,path,from,crossing,true);
    if(!l.stops.includes(from))return{ok:false,error:"Start at a building connected to this route."};
    return this.extend(id,to,path,from,crossing);
  }
  on(fn: (e: FactoryEvent) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit(e: FactoryEvent) { for (const fn of this.listeners) fn(e); }
  get companies() { return this.stations.filter(s => s.type === "company"); }
  get hubs() { return this.stations.filter(s => s.type === "hub"); }
  get activeStations() { return this.stations; }
  get hourOfDay() { return (6 + this.time / CONFIG.day.seconds * 24) % 24; }
  railLines() { return this.lines.filter(l => l.type === "rail"); }
  stationAt(x: number, y: number) { return this.stations.findIndex(s => Math.hypot(s.pos[0] - x, s.pos[1] - y) < Math.max(CONFIG.station.pickRadius,38)); }
  capacity(s: FactoryNode) { return s.type !== "company" ? F.hubCapacity : F.companyCapacity; }
  trainCapacity(l: FreightLine) { return l.type === "boat" ? F.boatCapacity : l.type === "tube" ? CONFIG.train.tubeCapacity : CONFIG.train.baseCapacity + l.carriages * CONFIG.train.perCarriage; }
  private spawnDeposit(kind: RawMaterial, n: number, preferred?: FactoryNode) {
    const eligible = this.companies.filter(s => s.companyKind && RECIPES[s.companyKind].inputs[kind]);
    const anchor = preferred ?? eligible[n % eligible.length] ?? this.companies[n % this.companies.length];
    if (!anchor) return;
    for (let attempt = 0; attempt < 300; attempt++) {
      const angle = this.rng.next() * Math.PI * 2, distance = 120 + this.rng.next() * 72;
      const p: Pt = snapPoint([anchor.pos[0] + Math.cos(angle) * distance, anchor.pos[1] + Math.sin(angle) * distance]);
      if (!this.terrain.inBounds(...p) || !this.inFrontier(p) || !this.facilityGround(p)) continue;
      if (this.stations.some(s => Math.abs(s.pos[0]-p[0])<F.buildingHalfWidth*2+F.placementGap&&Math.abs(s.pos[1]-p[1])<F.buildingHalfWidth*2+F.placementGap) || this.resources.some(r => Math.abs(r.pos[0]-p[0]) < F.patchCells*F.grid && Math.abs(r.pos[1]-p[1]) < F.patchCells*F.grid)) continue;
      this.resources.push({ id: this.resources.length, kind, pos: p, remaining: F.depositStock, hub: null }); return;
    }
    // Deterministic land-cell fallback keeps every material available on narrow maps.
    const b = this.terrain.bounds;
    for (let y = Math.ceil((b.y0+F.portReach)/F.grid)*F.grid; y < b.y1-F.portReach; y += F.grid) for (let x = Math.ceil((b.x0+F.portReach)/F.grid)*F.grid; x < b.x1-F.portReach; x += F.grid) {
      if (!this.inFrontier([x,y]) || !this.facilityGround([x,y]) || this.resources.some(r => Math.abs(r.pos[0]-x)<F.patchCells*F.grid && Math.abs(r.pos[1]-y)<F.patchCells*F.grid) || this.stations.some(s => Math.abs(s.pos[0]-x)<F.buildingHalfWidth*2+F.placementGap&&Math.abs(s.pos[1]-y)<F.buildingHalfWidth*2+F.placementGap)) continue;
      this.resources.push({ id: this.resources.length, kind, pos: [x, y], remaining: F.depositStock, hub: null }); return;
    }
  }
  planHub(kind: RawMaterial | "transfer", pos: Pt): string | null {
    pos=snapPoint(pos);
    if (this.phase === "complete") return "This charter is complete.";
    if (!this.terrain.inBounds(...pos) || !this.facilityGround(pos)) return "Facilities need dry ground inside the map.";
    if (!this.inFrontier(pos)) return "That land is not surveyed yet; the frontier widens each week.";
    if (this.stations.some(s => Math.abs(s.pos[0]-pos[0])<F.buildingHalfWidth*2+F.placementGap&&Math.abs(s.pos[1]-pos[1])<F.buildingHalfWidth*2+F.placementGap)) return "Leave more room between facilities.";
    if (this.lines.some(l=>l.segments.some(seg=>(seg.path??[]).some(p=>Math.abs(p[0]-pos[0])<F.buildingHalfWidth+F.buildingClearance&&Math.abs(p[1]-pos[1])<F.buildingHalfWidth+F.buildingClearance)))) return "A facility cannot cover existing track.";
    if (kind !== "transfer" && this.hubsAvailable <= 0) return "No collection facilities available; request more next week.";
    if (this.credits < this.facilityCost(kind)) return "Not enough credits for a facility.";
    if (kind === "transfer" || (kind === "timber" && this.forestNear(pos))) return null;
    if (!this.resources.some(r => r.kind === kind && r.hub === null && r.remaining > 0 && Math.hypot(r.pos[0] - pos[0], r.pos[1] - pos[1]) <= F.collectionRadius)) return "No unclaimed matching deposit within collection range.";
    return null;
  }
  placeHub(kind: RawMaterial | "transfer", pos: Pt): string | null {
    pos=snapPoint(pos);
    const error = this.planHub(kind, pos); if (error) return error;
    const index = this.stations.length;
    if(kind === "transfer") {this.stations.push({index,name:`Transfer Station ${this.stations.filter(s=>s.type==="transfer").length+1}`,realName:"Transfer station",pos:[...pos],type:"transfer",stock:emptyStock(),progress:0,produced:0,working:false,collection:0,paidCost:F.transferCost});this.credits-=F.transferCost;return null;}
    this.stations.push({ index, name: `${kind === "timber" ? "Logging" : kind === "iron" ? "Iron" : "Coal"} Hub ${this.hubs.length + 1}`, realName: "Collection facility", pos: [...pos], type: "hub", material: kind, stock: emptyStock(), progress: 0, produced: 0, working: false, collection: 0, paidCost:this.facilityCost(kind) });
    this.credits -= this.facilityCost(kind); this.spendSupply("collectors",1);
    for (const r of this.resources) if (r.kind === kind && r.hub === null && Math.hypot(r.pos[0] - pos[0], r.pos[1] - pos[1]) <= F.collectionRadius) r.hub = index;
    // Every forest is a timber resource: a collector on green ground harvests the woods around it.
    if (kind === "timber" && !this.resources.some(r => r.hub === index)) { const spot = this.forestNear(pos); if (spot) this.resources.push({ id: this.resources.length, kind, pos: spot, remaining: F.depositStock, hub: index, forest: true }); }
    return null;
  }
  facilityCost(kind: RawMaterial | "transfer") { return kind === "transfer" ? F.transferCost : this.gifts.collectors > 0 ? 0 : F.hubCost; }
  buildingPaidCost(index:number) {const node=this.stations[index];return !node||node.type==="company"?0:node.paidCost??(node.type==="transfer"?F.transferCost:F.hubCost);}
  collectorRefund(index:number) { const node=this.stations[index];return node&&node.type!=="company"?Math.floor(this.buildingPaidCost(index)*F.undoRefundRate):0; }
  removeBuilding(index:number):string|null {return this.removeCollector(index,true);}
  removeCollector(index:number,includeTransfer=false):string|null {
    const node=this.stations[index];
    if(!node||(node.type!=="hub"&&!(includeTransfer&&node.type==="transfer")))return "Select a collection building first.";
    if(this.phase==="complete")return "This charter is complete.";
    if(this.lines.some(l=>l.segments.some(seg=>seg.a===index||seg.b===index)))return "Disconnect transport links before removing this collector.";
    const refund=this.collectorRefund(index);
    this.credits+=refund;
    if(node.type==="hub"&&this.buildingPaidCost(index)>0)this.hubsAvailable++;
    // Compact the station array and remap every reference, preserving unrelated routes and orders.
    const remap=(id:number)=>id>index?id-1:id;
    this.stations.splice(index,1);this.stations.forEach((s,i)=>{s.index=i;});
    for(const r of this.resources)if(r.hub!==null)r.hub=r.hub===index?null:remap(r.hub);
    for(const l of this.lines){l.stops=l.stops.filter(id=>id!==index).map(remap);for(const seg of l.segments){seg.a=remap(seg.a);seg.b=remap(seg.b);}for(const t of l.trains){t.cargo=t.cargo.filter(c=>c.destination!==index);for(const c of t.cargo)c.destination=remap(c.destination);if(t.visits)t.visits=Object.fromEntries(Object.entries(t.visits).filter(([id])=>Number(id)!==index).map(([id,n])=>[remap(Number(id)),n]));}}
    for(const c of this.contracts)c.company=remap(c.company);
    const remapOrders=(map:Map<string,number>)=>new Map([...map].filter(([key])=>Number(key.split(':')[0])!==index).map(([key,n])=>{const [id,good]=key.split(':');return [`${remap(Number(id))}:${good}`,n] as [string,number];}));
    this.orderAllocated=remapOrders(this.orderAllocated);this.orderStock=remapOrders(this.orderStock);
    return null;
  }
  private spendSupply(kind: GiftKind, quantity: number) {
    this.gifts[kind] = Math.max(0,this.gifts[kind]-quantity);
    if(kind === "collectors") this.hubsAvailable -= quantity;
    else if(kind === "boats") this.boats -= quantity;
    else this.inv[kind] -= quantity;
  }
  private grantGift(kind: GiftKind, quantity: number) {
    this.gifts[kind] += quantity;
    if(kind === "collectors") this.hubsAvailable += quantity;
    else if(kind === "boats") this.boats += quantity;
    else this.inv[kind] += quantity;
  }
  planExtend(lineId: number, idx: number, drawnPath?:Pt[], source?:number,crossing?:"bridge"|"tunnel", prepend=false): BuildPlan {
    const l = this.lines[lineId], s = this.stations[idx];
    if (!l || !s || this.phase === "complete") return { ok: false, error: "Choose a facility and an active freight line." };
    if (l.type !== "rail") return { ok: false, error: "Pneumatic links have two endpoints." };
    if (l.stops.includes(idx) && !prepend) return { ok: false, error: "This facility is already on the line." };
    if (!l.stops.length) return { ok: true, cost: 0 };
    if (l.stops.length === 1 && this.inv.locomotives < 1) return { ok: false, error: "No spare locomotive." };
    const from = source ?? l.stops[l.stops.length - 1], a = from === undefined ? undefined : this.stations[from];
    if (!a) return { ok: false, error: "Missing line endpoint." };
    if(prepend ? !l.stops.includes(idx)||l.stops.includes(a.index)||l.segments.some(seg=>seg.b===idx) : !l.stops.includes(a.index)||l.segments.some(seg=>seg.a===a.index))return{ok:false,error:"Extend from an end of the line; do not split it."};
    if(this.portUsage(a.index,"output")>=this.portCapacity(a,"output"))return{ok:false,error:"All output ports are occupied."};
    if(this.portUsage(s.index,"input")>=this.portCapacity(s,"input"))return{ok:false,error:"All input ports are occupied."};
    const path=drawnPath??this.segmentPath(a.index,s.index,lineId,crossing);
    const error=this.pathError(path,a.index,s.index);if(error)return {ok:false,error};
    if(path.some(p=>this.routeCellBlocked(p,crossing)))return{ok:false,error:"Normal rails must go around water and mountains. Select a crossing tool first."};
    const parts=path.slice(1).map((p,i)=>this.terrain.survey(path[i]??a.pos,p));
    const survey:SegmentSurvey={length:0,cost:0,grade:0,waterRuns:[],mix:{land:0,woods:0,wetland:0,park:0,water:0}};
    let previousWet=false;
    for(let i=0;i<parts.length;i++){const part=parts[i],a=path[i],b=path[i+1];if(!part||!a||!b)continue;survey.length+=part.length;survey.cost+=part.cost;survey.grade=Math.max(survey.grade,part.grade);const startsWet=this.terrain.isWater(a[0]+(b[0]-a[0])*.01,a[1]+(b[1]-a[1])*.01);for(let j=0;j<part.waterRuns.length;j++){const run=part.waterRuns[j]??0;if(j===0&&startsWet&&previousWet&&survey.waterRuns.length){const last=survey.waterRuns.length-1;survey.waterRuns[last]=(survey.waterRuns[last]??0)+run;}else survey.waterRuns.push(run);}previousWet=this.terrain.isWater(a[0]+(b[0]-a[0])*.99,a[1]+(b[1]-a[1])*.99);for(const key of Object.keys(survey.mix) as (keyof typeof survey.mix)[])survey.mix[key]+=part.mix[key];}
    const crossings: ("bridge" | "tunnel")[] = [];
    let bridges = this.inv.bridges, tunnels = this.inv.tunnels;
    for (const span of survey.waterRuns) {
      if (crossing === "bridge" && span <= F.bridgeSpan && bridges > 0) { bridges--; crossings.push("bridge"); }
      else return { ok: false, error: "Water needs an unlocked bridge; use boats for wide crossings.", survey, from };
    }
    let mountain=false;
    for(const p of path){const next=this.world.isMountain(...p);if(next&&!mountain){if(crossing!=="tunnel"||tunnels<1)return{ok:false,error:"Mountains need a tunnel from weekly upgrades.",survey,from};tunnels--;crossings.push("tunnel");}mountain=next;}
    const cost = Math.round(survey.cost + survey.waterRuns.reduce((sum, span, i) => sum + span * ((crossings[i] === "bridge" ? CONFIG.crossing.bridgeTrackMult : CONFIG.crossing.tunnelTrackMult) - 1), 0));
    return { ok: cost <= this.inv.track, error: cost > this.inv.track ? `Needs ${cost} rails; only ${Math.round(this.inv.track)} remain.` : undefined, cost, survey, crossings, from, path };
  }
  extend(id: number, idx: number, path?:Pt[], source?:number,crossing?:"bridge"|"tunnel",prepend=false): BuildPlan {
    const p = this.planExtend(id, idx, path, source,crossing,prepend), l = this.lines[id]; if (!p.ok || !l) return p;
    if (!l.stops.length) { l.stops.push(idx); return p; }
    if (p.from === undefined || !p.survey || !p.crossings || p.cost === undefined) return { ok: false, error: "Incomplete survey." };
    l.segments.push({ a: p.from, b: idx, survey: p.survey, crossings: p.crossings, cost: p.cost, path:p.path }); if(prepend)l.stops.unshift(p.from);else l.stops.push(idx);
    this.spendSupply("track",p.cost); this.trackUsed += p.cost;
    for (const c of p.crossings) this.spendSupply(c === "bridge" ? "bridges" : "tunnels",1);
    if (l.segments.length === 1 && !l.trains.length) { this.spendSupply("locomotives",1); l.trains.push(this.newTrain()); }
    return p;
  }
  private newTrain(): FreightTrain { return { id: this.nextTrain++, seg: 0, t: 0, dir: 1, cargo: [], dwell: 0, started: false }; }
  addTrain(id: number): string | null { const l = this.lines[id]; if (!l || l.stops.length < 2 || this.inv.locomotives < 1 || l.type !== "rail") return "A built rail line and spare locomotive are required."; this.spendSupply("locomotives",1); l.trains.push(this.newTrain()); return null; }
  addCarriage(id: number): string | null { const l = this.lines[id]; if (!l || l.stops.length < 2 || this.inv.carriages < 1 || l.type !== "rail") return "A built rail line and spare carriage are required."; this.spendSupply("carriages",1); l.carriages++; return null; }
  buyTrain():string|null {if(this.phase==="complete")return "This charter is complete.";if(this.credits<F.locomotiveCost)return "Not enough credits for a train.";this.credits-=F.locomotiveCost;this.inv.locomotives++;this.purchasedTrainCosts.push(F.locomotiveCost);return null;}
  get trainSale() {const spent=this.purchasedTrainCosts.at(-1);return spent!==undefined&&this.inv.locomotives>this.gifts.locomotives?{spent,refund:Math.floor(spent*F.undoRefundRate)}:null;}
  sellTrain():string|null {if(this.phase==="complete")return "This charter is complete.";const sale=this.trainSale;if(!sale)return "Return a purchased train to your supplies before selling it.";this.purchasedTrainCosts.pop();this.inv.locomotives--;this.credits+=sale.refund;return null;}
  removeTrain(id:number):string|null {const l=this.lines[id];if(!l||l.type!=="rail"||!l.trains.length)return "No train to remove.";const tr=l.trains.pop();if(!tr)return "No train to remove.";const edge=l.segments[tr.seg],node=edge?this.stations[tr.dir===1?edge.a:edge.b]:undefined;if(node)for(const crate of tr.cargo)node.stock[crate.good]++;this.inv.locomotives++;return null;}
  removeCarriage(id:number):string|null {const l=this.lines[id];if(!l||l.type!=="rail"||l.carriages<1)return "No carriage to remove.";l.carriages--;this.inv.carriages++;for(const tr of l.trains){const edge=l.segments[tr.seg],node=edge?this.stations[tr.dir===1?edge.a:edge.b]:undefined;if(node)for(const crate of tr.cargo.splice(this.trainCapacity(l)))node.stock[crate.good]++;}return null;}
  clearLine(id: number) {
    const l = this.lines[id]; if (!l) return;
    for (const seg of l.segments) { this.inv.track += seg.cost; this.trackUsed -= seg.cost; for (const c of seg.crossings) this.inv[c === "bridge" ? "bridges" : "tunnels"]++; }
    for (const t of l.trains) { const node = this.stations[l.stops[t.seg] ?? -1]; if (node) for (const crate of t.cargo) node.stock[crate.good]++; }
    if (l.type === "rail") this.inv.locomotives += l.trains.length; else if (l.stops.length) {if(l.type==="boat")this.boats++;else this.inv.tubes++;}
    this.inv.carriages += l.carriages; l.stops = []; l.segments = []; l.trains = []; l.carriages = 0;
  }
  undoLast(id: number) { const l=this.lines[id];if(!l)return;const seg=l.segments.pop();l.stops.pop();if(!seg)return;this.inv.track+=seg.cost;this.trackUsed-=seg.cost;for(const c of seg.crossings)this.inv[c==="bridge"?"bridges":"tunnels"]++;if(l.segments.length===0){this.inv.locomotives+=l.trains.length;l.trains=[];}else for(const t of l.trains){t.seg=0;t.t=0;t.dir=1;t.started=false;const node=this.stations[l.stops[0]??-1];if(node)for(const crate of t.cargo)node.stock[crate.good]++;t.cargo=[];} }
  buildTube(a: number, b: number): BuildPlan {
    const A = this.stations[a], B = this.stations[b];
    if (!A || !B || a === b || this.inv.tubes < 1) return { ok: false, error: "Pick two facilities with a pneumatic link in stores." };
    if (this.lines.some(l => l.type === "tube" && l.stops.includes(a) && l.stops.includes(b))) return { ok: false, error: "A pneumatic link already connects these facilities." };
    if(this.portUsage(a,"output")>=this.portCapacity(A,"output")||this.portUsage(b,"input")>=this.portCapacity(B,"input"))return{ok:false,error:"No free connection ports."};
    const out=this.firstFreePort(a,"output"),input=this.firstFreePort(b,"input");
    const path=out<0||input<0?[]:findGridPath(this.portPosition(a,"output",out),this.portPosition(b,"input",input),p=>this.trackBlocked(p)||this.terrain.isWater(...p)||this.world.isMountain(...p));
    if(path.some(p=>this.terrain.isWater(...p)||this.world.isMountain(...p)))return{ok:false,error:"Express links cannot bypass water or mountains."};
    const error=this.pathError(path,a,b);if(error)return {ok:false,error};
    const parts=path.slice(1).map((p,i)=>this.terrain.survey(path[i]??A.pos,p));
    const survey = {...this.terrain.survey(A.pos,B.pos),length:parts.reduce((n,p)=>n+p.length,0)}; this.spendSupply("tubes",1);
    this.lines.push({ id: this.lines.length, name: "Pneumatic freight", type: "tube", stops: [a,b], segments: [{ a,b,survey,crossings:[],cost:0,path }], trains:[this.newTrain()], carriages:0 });
    return { ok: true, cost: 0 };
  }
  private dockPath(index:number,side:"input"|"output"):Pt[] {
    const slot=this.firstFreePort(index,side);if(slot<0)return[];
    const start=this.portPosition(index,side,slot),queue:Pt[]=[start],previous=new Map<string,Pt|null>([[start.join(','),null]]);
    for(let i=0;i<queue.length;i++){const p=queue[i];if(!p)continue;if(this.terrain.isWater(...p)){const path:Pt[]=[];let q:Pt|null|undefined=p;while(q){path.push(q);q=previous.get(q.join(','));}return path.reverse();}
      for(const q of [[p[0]+F.grid,p[1]],[p[0]-F.grid,p[1]],[p[0],p[1]+F.grid],[p[0],p[1]-F.grid]] as Pt[]){if(Math.hypot(q[0]-start[0],q[1]-start[1])>F.dockReach||this.trackBlocked(q)||this.world.isMountain(...q)||previous.has(q.join(',')))continue;previous.set(q.join(','),p);queue.push(q);}}
    return[];
  }
  buildBoat(a:number,b:number):BuildPlan {
    if(this.boats<1)return{ok:false,error:"Unlock boats through a weekly upgrade."};
    if(a===b||!this.stations[a]||!this.stations[b])return{ok:false,error:"Choose two different waterfront facilities."};
    const first=this.dockPath(a,"output"),last=this.dockPath(b,"input"),start=first.at(-1),end=last.at(-1);
    if(!start||!end)return{ok:false,error:"Both facilities need free ports and access to a shore."};
    const water=findGridPath(start,end,p=>p[0]<0||p[1]<0||p[0]>F.worldWidth||p[1]>F.worldHeight||!this.terrain.isWater(...p));
    if(!water.length)return{ok:false,error:"The docks must share the same river or lake."};
    const path=[...first,...water.slice(1),...last.slice(0,-1).reverse()];
    this.lines.push({id:this.lines.length,name:"River freight",type:"boat",stops:[a,b],segments:[{a,b,path,waterPath:water,cost:0,crossings:[],survey:{...this.terrain.survey(start,end),length:Math.max(F.grid,(water.length-1)*F.grid),grade:0}}],trains:[this.newTrain()],carriages:0});this.spendSupply("boats",1);return{ok:true,cost:0,path};
  }
  /** Construction checkpoints stay in the headless simulation, never in React. */
  checkpoint() { return JSON.stringify({stations:this.stations,resources:this.resources,lines:this.lines,inv:this.inv,boats:this.boats,purchasedTrainCosts:this.purchasedTrainCosts,credits:this.credits,undoLoss:this.undoLoss,gifts:this.gifts,giftLoss:this.giftLoss,hubsAvailable:this.hubsAvailable,trackUsed:this.trackUsed,nextTrain:this.nextTrain,time:this.time,week:this.week,weekTime:this.weekTime,phase:"running",contracts:this.contracts,delivered:this.delivered,products:this.products,revenue:this.revenue,contractsCompleted:this.contractsCompleted,contractsMissed:this.contractsMissed,orderAllocated:[...this.orderAllocated],orderStock:[...this.orderStock],contractClock:this.contractClock,nextContract:this.nextContract,tripSum:this.tripSum,transferSum:this.transferSum,rngState:this.rng.snapshot()}); }
  rememberAction(before:string) { if(before!==this.checkpoint()){const state=JSON.parse(before);this.history.push({snapshot:before,spent:Math.max(0,state.credits-this.credits),lossBase:state.undoLoss??0,gifts:Object.fromEntries(Object.keys(this.gifts).map(k=>[k,Math.max(0,(state.gifts?.[k]??0)-this.gifts[k as GiftKind])])) as Record<GiftKind,number>});if(this.history.length>50)this.history.shift();} }
  get undoRefund() {const last=this.history.at(-1);return last&&last.spent>0?{spent:last.spent,refund:Math.floor(last.spent*F.undoRefundRate)}:null;}
  get undoGiftWarning() {const last=this.history.at(-1);return last&&Object.values(last.gifts).some(n=>n>0)?Object.entries(last.gifts).filter(([,n])=>n>0).map(([kind,quantity])=>({kind:kind as GiftKind,quantity})):null;}
  get canUndo() { return this.history.length>0; }
  undoAction():string|null { const saved=this.history.pop();if(!saved)return "Nothing to undo.";const state=JSON.parse(saved.snapshot);for(const kind of Object.keys(this.gifts) as GiftKind[])this.giftLoss[kind]+=saved.gifts[kind];this.undoLoss+=saved.spent-Math.floor(saved.spent*F.undoRefundRate);this.stations.splice(0,this.stations.length,...state.stations);this.resources.splice(0,this.resources.length,...state.resources);this.lines.splice(0,this.lines.length,...state.lines);Object.assign(this.inv,state.inv);this.boats=state.boats;this.purchasedTrainCosts=[...state.purchasedTrainCosts??[]];this.credits=Math.max(0,state.credits-(this.undoLoss-saved.lossBase));this.hubsAvailable=state.hubsAvailable;for(const kind of Object.keys(this.gifts) as GiftKind[]){const lost=this.giftLoss[kind]-(state.giftLoss?.[kind]??0);this.gifts[kind]=Math.max(0,(state.gifts?.[kind]??0)-lost);if(kind==="collectors")this.hubsAvailable=Math.max(0,this.hubsAvailable-lost);else if(kind==="boats")this.boats=Math.max(0,this.boats-lost);else this.inv[kind]=Math.max(0,this.inv[kind]-lost);}this.trackUsed=state.trackUsed;this.nextTrain=state.nextTrain;for(const key of ["time","week","weekTime","phase","contracts","delivered","products","revenue","contractsCompleted","contractsMissed","contractClock","nextContract","tripSum","transferSum"] as const)Object.assign(this,{[key]:state[key]});this.orderAllocated=new Map(state.orderAllocated);this.orderStock=new Map(state.orderStock);this.rng.restore(state.rngState);this.offers=[];return null; }
  segmentAt(p:Pt,radius=F.grid*.65):{line:number;segment:number}|null { let best=radius,result:null|{line:number;segment:number}=null;for(const l of this.lines)for(let i=0;i<l.segments.length;i++){const path=l.segments[i]?.path??[];for(let j=1;j<path.length;j++){const a=path[j-1],b=path[j];if(!a||!b)continue;const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(d<best){best=d;result={line:l.id,segment:i};}}}return result; }
  canRemoveSegment(id:number,index:number) { const l=this.lines[id],seg=l?.segments[index];return !!l&&!!seg&&[seg.a,seg.b].some(node=>l.segments.filter(s=>s.a===node||s.b===node).length===1); }
  removeSegment(id:number,index:number):string|null {
    const l=this.lines[id],seg=l?.segments[index];if(!l||!seg)return "Select an end track first.";
    if(!this.canRemoveSegment(id,index))return "Only an end track can be removed.";
    if(l.segments.length===1){this.clearLine(id);return null;}
    for(const t of l.trains){const edge=l.segments[t.seg],node=edge?this.stations[t.dir===1?edge.a:edge.b]:undefined;if(node)for(const crate of t.cargo)node.stock[crate.good]++;t.cargo=[];t.seg=0;t.t=0;t.dir=1;t.started=false;t.visits={};}
    l.segments.splice(index,1);l.stops=[...new Set(l.segments.flatMap(s=>[s.a,s.b]))];this.inv.track+=seg.cost;this.trackUsed-=seg.cost;for(const c of seg.crossings)this.inv[c==='bridge'?'bridges':'tunnels']++;return null;
  }
  private reconcileOrders() {
    for(const company of this.companies)for(const good of COMMODITIES){const key=`${company.index}:${good}`,stock=company.stock[good],previous=this.orderStock.get(key)??0;let allocated=Math.max(0,(this.orderAllocated.get(key)??0)-Math.max(0,previous-stock));let available=Math.max(0,stock-allocated);
      for(const c of this.contracts.filter(c=>c.company===company.index&&c.good===good&&c.status==='open'&&this.time<=c.deadline)){const n=Math.min(available,c.quantity-c.delivered);c.delivered+=n;available-=n;allocated+=n;if(c.delivered>=c.quantity){c.status='complete';this.contractsCompleted++;this.credits+=F.contractReward;this.revenue+=F.contractReward;this.emit({type:'contract',title:`${company.name} order fulfilled: +${F.contractReward} credits`});}}
      this.orderStock.set(key,stock);this.orderAllocated.set(key,allocated);
    }
  }
  /** Shortest physical rail path, independent of which line runs each edge. */
  nextHop(from: number, to: number): number | null {
    if (from === to) return from;
    const adj = new Map<number, number[]>();
    for (const l of this.lines) for (const s of l.segments) { adj.set(s.a, [...(adj.get(s.a) ?? []), s.b]); adj.set(s.b, [...(adj.get(s.b) ?? []), s.a]); }
    const queue: { node: number; first: number }[] = [{ node: from, first: from }], seen = new Set([from]);
    for (let i = 0; i < queue.length; i++) { const item = queue[i]; if (!item) continue; for (const neighbor of adj.get(item.node) ?? []) { if (seen.has(neighbor)) continue; const first = item.node === from ? neighbor : item.first; if (neighbor === to) return first; seen.add(neighbor); queue.push({ node: neighbor, first }); } }
    return null;
  }
  private incoming(at: number, good: Commodity) { return this.lines.reduce((sum,l) => sum + l.trains.reduce((n,t) => n + t.cargo.filter(c => c.destination === at && c.good === good).length,0),0); }
  private destination(from: number, good: Commodity): number | null {
    const candidates = this.companies.filter(s => s.index !== from && s.companyKind && RECIPES[s.companyKind].inputs[good] && s.stock[good] + this.incoming(s.index,good) < F.inputTarget && this.nextHop(from,s.index) !== null);
    candidates.sort((a,b) => {
      const urgent = (s: FactoryNode) => this.contracts.some(c => c.company === s.index && c.good === good && c.status === "open") ? -F.inputTarget : 0;
      return (a.stock[good] + this.incoming(a.index,good) + urgent(a)) - (b.stock[good] + this.incoming(b.index,good) + urgent(b));
    }); return candidates[0]?.index ?? null;
  }
  private arrive(l: FreightLine, tr: FreightTrain, at: number, next?: number) {
    const s = this.stations[at]; if (!s) return;
    const keep: Crate[] = [];
    for (const crate of tr.cargo) {
      if (crate.destination === at) {
        s.stock[crate.good]++; this.delivered++; this.tripSum += this.time - crate.born; this.transferSum += crate.transfers;
        this.emit({ type: "deliver", station: at });
      } else if (next !== undefined && this.nextHop(at, crate.destination) === next) keep.push(crate);
      else { s.stock[crate.good]++; }
    }
    tr.cargo = keep;
    if (next !== undefined) for (const good of COMMODITIES) {
      // A company retains its own recipe inputs, exporting only its outputs / unrelated freight.
      if (s.companyKind && RECIPES[s.companyKind].inputs[good]) continue;
      while (s.stock[good] > 0 && tr.cargo.length < this.trainCapacity(l)) {
        const destination = this.destination(at,good);
        if (destination === null || this.nextHop(at,destination) !== next) break;
        s.stock[good]--; tr.cargo.push({ good,destination,born:this.time,transfers:0 });
      }
    }
    tr.dwell = CONFIG.train.dwell;
  }
  private moveTrain(l: FreightLine, tr: FreightTrain, dt: number) {
    const seg=l.segments[tr.seg];if(!seg)return;
    if(!tr.started){tr.started=true;this.arrive(l,tr,tr.dir===1?seg.a:seg.b,tr.dir===1?seg.b:seg.a);}
    if(tr.dwell>0){tr.dwell-=dt;return;}
    const speed=l.type==="boat"?F.boatSpeed:l.type==="tube"?CONFIG.train.tubeSpeed:CONFIG.train.railSpeed/(1+seg.survey.grade*CONFIG.train.gradeSlow);
    tr.t+=tr.dir*speed*dt/Math.max(1,seg.survey.length);
    if(tr.t>0&&tr.t<1)return;
    const at=tr.dir===1?seg.b:seg.a;
    const candidates=l.segments.map((edge,index)=>({edge,index})).filter(({edge})=>edge.a===at||edge.b===at);
    const cargoTarget=tr.cargo.find(c=>c.destination!==at)?.destination;
    const preferred=cargoTarget===undefined?null:this.nextHop(at,cargoTarget);
    const visit=tr.visits?.[at]??0;tr.visits={...tr.visits,[at]:visit+1};
    const choice=candidates.find(({edge})=>(edge.a===at?edge.b:edge.a)===preferred)
      ??candidates[visit%candidates.length];
    if(!choice)return;
    tr.seg=choice.index;tr.dir=choice.edge.a===at?1:-1;tr.t=tr.dir===1?0:1;
    this.arrive(l,tr,at,tr.dir===1?choice.edge.b:choice.edge.a);
  }
  rotateBuilding(index:number):string|null {
    const node=this.stations[index];if(!node)return "Choose a building.";
    if(this.lines.some(l=>l.segments.some(seg=>seg.a===index||seg.b===index)))return "Disconnect tracks before rotating this building.";
    node.rotation=((node.rotation??0)+1)%4;return null;
  }
  trainPos(l:FreightLine,tr:FreightTrain) {const seg=l.segments[tr.seg];if(!seg)return{x:0,y:0,ang:0};const a=this.stations[seg.a],b=this.stations[seg.b];if(!a||!b)return{x:0,y:0,ang:0};return pointOnRoute(l.type==="boat"?seg.waterPath??[]:seg.path??[a.pos,b.pos],tr.t);}
  private issueContract() {
    const company = this.companies[this.nextContract % this.companies.length]; if (!company?.companyKind) return;
    const inputs = COMMODITIES.filter(g => RECIPES[company.companyKind ?? "foundry"].inputs[g]); const good = inputs[this.rng.int(inputs.length)]; if (!good) return;
    this.contracts.push({ id:this.nextContract++, company:company.index,good,quantity:F.contractQuantity,delivered:0,deadline:this.time+F.contractSeconds,status:"open" });
    this.emit({ type:"contract",title:`New order: ${company.name}` });
    this.reconcileOrders();
  }
  step(dt: number) {
    if (this.phase !== "running" || dt <= 0) return;
    this.time += dt; this.weekTime += dt; this.contractClock += dt;
    for (const hub of this.hubs) {
      const good = hub.material; if (!good) continue; hub.collection += dt;
      while (hub.collection >= F.collectionSeconds) { hub.collection -= F.collectionSeconds; if (hub.stock[good] >= F.hubCapacity) break; const r = this.resources.find(r => r.hub === hub.index && r.remaining > 0); if (!r) break; r.remaining--; hub.stock[good]++; }
    }
    this.reconcileOrders();
    for (const company of this.companies) {
      if (!company.companyKind) continue; const recipe = RECIPES[company.companyKind];
      company.working = Object.entries(recipe.inputs).every(([g,n]) => company.stock[g as Commodity] >= (n ?? 0)) && (!recipe.output || company.stock[recipe.output] + recipe.quantity <= F.companyCapacity);
      if (!company.working) { company.progress = 0; continue; }
      company.progress += dt;
      if (company.progress >= F.productionSeconds) {
        company.progress -= F.productionSeconds; for (const [g,n] of Object.entries(recipe.inputs)) company.stock[g as Commodity] -= n ?? 0;
        company.produced += recipe.quantity; this.products += recipe.quantity;
        if (recipe.output) company.stock[recipe.output] += recipe.quantity;
        const payment = recipe.quantity * F.productPrice * (recipe.output ? 1 : 3); this.credits += payment; this.revenue += payment;
      }
    }
    this.reconcileOrders();
    for (const l of this.lines) for (const t of l.trains) this.moveTrain(l,t,dt);
    this.reconcileOrders();
    for (const c of this.contracts) if (c.status === "open" && this.time >= c.deadline) { c.status = "missed"; this.contractsMissed++; this.credits = Math.max(0,this.credits-F.contractPenalty); this.emit({ type:"contract",title:`Contract missed: −${F.contractPenalty} credits` }); }
    if (this.contractClock >= F.contractInterval) { this.contractClock = 0; this.issueContract(); }
    if (this.weekTime >= CONFIG.week.seconds) {
      const completedWeek = this.week;
      if (this.week >= CONFIG.week.total) { this.phase = "complete"; this.emit({ type:"complete" }); return; }
      this.week++; this.weekTime = 0; this.expandFrontier(); this.inv.track += CONFIG.week.trackGrant; this.credits += F.weeklyCredits;
      const choices: Upgrade[] = [
        {id:"line",label:"New train line",description:"Add one new train line.",apply:()=>{this.addRailLine();}},
        {id:"hubs",label:"Collectors",description:"Place your next two collectors for free.",apply:()=>{this.grantGift("collectors",2);}},
        {id:"train",label:"Train",description:"Get one more train.",apply:()=>{this.grantGift("locomotives",1);}},
        {id:"wagons",label:"Carriages",description:"Get two carriages to carry more cargo.",apply:()=>{this.grantGift("carriages",2);}},
        {id:"track",label:"Track",description:"Get 400 more track.",apply:()=>{this.grantGift("track",400);}},
        {id:"bridge",label:"Bridge",description:"Get one bridge to cross water.",apply:()=>{this.grantGift("bridges",1);}},
        {id:"tunnel",label:"Tunnel",description:"Get one tunnel to cross mountains.",apply:()=>{this.grantGift("tunnels",1);}},
        {id:"boat",label:"River freight",description:"Get one free boat to carry cargo on water.",apply:()=>{this.grantGift("boats",1);}},
        {id:"tube",label:"Pneumatic link",description:"Get one free pneumatic link.",apply:()=>{this.grantGift("tubes",1);}},
      ];
      const crossing=choices.filter(c=>["bridge","tunnel","boat"].includes(c.id));const ordinary=choices.filter(c=>!crossing.includes(c));this.offers = [crossing[(this.week-2)%3] as Upgrade,...this.rng.shuffle(ordinary).slice(0,2)]; this.phase = "picking"; this.emit({type:"week",week:completedWeek});
    }
  }
  addRailLine() {const id=this.lines.length;this.lines.push({id,name:`Freight ${this.railLines().length+1}`,stops:[],segments:[],trains:[],carriages:0,type:"rail"});}
  pickOffer(i: number) { if (this.phase !== "picking") return; const offer=this.offers[i]; if (!offer) return; offer.apply();this.offers=[];this.phase="running"; }
  metrics(): NetworkMetrics {
    const served = new Set(this.lines.filter(l=>l.stops.length>1).flatMap(l=>l.stops)); const working=this.companies.filter(s=>s.produced>0).length;
    const waitingNow=this.stations.reduce((n,s)=>n+Object.values(s.stock).reduce((a,b)=>a+b,0),0);
    const open=this.contracts.filter(c=>c.status==="open").reduce((n,c)=>n+c.quantity-c.delivered,0);
    return { week:this.week, delivered:this.delivered,stranded:this.contractsMissed*F.contractQuantity,waitingNow,
      serviceRate:this.delivered/Math.max(1,this.delivered+this.contractsMissed*F.contractQuantity+open),avgTripSeconds:this.delivered?this.tripSum/this.delivered:0,avgWaitSeconds:0,transfersPerTrip:this.delivered?this.transferSum/this.delivered:0,
      busiestHub:this.hubs.slice().sort((a,b)=>b.stock[a.material??"iron"]-a.stock[a.material??"iron"])[0]?.name??"none",hubShare:0,coverage:this.companies.filter(s=>served.has(s.index)).length/Math.max(1,this.companies.length),
      resilience:Math.min(1,this.lines.filter(l=>l.stops.length>1).length/3),trackUsed:this.trackUsed,ridersPerTrack:this.delivered/Math.max(1,this.trackUsed),linesBuilt:this.lines.filter(l=>l.type==="rail"&&l.stops.length>1).length,tubesBuilt:this.lines.filter(l=>l.type==="tube"&&l.stops.length>1).length,
      breakdowns:0,outOfCoalSeconds:0,resourcesClaimed:this.resources.filter(r=>r.hub!==null).length,resourcesTotal:this.resources.length,activeDistricts:this.companies.length,failed:false,
      factory:{revenue:this.revenue,products:this.products,contractsCompleted:this.contractsCompleted,contractsMissed:this.contractsMissed,companiesWorking:working,companiesTotal:this.companies.length,hubs:this.hubs.length} };
  }
}
