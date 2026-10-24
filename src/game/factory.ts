/** Headless, seeded industrial logistics simulation. No React or DOM dependencies. */
import type { Charter, NetworkMetrics } from "@/shared/types";
import { COMMODITIES, RAW_MATERIALS, RECIPES, emptyStock, type Commodity, type CompanyKind, type FreightContract, type RawMaterial, type Stock } from "@/shared/factory";
import { CONFIG } from "./config";
import { Terrain, type SegmentSurvey } from "./terrain";
import { makeProjection, type Pt } from "./projection";
import { Rng } from "./rng";

export interface FactoryNode {
  index: number; name: string; realName: string; pos: Pt; type: "hub" | "company";
  material?: RawMaterial; companyKind?: CompanyKind; stock: Stock; progress: number;
  produced: number; working: boolean; collection: number;
}
export interface Deposit { id: number; kind: RawMaterial; pos: Pt; remaining: number; hub: number | null }
export interface Crate { good: Commodity; destination: number; born: number; transfers: number }
export interface FreightTrain { id: number; seg: number; t: number; dir: 1 | -1; cargo: Crate[]; dwell: number; started: boolean }
export interface FreightSegment { a: number; b: number; survey: SegmentSurvey; crossings: ("bridge" | "tunnel")[]; cost: number }
export interface FreightLine { id: number; name: string; stops: number[]; segments: FreightSegment[]; trains: FreightTrain[]; carriages: number; type: "rail" | "tube" }
export interface BuildPlan { ok: boolean; error?: string | undefined; cost?: number; survey?: SegmentSurvey; crossings?: ("bridge" | "tunnel")[]; from?: number | undefined }
export interface FactoryEvent { type: "deliver" | "week" | "complete" | "contract"; week?: number; title?: string; station?: number }
export interface Upgrade { id: string; label: string; description: string; apply: () => void }
const F = CONFIG.factory;
export class FactoryGame {
  readonly rng: Rng; readonly terrain: Terrain; readonly proj;
  readonly stations: FactoryNode[]; readonly resources: Deposit[] = [];
  readonly lines: FreightLine[] = [];
  readonly inv: Charter["start"];
  credits = F.startingCredits; hubsAvailable = F.startingHubs;
  time = 0; week = 1; weekTime = 0; phase: "running" | "picking" | "complete" = "running";
  offers: Upgrade[] = []; contracts: FreightContract[] = [];
  delivered = 0; products = 0; revenue = 0; trackUsed = 0;
  contractsCompleted = 0; contractsMissed = 0;
  private contractClock = 0; private nextContract = 1; private nextTrain = 1;
  private tripSum = 0; private transferSum = 0;
  private listeners = new Set<(e: FactoryEvent) => void>();
  constructor(readonly charter: Charter, seed: number) {
    this.rng = new Rng(seed); this.proj = makeProjection(charter.geography.bbox);
    this.terrain = new Terrain(charter.geography, this.proj);
    this.inv = { ...charter.start, track: Math.max(charter.start.track, F.startingTrack), locomotives: F.startingLocomotives };
    const kinds: CompanyKind[] = ["foundry", "sawmill", "works", "exporter"];
    this.stations = charter.districts.map((d, index) => {
      const companyKind = kinds[index % kinds.length] ?? "foundry";
      return { index, name: `${d.realName} ${RECIPES[companyKind].label}`, realName: d.realName,
        pos: this.terrain.nearestLand(this.proj.project([d.lng, d.lat])), type: "company", companyKind,
        stock: emptyStock(), progress: 0, produced: 0, working: false, collection: 0 };
    });
    for (let i = 0; i < 5; i++) this.lines.push({ id: i, name: `Freight ${i + 1}`, stops: [], segments: [], trains: [], carriages: 0, type: "rail" });
    for (const kind of RAW_MATERIALS) for (let n = 0; n < F.depositsPerKind; n++) this.spawnDeposit(kind, n);
    this.issueContract();
  }
  on(fn: (e: FactoryEvent) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit(e: FactoryEvent) { for (const fn of this.listeners) fn(e); }
  get companies() { return this.stations.filter(s => s.type === "company"); }
  get hubs() { return this.stations.filter(s => s.type === "hub"); }
  get activeStations() { return this.stations; }
  get hourOfDay() { return (6 + this.time / CONFIG.day.seconds * 24) % 24; }
  railLines() { return this.lines.filter(l => l.type === "rail"); }
  stationAt(x: number, y: number) { return this.stations.findIndex(s => Math.hypot(s.pos[0] - x, s.pos[1] - y) < CONFIG.station.pickRadius); }
  capacity(s: FactoryNode) { return s.type === "hub" ? F.hubCapacity : F.companyCapacity; }
  trainCapacity(l: FreightLine) { return l.type === "tube" ? CONFIG.train.tubeCapacity : CONFIG.train.baseCapacity + l.carriages * CONFIG.train.perCarriage; }
  private spawnDeposit(kind: RawMaterial, n: number) {
    const eligible = this.companies.filter(s => s.companyKind && RECIPES[s.companyKind].inputs[kind]);
    const anchor = eligible[n % eligible.length] ?? this.companies[n % this.companies.length];
    if (!anchor) return;
    for (let attempt = 0; attempt < 300; attempt++) {
      const angle = this.rng.next() * Math.PI * 2, distance = 55 + this.rng.next() * 95;
      const p: Pt = [anchor.pos[0] + Math.cos(angle) * distance, anchor.pos[1] + Math.sin(angle) * distance];
      if (!this.terrain.inBounds(...p) || this.terrain.isWater(...p)) continue;
      if (this.stations.some(s => Math.hypot(s.pos[0] - p[0], s.pos[1] - p[1]) < 40) || this.resources.some(r => Math.hypot(r.pos[0] - p[0], r.pos[1] - p[1]) < 32)) continue;
      this.resources.push({ id: this.resources.length, kind, pos: p, remaining: F.depositStock, hub: null }); return;
    }
    // Deterministic land-cell fallback keeps every material available on narrow maps.
    const b = this.terrain.bounds;
    for (let y = b.y0 + 25; y < b.y1 - 25; y += 35) for (let x = b.x0 + 25; x < b.x1 - 25; x += 35) {
      if (this.terrain.isWater(x, y) || this.resources.some(r => Math.hypot(r.pos[0] - x, r.pos[1] - y) < 32) || this.stations.some(s => Math.hypot(s.pos[0] - x, s.pos[1] - y) < 40)) continue;
      this.resources.push({ id: this.resources.length, kind, pos: [x, y], remaining: F.depositStock, hub: null }); return;
    }
  }
  planHub(kind: RawMaterial, pos: Pt): string | null {
    if (this.phase === "complete") return "This charter is complete.";
    if (!this.terrain.inBounds(...pos) || this.terrain.isWater(...pos)) return "Facilities need dry ground inside the map.";
    if (this.stations.some(s => Math.hypot(s.pos[0] - pos[0], s.pos[1] - pos[1]) < F.placementGap)) return "Leave more room between facilities.";
    if (this.hubsAvailable <= 0) return "No collection facilities available; request more next week.";
    if (this.credits < F.hubCost) return "Not enough credits for a facility.";
    if (!this.resources.some(r => r.kind === kind && r.hub === null && r.remaining > 0 && Math.hypot(r.pos[0] - pos[0], r.pos[1] - pos[1]) <= F.collectionRadius)) return "No unclaimed matching deposit within collection range.";
    return null;
  }
  placeHub(kind: RawMaterial, pos: Pt): string | null {
    const error = this.planHub(kind, pos); if (error) return error;
    const index = this.stations.length;
    this.stations.push({ index, name: `${kind === "timber" ? "Logging" : kind === "iron" ? "Iron" : "Coal"} Hub ${this.hubs.length + 1}`, realName: "Collection facility", pos: [...pos], type: "hub", material: kind, stock: emptyStock(), progress: 0, produced: 0, working: false, collection: 0 });
    this.hubsAvailable--; this.credits -= F.hubCost;
    for (const r of this.resources) if (r.kind === kind && r.hub === null && Math.hypot(r.pos[0] - pos[0], r.pos[1] - pos[1]) <= F.collectionRadius) r.hub = index;
    return null;
  }
  planExtend(lineId: number, idx: number): BuildPlan {
    const l = this.lines[lineId], s = this.stations[idx];
    if (!l || !s || this.phase === "complete") return { ok: false, error: "Choose a facility and an active freight line." };
    if (l.type !== "rail") return { ok: false, error: "Pneumatic links have two endpoints." };
    if (l.stops.includes(idx)) return { ok: false, error: "This facility is already on the line." };
    if (!l.stops.length) return { ok: true, cost: 0 };
    if (l.stops.length === 1 && this.inv.locomotives < 1) return { ok: false, error: "No spare locomotive." };
    const from = l.stops[l.stops.length - 1], a = from === undefined ? undefined : this.stations[from];
    if (!a) return { ok: false, error: "Missing line endpoint." };
    const survey = this.terrain.survey(a.pos, s.pos); const crossings: ("bridge" | "tunnel")[] = [];
    let bridges = this.inv.bridges, tunnels = this.inv.tunnels;
    for (const span of survey.waterRuns) {
      if (span <= CONFIG.crossing.maxBridgeSpan && bridges > 0) { bridges--; crossings.push("bridge"); }
      else if (tunnels > 0) { tunnels--; crossings.push("tunnel"); }
      else return { ok: false, error: "Water crossing needs a bridge or tunnel from stores.", survey, from };
    }
    const cost = Math.round(survey.cost + survey.waterRuns.reduce((sum, span, i) => sum + span * ((crossings[i] === "bridge" ? CONFIG.crossing.bridgeTrackMult : CONFIG.crossing.tunnelTrackMult) - 1), 0));
    return { ok: cost <= this.inv.track, error: cost > this.inv.track ? `Needs ${cost} rails; only ${Math.round(this.inv.track)} remain.` : undefined, cost, survey, crossings, from };
  }
  extend(id: number, idx: number): BuildPlan {
    const p = this.planExtend(id, idx), l = this.lines[id]; if (!p.ok || !l) return p;
    if (!l.stops.length) { l.stops.push(idx); return p; }
    if (p.from === undefined || !p.survey || !p.crossings || p.cost === undefined) return { ok: false, error: "Incomplete survey." };
    l.segments.push({ a: p.from, b: idx, survey: p.survey, crossings: p.crossings, cost: p.cost }); l.stops.push(idx);
    this.inv.track -= p.cost; this.trackUsed += p.cost;
    for (const c of p.crossings) this.inv[c === "bridge" ? "bridges" : "tunnels"]--;
    if (!l.trains.length) { this.inv.locomotives--; l.trains.push(this.newTrain()); }
    return p;
  }
  private newTrain(): FreightTrain { return { id: this.nextTrain++, seg: 0, t: 0, dir: 1, cargo: [], dwell: 0, started: false }; }
  addTrain(id: number): string | null { const l = this.lines[id]; if (!l || l.stops.length < 2 || this.inv.locomotives < 1 || l.type !== "rail") return "A built rail line and spare locomotive are required."; this.inv.locomotives--; l.trains.push(this.newTrain()); return null; }
  addCarriage(id: number): string | null { const l = this.lines[id]; if (!l || l.stops.length < 2 || this.inv.carriages < 1 || l.type !== "rail") return "A built rail line and spare carriage are required."; this.inv.carriages--; l.carriages++; return null; }
  clearLine(id: number) {
    const l = this.lines[id]; if (!l) return;
    for (const seg of l.segments) { this.inv.track += seg.cost; this.trackUsed -= seg.cost; for (const c of seg.crossings) this.inv[c === "bridge" ? "bridges" : "tunnels"]++; }
    for (const t of l.trains) { const node = this.stations[l.stops[t.seg] ?? -1]; if (node) for (const crate of t.cargo) node.stock[crate.good]++; }
    if (l.type === "rail") this.inv.locomotives += l.trains.length; else if (l.stops.length) this.inv.tubes++;
    this.inv.carriages += l.carriages; l.stops = []; l.segments = []; l.trains = []; l.carriages = 0;
  }
  undoLast(id: number) { const l = this.lines[id]; if (!l) return; const stops = l.stops.slice(0, -1); this.clearLine(id); for (const stop of stops) this.extend(id, stop); }
  buildTube(a: number, b: number): BuildPlan {
    const A = this.stations[a], B = this.stations[b];
    if (!A || !B || a === b || this.inv.tubes < 1) return { ok: false, error: "Pick two facilities with a pneumatic link in stores." };
    if (Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1]) > CONFIG.tube.maxLength) return { ok: false, error: "Facilities are too far apart for a pneumatic link." };
    if (this.lines.some(l => l.type === "tube" && l.stops.includes(a) && l.stops.includes(b))) return { ok: false, error: "A pneumatic link already connects these facilities." };
    const survey = this.terrain.survey(A.pos, B.pos); this.inv.tubes--;
    this.lines.push({ id: this.lines.length, name: "Pneumatic freight", type: "tube", stops: [a,b], segments: [{ a,b,survey,crossings:[],cost:0 }], trains:[this.newTrain()], carriages:0 });
    return { ok: true, cost: 0 };
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
        const c = this.contracts.find(c => c.company === at && c.good === crate.good && c.status === "open");
        if (c) { c.delivered++; if (c.delivered >= c.quantity) { c.status = "complete"; this.contractsCompleted++; this.credits += F.contractReward; this.revenue += F.contractReward; this.emit({ type: "contract", title: `Contract fulfilled: +${F.contractReward} credits` }); } }
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
    const first = l.stops[0]; if (l.stops.length < 2 || first === undefined) return;
    if (!tr.started) { tr.started = true; this.arrive(l,tr,first,l.stops[1]); }
    if (tr.dwell > 0) { tr.dwell -= dt; return; }
    const seg = l.segments[tr.seg]; if (!seg) return;
    const speed = l.type === "tube" ? CONFIG.train.tubeSpeed : CONFIG.train.railSpeed / (1 + seg.survey.grade * CONFIG.train.gradeSlow);
    tr.t += tr.dir * speed * dt / Math.max(1,seg.survey.length);
    if (tr.t > 0 && tr.t < 1) return;
    const at = tr.dir === 1 ? tr.seg + 1 : tr.seg;
    if (at === l.stops.length - 1) { tr.dir = -1; tr.t = 1; }
    else if (at === 0) { tr.dir = 1; tr.seg = 0; tr.t = 0; }
    else if (tr.dir === 1) { tr.seg++; tr.t = 0; } else { tr.seg--; tr.t = 1; }
    const station = l.stops[at]; if (station !== undefined) this.arrive(l,tr,station,l.stops[at + tr.dir]);
  }
  trainPos(l: FreightLine,tr: FreightTrain) { const seg = l.segments[tr.seg], a = seg ? this.stations[seg.a] : undefined, b = seg ? this.stations[seg.b] : undefined; if (!a || !b) return { x:0,y:0,ang:0 }; return { x:a.pos[0]+(b.pos[0]-a.pos[0])*tr.t,y:a.pos[1]+(b.pos[1]-a.pos[1])*tr.t,ang:Math.atan2(b.pos[1]-a.pos[1],b.pos[0]-a.pos[0]) }; }
  private issueContract() {
    const company = this.companies[this.nextContract % this.companies.length]; if (!company?.companyKind) return;
    const inputs = COMMODITIES.filter(g => RECIPES[company.companyKind ?? "foundry"].inputs[g]); const good = inputs[this.rng.int(inputs.length)]; if (!good) return;
    this.contracts.push({ id:this.nextContract++, company:company.index,good,quantity:F.contractQuantity,delivered:0,deadline:this.time+F.contractSeconds,status:"open" });
    this.emit({ type:"contract",title:`New contract: ${company.realName}` });
  }
  step(dt: number) {
    if (this.phase !== "running" || dt <= 0) return;
    this.time += dt; this.weekTime += dt; this.contractClock += dt;
    for (const hub of this.hubs) {
      const good = hub.material; if (!good) continue; hub.collection += dt;
      while (hub.collection >= F.collectionSeconds) { hub.collection -= F.collectionSeconds; if (hub.stock[good] >= F.hubCapacity) break; const r = this.resources.find(r => r.hub === hub.index && r.remaining > 0); if (!r) break; r.remaining--; hub.stock[good]++; }
    }
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
    for (const l of this.lines) for (const t of l.trains) this.moveTrain(l,t,dt);
    for (const c of this.contracts) if (c.status === "open" && this.time >= c.deadline) { c.status = "missed"; this.contractsMissed++; this.credits = Math.max(0,this.credits-F.contractPenalty); this.emit({ type:"contract",title:`Contract missed: −${F.contractPenalty} credits` }); }
    if (this.contractClock >= F.contractInterval) { this.contractClock = 0; this.issueContract(); }
    if (this.weekTime >= CONFIG.week.seconds) {
      const completedWeek = this.week;
      if (this.week >= CONFIG.week.total) { this.phase = "complete"; this.emit({ type:"complete" }); return; }
      this.week++; this.weekTime = 0; this.inv.track += CONFIG.week.trackGrant; this.credits += F.weeklyCredits;
      const choices: Upgrade[] = [
        {id:"hubs",label:"Collection facilities",description:"Two additional collection hubs.",apply:()=>{this.hubsAvailable+=2;}},
        {id:"train",label:"Locomotive",description:"One extra freight locomotive.",apply:()=>{this.inv.locomotives++;}},
        {id:"wagons",label:"Freight carriages",description:"Two carriages for greater cargo capacity.",apply:()=>{this.inv.carriages+=2;}},
        {id:"track",label:"Rail shipment",description:"400 additional units of track.",apply:()=>{this.inv.track+=400;}},
        {id:"crossings",label:"Crossing works",description:"One bridge and one tunnel.",apply:()=>{this.inv.bridges++;this.inv.tunnels++;}},
        {id:"tube",label:"Pneumatic freight",description:"One short-range express cargo link.",apply:()=>{this.inv.tubes++;}},
      ];
      this.offers = this.rng.shuffle(choices).slice(0,3); this.phase = "picking"; this.emit({type:"week",week:completedWeek});
    }
  }
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
