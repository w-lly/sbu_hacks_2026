/** Factory map rendering; the only drawing layer for the active freight game. */
import { CONFIG } from "../config";
import type { BuildPlan, FactoryGame, FactoryNode } from "../factory";
import { GOODS, RECIPES, type Commodity, type RawMaterial } from "@/shared/factory";
import type { Pt } from "../projection";
import { PALETTE as P } from "./palette";
import { renderTerrainLayer } from "./terrainLayer";
export interface FactoryOverlay { selectedLine: number | null; hover: Pt | null; placement: RawMaterial | null; selectedNode: number | null; tubeFrom: number | null }
const COLORS = [P.danger, P.water, P.brass, P.resource.repair, P.resource.barracks];
export class FactoryRenderer {
  private terrain: HTMLCanvasElement;
  constructor(private ctx: CanvasRenderingContext2D, private game: FactoryGame, dpr: number) { this.terrain = renderTerrainLayer(game,CONFIG.canvas.width,CONFIG.canvas.height,dpr); }
  draw(o: FactoryOverlay) {
    const c=this.ctx,g=this.game;c.drawImage(this.terrain,0,0,CONFIG.canvas.width,CONFIG.canvas.height);
    for(const r of g.resources){const [x,y]=r.pos;c.save();c.fillStyle=P.resource[r.kind==="iron"?"repair":r.kind==="timber"?"barracks":"coal"];c.strokeStyle=P.parchment;c.lineWidth=2;
      c.beginPath();c.roundRect(x-13,y-12,26,24,3);c.fill();c.stroke();c.fillStyle=P.station;c.font="bold 11px 'Barlow Condensed'";c.textAlign="center";c.fillText(GOODS[r.kind].symbol,x,y+4);
      c.fillStyle=P.ink;c.font="600 11px 'Barlow Condensed'";c.fillText(`${GOODS[r.kind].label} · ${r.remaining}`,x,y+26);
      if(r.hub!==null){const hub=g.stations[r.hub];if(hub){c.strokeStyle=P.inkSoft;c.setLineDash([2,4]);c.beginPath();c.moveTo(x,y);c.lineTo(...hub.pos);c.stroke();}}c.restore();}
    for(const l of g.lines){if(l.stops.length<2)continue;const color=COLORS[l.id%COLORS.length]??P.brass;c.save();c.lineCap="round";c.lineJoin="round";
      for(const seg of l.segments){const a=g.stations[seg.a],b=g.stations[seg.b];if(!a||!b)continue;
        const path=()=>{c.beginPath();c.moveTo(...a.pos);c.lineTo(...b.pos);};
        if(o.selectedLine===l.id){c.strokeStyle=P.brass;c.globalAlpha=.35;c.lineWidth=14;path();c.stroke();c.globalAlpha=1;}
        c.strokeStyle=P.ink;c.lineWidth=7;path();c.stroke();c.strokeStyle=color;c.lineWidth=4;if(l.type==="tube")c.setLineDash([7,4]);path();c.stroke();c.setLineDash([]);
        if(seg.crossings.length){c.font="bold 10px 'Barlow Condensed'";c.textAlign="center";c.fillStyle=P.ink;c.fillText(seg.crossings.join(" + "),(a.pos[0]+b.pos[0])/2,(a.pos[1]+b.pos[1])/2-9);}
      }c.restore();}
    if(o.placement&&o.hover){const error=g.planHub(o.placement,o.hover);c.save();c.strokeStyle=error?P.danger:P.resource.repair;c.fillStyle=error?P.danger:P.water;c.globalAlpha=.15;c.beginPath();c.arc(...o.hover,CONFIG.factory.collectionRadius,0,Math.PI*2);c.fill();c.globalAlpha=1;c.setLineDash([5,4]);c.stroke();c.setLineDash([]);this.building(o.hover,true);c.restore();}
    if(o.selectedLine!==null&&o.hover&&!o.placement){const idx=g.stationAt(...o.hover),l=g.lines[o.selectedLine];if(idx>=0&&l?.stops.length){const plan=g.planExtend(l.id,idx),from=g.stations[l.stops[l.stops.length-1]??-1],to=g.stations[idx];if(from&&to)this.ghost(from.pos,to.pos,plan);}}
    for(const s of g.stations)this.node(s,o);
    for(const l of g.lines)for(const t of l.trains){const {x,y,ang}=g.trainPos(l,t);c.save();c.translate(x,y);c.rotate(ang);c.fillStyle=P.ink;c.fillRect(-12,-6,24+l.carriages*5,12);c.fillStyle=COLORS[l.id%COLORS.length]??P.brass;c.fillRect(-9,-4,18+l.carriages*5,8);c.fillStyle=P.station;for(let i=0;i<t.cargo.length;i++)c.fillRect(-7+i*3,-2,2,4);c.restore();}
  }
  private building(pos:Pt,hub:boolean){const c=this.ctx,[x,y]=pos;c.beginPath();c.rect(x-15,y-9,30,23);if(!hub){c.rect(x+6,y-24,6,15);c.moveTo(x-15,y-9);c.lineTo(x-5,y-18);c.lineTo(x-5,y-9);c.lineTo(x+5,y-18);c.lineTo(x+5,y-9);}c.fillStyle=hub?P.resource.repair:P.ink;c.fill();c.strokeStyle=P.station;c.lineWidth=1.5;c.stroke();c.fillStyle=P.brass;for(let i=0;i<3;i++)c.fillRect(x-10+i*9,y-3,5,5);}
  private node(s:FactoryNode,o:FactoryOverlay){const c=this.ctx,[x,y]=s.pos;c.save();if(s.index===o.selectedNode||s.index===o.tubeFrom){c.strokeStyle=P.brass;c.lineWidth=3;c.strokeRect(x-21,y-29,42,49);}
    if(s.type==="hub"&&s.index===o.selectedNode){c.strokeStyle=P.inkSoft;c.setLineDash([4,4]);c.beginPath();c.arc(x,y,CONFIG.factory.collectionRadius,0,Math.PI*2);c.stroke();c.setLineDash([]);}
    this.building(s.pos,s.type==="hub");c.textAlign="center";c.font="600 12px 'Barlow Condensed'";
    const title=s.type==="hub"?s.name:s.realName;const width=c.measureText(title).width+8;c.fillStyle=P.parchment;c.fillRect(x-width/2,y+18,width,16);c.fillStyle=P.ink;c.fillText(title,x,y+30);
    const recipe=s.companyKind?RECIPES[s.companyKind]:null;
    c.font="600 10px 'Barlow Condensed'";const label=recipe?`${recipe.label} · ${s.working?"PRODUCING":"AWAITING INPUT"}`:`${s.material?GOODS[s.material].label:""} · ${Object.values(s.stock).reduce((a,b)=>a+b,0)} crates`;
    c.fillStyle=s.working?P.resource.repair:P.ink;c.fillText(label,x,y+43);
    if(recipe){let i=0;for(const good of Object.keys(recipe.inputs) as Commodity[]){c.fillStyle=s.stock[good]>0?P.resource.repair:P.danger;c.fillRect(x-15+i*15,y-34,12,4);i++;}}
    c.restore();}
  private ghost(a:Pt,b:Pt,p:BuildPlan){const c=this.ctx;c.save();c.strokeStyle=p.ok?P.brass:P.danger;c.lineWidth=4;c.setLineDash([6,4]);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();c.setLineDash([]);c.font="600 12px 'Barlow Condensed'";c.textAlign="center";const label=p.ok?`${p.cost??0} rails${p.crossings?.length?" · "+p.crossings.join(" + "):""}`:p.error??"";const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,w=c.measureText(label).width+12;c.fillStyle=P.outside;c.fillRect(x-w/2,y+8,w,20);c.fillStyle=P.station;c.fillText(label,x,y+22);c.restore();}
}
