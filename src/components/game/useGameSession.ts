/** Only bridge between the framework-free factory simulation and React. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Charter, EngineerFeedback } from "@/shared/types";
import type { RawMaterial } from "@/shared/factory";
import { FactoryGame, type GiftKind } from "@/game/factory";
import { FactoryRenderer } from "@/game/render/factory-renderer";
import { CONFIG } from "@/game/config";
import { SoundBoard } from "@/game/audio/sound";
import { getEngineerFeedback } from "@/backend/functions/engineer.functions";
import { getDirectorPlan } from "@/backend/functions/director.functions";
import { updateSettings, useSettings } from "./settings";
import { narrate } from "./narrator";
import { fallbackFeedback } from "@/shared/engineer-rules";
import type { Pt } from "@/game/projection";
import { ISO, fitCircle, fromIso, toIso } from "@/game/render/iso";
import { zoom as createZoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { select } from "d3-selection";
import { snapPoint } from "@/game/grid";
import { TUTORIAL, tutorialAllowsSimulation } from "./tutorial-steps";
export type Tool = { kind: "rail"; line: number } | { kind: "hub"; material: RawMaterial | "transfer" } | { kind: "crossing"; crossing: "bridge" | "tunnel"; line: number | null } | { kind: "boat"; from: number | null } | { kind: "inspect" } | { kind: "tube"; from: number | null };
export interface Toast { id: number; title: string }
export function useGameSession(charter: Charter, runKey: number, seed: number) {
  const canvasRef=useRef<HTMLCanvasElement>(null),gameRef=useRef<FactoryGame|null>(null),soundRef=useRef(new SoundBoard());
  const [tick,setTick]=useState(0),[tool,setTool]=useState<Tool>({kind:"inspect"}),[paused,setPaused]=useState(false),[speed,setSpeed]=useState(1);
  const settings=useSettings(),muted=!settings.gameSound,setMuted=(m:boolean)=>updateSettings({gameSound:!m});
  const [selected,setSelected]=useState<number|null>(null),[toasts,setToasts]=useState<Toast[]>([]),[message,setMessage]=useState(""),[weekly,setWeekly]=useState<{week:number;feedback:EngineerFeedback|null}|null>(null);
  const [tutorial,setTutorial]=useState<number|null>(0);
  const tutorialForest=useRef<Pt|null>(null);
  const [undoWarning,setUndoWarning]=useState<{spent:number;refund:number;gifts?:{kind:GiftKind;quantity:number}[]}|null>(null);
  const undoPending=useRef(false);
  const removalPending=useRef<(()=>void)|null>(null);
  const [removalWarning,setRemovalWarning]=useState<{name:string;spent:number;refund:number}|null>(null);
  const [selectedTrack,setSelectedTrack]=useState<{line:number;segment:number}|null>(null);
  const [tutorialSource,setTutorialSource]=useState<number|null>(null);
  const cameraRef=useRef<ZoomTransform>(zoomIdentity),zoomRef=useRef<ZoomBehavior<HTMLCanvasElement,unknown>|null>(null);
  const [zoomLevel,setZoomLevel]=useState(1);
  const dragRef=useRef<number|null>(null), draftRef=useRef<Pt[]>([]), suppressClick=useRef(false);
  const tutorialRef=useRef(tutorial);tutorialRef.current=tutorial;
  const overlayRef=useRef({selectedTrack,tutorialSource});overlayRef.current={selectedTrack,tutorialSource};
  const hoverRef=useRef<Pt|null>(null),stateRef=useRef({tool,paused,speed,selected});stateRef.current={tool,paused,speed,selected};
  const timerRef=useRef<ReturnType<typeof setTimeout>[]>([]);
  const toast=useCallback((title:string)=>{const id=Date.now();setToasts(ts=>[...ts.slice(-2),{id,title}]);narrate(title);timerRef.current.push(setTimeout(()=>setToasts(ts=>ts.filter(t=>t.id!==id)),5000));},[]);
  useEffect(()=>{soundRef.current.muted=muted;soundRef.current.volume=settings.volume;},[muted,settings.volume]);
  useEffect(()=>{if(message)narrate(message);},[message]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const game=new FactoryGame(charter,seed);gameRef.current=game;
    if(import.meta.env.DEV)(window as unknown as {__factoryGame?:FactoryGame}).__factoryGame=game;
    tutorialForest.current=null;setTutorialSource(null);setSelectedTrack(null);setTutorial(0);setPaused(false);setSelected(null);setWeekly(null);setToasts([]);setTool({kind:"inspect"});setMessage("");
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const behavior=createZoom<HTMLCanvasElement,unknown>().scaleExtent([.08,2.5]).filter(e=>{
      if(e.type==="wheel")return true;
      const p=point(canvas,e.clientX,e.clientY),t=stateRef.current.tool;
      return e.button===1||e.altKey||(t.kind!=="hub"&&t.kind!=="boat"&&t.kind!=="tube"&&dragRef.current===null&&game.stationAt(...p)<0&&!game.portAt(p,"output")&&!game.segmentAt(p));
    }).on("zoom",e=>{cameraRef.current=e.transform;setZoomLevel(e.transform.k);if(e.sourceEvent&&e.sourceEvent.type!=="wheel")suppressClick.current=true;});
    zoomRef.current=behavior;select(canvas).call(behavior).on("dblclick.zoom",null);
    let initialized=false;
    const resize=()=>{const r=canvas.getBoundingClientRect();canvas.width=r.width*dpr;canvas.height=r.height*dpr;if(!initialized){const f=game.frontier,cam=fitCircle(f.center,f.radius,r.width,r.height);select(canvas).call(behavior.transform,zoomIdentity.translate(cam.x,cam.y).scale(cam.k));initialized=true;}};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    const renderer=new FactoryRenderer(ctx,game,dpr);const off=game.on(e=>{
      if(e.type==="deliver")soundRef.current.deliver();
      if(e.type==="contract"&&e.title)toast(e.title);
      if(e.type==="week"){const metrics=game.metrics(),week=e.week??game.week-1;setWeekly({week,feedback:fallbackFeedback(metrics)});getEngineerFeedback({data:{metrics,final:false}}).catch(()=>fallbackFeedback(metrics)).then(feedback=>{if(gameRef.current===game)setWeekly(w=>w&&w.week===week?{...w,feedback}:w);});}
    });
    // Gemini director: plan the next upgrades/orders in the background before they are needed.
    let planWeek=0,planInflight=false,orderKey=-1;
    const requestPlan=()=>{if(planInflight)return;planInflight=true;getDirectorPlan({data:game.snapshot(charter.difficulty)}).then(plan=>{if(plan&&gameRef.current===game)game.applyPlan(plan);}).catch(()=>{}).finally(()=>{planInflight=false;});};
    const prefetch=()=>{if(game.phase!=='running')return;if(game.weekTime>CONFIG.week.seconds-15&&planWeek!==game.week&&game.week<CONFIG.week.total){planWeek=game.week;requestPlan();}else if(!game.queuedOrders.length&&game.nextOrderIn<20&&orderKey!==game.contracts.length){orderKey=game.contracts.length;requestPlan();}};
    let raf=0,last=performance.now(),elapsed=0;const loop=(now:number)=>{const dt=Math.min(.05,(now-last)/1000);last=now;const state=stateRef.current;if(!state.paused&&!undoPending.current&&tutorialAllowsSimulation(tutorialRef.current))for(let i=0;i<state.speed*CONFIG.factory.baseSpeed;i++)game.step(dt);
      const camera=cameraRef.current;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(dpr*camera.k,0,0,dpr*camera.k,dpr*camera.x,dpr*camera.y);ctx.transform(...ISO);
      renderer.draw({selectedLine:state.tool.kind==="rail"||state.tool.kind==="crossing"?state.tool.line:null,hover:hoverRef.current,placement:state.tool.kind==="hub"?state.tool.material:null,selectedNode:state.selected,tubeFrom:state.tool.kind==="tube"?state.tool.from:null,dragFrom:dragRef.current,draftPath:draftRef.current,selectedTrack:overlayRef.current.selectedTrack, tutorialSource:overlayRef.current.tutorialSource, tutorialTarget:tutorialRef.current!==null&&tutorialRef.current>=TUTORIAL.place&&tutorialRef.current<=TUTORIAL.produced?game.companies.find(c=>c.companyKind==="sawmill")?.index??null:null});
      if(tutorialRef.current===TUTORIAL.delivery&&game.companies.some(c=>c.companyKind==="sawmill"&&c.produced>0))setTutorial(TUTORIAL.produced);
      elapsed+=dt;if(elapsed>.15){elapsed=0;prefetch();setTick(t=>t+1);}raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);
    return()=>{observer.disconnect();select(canvas).on(".zoom",null);zoomRef.current=null;cancelAnimationFrame(raf);off();for(const timer of timerRef.current)clearTimeout(timer);timerRef.current=[];if(gameRef.current===game)gameRef.current=null;};
  },[charter,runKey,seed,toast]);
  const point=(element:HTMLCanvasElement,x:number,y:number):Pt=>{const r=element.getBoundingClientRect();return fromIso(cameraRef.current.invert([x-r.left,y-r.top]) as Pt);};
  const cancelTrack=()=>{dragRef.current=null;draftRef.current=[];hoverRef.current=null;};
  const escape=()=>{cancelTrack();setSelected(null);setSelectedTrack(null);setTool({kind:"inspect"});stateRef.current={...stateRef.current,tool:{kind:"inspect"},selected:null};overlayRef.current={...overlayRef.current,selectedTrack:null};suppressClick.current=false;};
  const act=(fn:(g:FactoryGame)=>string|null|void,ok?:string)=>{const g=gameRef.current;if(!g)return;const before=g.checkpoint(),error=fn(g);if(error){setMessage(error);soundRef.current.error();escape();}else{g.rememberAction(before);if(ok)setMessage(ok);}setTick(t=>t+1);};
  const confirmUndo=()=>{undoPending.current=false;setUndoWarning(null);const g=gameRef.current;if(!g)return;const error=g.undoAction();escape();setWeekly(null);setMessage(error??"Action undone.");setTick(t=>t+1);};
  const cancelUndo=()=>{undoPending.current=false;removalPending.current=null;setRemovalWarning(null);setUndoWarning(null);};
  const confirmRemoval=()=>{const perform=removalPending.current;cancelUndo();perform?.();};
  const requestRemoval=(name:string,spent:number,refund:number,perform:()=>void)=>{if(undoPending.current)return;undoPending.current=true;removalPending.current=perform;setRemovalWarning({name,spent,refund});};
  const sellTrain=()=>{const g=gameRef.current,sale=g?.trainSale;if(!g||!sale)return;requestRemoval("train",sale.spent,sale.refund,()=>act(game=>game.sellTrain(),`Train sold: ${sale.refund} credits refunded (50%).`));};
  const undo=()=>{const g=gameRef.current;if(!g||undoPending.current)return;const refund=g.undoRefund,gifts=g.undoGiftWarning;if(refund||gifts){undoPending.current=true;setUndoWarning({...refund??{spent:0,refund:0},...(gifts?{gifts}:{})});}else confirmUndo();};
  const deleteTrack=()=>{if(undoPending.current)return;const g=gameRef.current,index=stateRef.current.selected,node=g&&index!==null?g.stations[index]:null;if(g&&index!==null&&node&&node.type!=="company"){if(g.lines.some(l=>l.segments.some(seg=>seg.a===index||seg.b===index))){setMessage("Disconnect transport links before removing this building.");return;}const refund=g.collectorRefund(index);requestRemoval(node.name,g.buildingPaidCost(index),refund,()=>{act(game=>game.removeBuilding(index),refund>0?`Building removed: ${refund} credits refunded (50%).`:"Free building removed without a refund.");setTutorialSource(null);escape();});return;}const target=overlayRef.current.selectedTrack;if(!target){setMessage("Select a purchased building or an end track first.");return;}act(game=>game.removeSegment(target.line,target.segment));escape();};
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;if(e.key==='Escape'){e.preventDefault();cancelUndo();escape();setMessage("");}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteTrack();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const place=(material:RawMaterial | "transfer",p:Pt)=>{act(g=>{const error=g.placeHub(material,snapPoint(p));if(!error){setTool({kind:"inspect"});if(tutorialRef.current===TUTORIAL.place&&material==="timber"){setTutorialSource(g.hubs.at(-1)?.index??null);setTutorial(TUTORIAL.route);}}return error;},material==="transfer"?"Transfer station placed.":"Collector placed.");};
  const facilityAt=(g:FactoryGame,p:Pt,side:"input"|"output")=>{const idx=g.stationAt(...p);return idx>=0?idx:g.portAt(p,side,CONFIG.factory.portSnapRadius*1.6)?.index??-1;};
  const onPointerDown=(e:React.PointerEvent<HTMLCanvasElement>)=>{const g=gameRef.current,t=stateRef.current.tool;if(!g||t.kind==="hub"||e.button!==0||e.altKey)return;soundRef.current.unlock();const p=point(e.currentTarget,e.clientX,e.clientY);if(g.stationAt(...p)<0&&g.segmentAt(p))return;const idx=facilityAt(g,p,"output");if(idx<0)return;
    setSelected(idx);setSelectedTrack(null);if(g.firstFreePort(idx,"output")<0){if(t.kind==="inspect")return;setMessage("This building has no free outgoing connection.");escape();suppressClick.current=true;return;}
    dragRef.current=idx;draftRef.current=[];suppressClick.current=false;if(tutorialRef.current===TUTORIAL.drag)setTutorialSource(idx);e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove=(e:React.PointerEvent<HTMLCanvasElement>)=>{const p=point(e.currentTarget,e.clientX,e.clientY);hoverRef.current=p;const g=gameRef.current,from=dragRef.current;if(!g||from===null)return;const to=facilityAt(g,p,"input"),t=stateRef.current.tool;suppressClick.current=true;
    if(to>=0&&to!==from&&t.kind!=="boat")draftRef.current=g.segmentPath(from,to,t.kind==='rail'?t.line:0,t.kind==='crossing'?t.crossing:undefined);else draftRef.current=[g.portPosition(from,"output",Math.max(0,g.firstFreePort(from,"output"))),snapPoint(p)];
  };
  const onPointerUp=(e:React.PointerEvent<HTMLCanvasElement>)=>{const g=gameRef.current,from=dragRef.current;if(!g||from===null)return;const p=point(e.currentTarget,e.clientX,e.clientY),t=stateRef.current.tool,to=facilityAt(g,p,"input"),moved=suppressClick.current;cancelTrack();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(!moved&&to===from)return;suppressClick.current=true;
    if(to<0||to===from){setMessage("Drop onto another building to connect.");escape();return;}
    if(t.kind==='tube'||t.kind==='boat'){act(gg=>{const result=t.kind==='boat'?gg.buildBoat(from,to):gg.buildTube(from,to);return result.ok?null:result.error;});escape();return;}
    const chosen=t.kind==='rail'?g.lines[t.line]:t.kind==='crossing'&&t.line!==null?g.lines[t.line]:g.railLines().find(l=>l.stops.includes(from))??g.railLines().find(l=>!l.stops.length);
    if(!chosen){setMessage("Choose a freight route first.");escape();return;}
    act(gg=>{const result=gg.connect(chosen.id,from,to,undefined,t.kind==='crossing'?t.crossing:undefined);if(result.ok){setMessage("");setSelected(null);setTool({kind:'rail',line:chosen.id});if(tutorialRef.current===TUTORIAL.drag&&gg.stations[from]?.material==='timber'&&gg.stations[to]?.companyKind==='sawmill'){setTutorialSource(from);setTutorial(TUTORIAL.delivery);}}return result.ok?null:result.error;});
  };
  const finishTutorial=()=>{localStorage.setItem("factory-tutorial-complete","true");setTutorial(null);setSelected(null);setMessage("");setTool({kind:"inspect"});};
  const startTutorial=()=>{const g=gameRef.current;const timber=g?.hubs.find(h=>h.material==="timber"),sawmill=g?.companies.find(c=>c.companyKind==="sawmill");const connected=timber&&sawmill&&g?.lines.some(l=>l.segments.some(seg=>seg.a===timber.index&&seg.b===sawmill.index));setTutorialSource(timber?.index??null);setTutorial(connected?(sawmill?.produced?TUTORIAL.produced:TUTORIAL.delivery):timber?TUTORIAL.route:0);setPaused(false);setTool({kind:"inspect"});setSelected(null);};
  const onClick=(e:React.MouseEvent<HTMLCanvasElement>)=>{if(suppressClick.current){suppressClick.current=false;return;}const g=gameRef.current;if(!g||g.phase==='complete')return;const p=point(e.currentTarget,e.clientX,e.clientY),t=stateRef.current.tool;if(t.kind==='hub'){place(t.material,p);return;}const idx=g.stationAt(...p);setSelected(idx>=0?idx:null);if(idx>=0){setSelectedTrack(null);return;}const track=g.segmentAt(p);setSelectedTrack(track);if(track)setTool({kind:'rail',line:track.line});else escape();};
  const onDrop=(e:React.DragEvent<HTMLCanvasElement>)=>{e.preventDefault();const material=e.dataTransfer.getData("application/brassworks-material");if(material!=="iron"&&material!=="coal"&&material!=="timber"&&material!=="transfer")return;place(material,point(e.currentTarget,e.clientX,e.clientY));setTool({kind:"inspect"});hoverRef.current=null;};
  const zoomBy=(factor:number)=>{const canvas=canvasRef.current,behavior=zoomRef.current;if(canvas&&behavior)select(canvas).call(behavior.scaleBy,factor);};
  const focusFacility=(index:number)=>{setSelected(index);const canvas=canvasRef.current,behavior=zoomRef.current,node=gameRef.current?.stations[index];if(!canvas||!behavior||!node)return;const r=canvas.getBoundingClientRect(),p=toIso(node.pos),k=Math.max(cameraRef.current.k,.55);select(canvas).call(behavior.transform,zoomIdentity.translate(r.width*.42-p[0]*k,r.height*.45-p[1]*k).scale(k));};
  const fitMap=()=>{const canvas=canvasRef.current,behavior=zoomRef.current;if(!canvas||!behavior)return;const g=gameRef.current;if(!g)return;const r=canvas.getBoundingClientRect(),f=g.frontier,cam=fitCircle(f.center,f.radius,r.width,r.height);select(canvas).call(behavior.transform,zoomIdentity.translate(cam.x,cam.y).scale(cam.k));};
  const tutorialMapPoint=useCallback((kind:'forest'|'source'|'destination'):Pt|null=>{
    const g=gameRef.current,canvas=canvasRef.current;if(!g||!canvas)return null;
    let p:Pt|null=null;
    if(kind==='source')p=g.stations[overlayRef.current.tutorialSource??-1]?.pos??null;
    if(kind==='destination')p=g.companies.find(c=>c.companyKind==='sawmill')?.pos??null;
    if(kind==='forest'){
      if(!tutorialForest.current){
        const sawmill=g.companies.find(c=>c.companyKind==='sawmill');
        const resources=g.resources.filter(r=>r.kind==='timber').sort((a,b)=>sawmill?Math.hypot(a.pos[0]-sawmill.pos[0],a.pos[1]-sawmill.pos[1])-Math.hypot(b.pos[0]-sawmill.pos[0],b.pos[1]-sawmill.pos[1]):0);
        outer:for(const resource of resources)for(let radius=0;radius<=240;radius+=40)for(let angle=0;angle<8;angle++){
          const q=snapPoint([resource.pos[0]+Math.cos(angle*Math.PI/4)*radius,resource.pos[1]+Math.sin(angle*Math.PI/4)*radius]);
          if(!g.planHub('timber',q)){tutorialForest.current=q;break outer;}
        }
      }
      p=tutorialForest.current;
    }
    if(!p)return null;const r=canvas.getBoundingClientRect(),screen=cameraRef.current.apply(toIso(p));return [screen[0]+r.left,screen[1]+r.top];
  },[]);
  useEffect(()=>{
    if(tutorial!==TUTORIAL.place&&tutorial!==TUTORIAL.drag&&tutorial!==TUTORIAL.produced&&tutorial!==24)return;
    const canvas=canvasRef.current,behavior=zoomRef.current;if(!canvas||!behavior)return;
    const a=tutorialMapPoint(tutorial===TUTORIAL.place?'forest':'source'),b=tutorialMapPoint('destination');if(!a)return;
    const bounds=canvas.getBoundingClientRect(),worldA=cameraRef.current.invert([a[0]-bounds.left,a[1]-bounds.top]),worldB=b?cameraRef.current.invert([b[0]-bounds.left,b[1]-bounds.top]):worldA;
    const center:Pt=[(worldA[0]+worldB[0])/2,(worldA[1]+worldB[1])/2];
    const k=Math.min(.7,(bounds.width-140)/Math.max(180,Math.abs(worldA[0]-worldB[0])+120));
    select(canvas).call(behavior.transform,zoomIdentity.translate(bounds.width*.5-center[0]*k,bounds.height*.32-center[1]*k).scale(k));
  },[tutorial,tutorialMapPoint]);
  return {removalWarning,confirmRemoval,sellTrain,undoWarning,confirmUndo,cancelUndo,tutorialMapPoint,dismissMessage:()=>setMessage(""),focusFacility,undo,deleteTrack,escape,selectedTrack,tutorialSource,zoomBy,fitMap,zoomLevel,cancelTrack,tutorial,setTutorial,startTutorial,finishTutorial,onPointerDown,onPointerMove,onPointerUp,canvasRef,game:gameRef.current,tick,tool,setTool,paused,setPaused,speed,setSpeed,muted,setMuted,selected,setSelected,toasts,message,weekly,act,onClick,onDrop,onMove:(e:React.MouseEvent<HTMLCanvasElement>)=>{hoverRef.current=point(e.currentTarget,e.clientX,e.clientY);},onDragOver:(e:React.DragEvent<HTMLCanvasElement>)=>{e.preventDefault();e.dataTransfer.dropEffect="copy";hoverRef.current=point(e.currentTarget,e.clientX,e.clientY);},onLeave:()=>{hoverRef.current=null;},hoverRef};
}
