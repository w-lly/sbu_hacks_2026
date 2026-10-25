/** Pure presentation geometry: simulation progress and cargo are never changed. */
import type { FreightLine, FreightTrain } from '../factory';
import type { Pt } from '../projection';
import { toIso } from './iso';

export interface TrainPose { x:number; y:number; ang:number; front:Pt; rear:Pt }
const distance=(a:Pt,b:Pt)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const length=(path:Pt[])=>path.slice(1).reduce((sum,p,i)=>sum+distance(path[i]??p,p),0);
export function sampleRail(path:Pt[],at:number):Pt {
 const first=path[0];if(!first)return [0,0];
 let remaining=Math.max(0,at);
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(!a||!b)continue;const span=distance(a,b);if(!span)continue;if(remaining<=span)return [a[0]+(b[0]-a[0])*remaining/span,a[1]+(b[1]-a[1])*remaining/span];remaining-=span;}
 return path.at(-1)??first;
}
export function trainPoses(line:FreightLine,train:FreightTrain,stations:ReadonlyArray<{pos:Pt}>,spacing=44):TrainPose[] {
 const active=line.segments[train.seg];if(!active)return [];
 const path:Pt[]=[];let progress=0,activeDirection=1;
 for(let i=1;i<line.stops.length;i++){
  const a=line.stops[i-1],b=line.stops[i];
  const edge=line.segments.find(s=>(s.a===a&&s.b===b)||(s.a===b&&s.b===a));if(!edge)continue;
  const start=stations[edge.a],end=stations[edge.b];if(!start||!end)continue;
  const forward=edge.a===a,points=forward?[...(edge.path??[start.pos,end.pos])]:[...(edge.path??[start.pos,end.pos])].reverse();
  if(edge===active){activeDirection=forward?1:-1;progress=length(path)+(forward?train.t:1-train.t)*length(points);if(path.length&&points[0])progress+=distance(path.at(-1)??points[0],points[0]);}
  path.push(...points);
 }
 if(path.length<2)return [];
 const total=length(path),dir=train.dir*activeDirection;
 // Fit the whole consist on short rails and inside terminal platforms.
 const gap=Math.min(spacing,total/Math.max(1,line.carriages+1));
 const extent=gap*line.carriages;
 const engine=dir===1?Math.max(extent,Math.min(total,progress)):Math.min(total-extent,Math.max(0,progress));
 return Array.from({length:line.carriages+1},(_,i)=>{
  const at=engine-dir*i*gap,p=sampleRail(path,at),front=sampleRail(path,at+dir*gap*.5),rear=sampleRail(path,at-dir*gap*.5);
  const [dx,dy]=toIso([front[0]-rear[0],front[1]-rear[1]]);
  return {x:p[0],y:p[1],ang:Math.atan2(dy,dx),front,rear};
 });
}