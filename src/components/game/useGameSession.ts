/** Only bridge between the framework-free factory simulation and React. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Charter, EngineerFeedback } from "@/shared/types";
import type { RawMaterial } from "@/shared/factory";
import { FactoryGame } from "@/game/factory";
import { FactoryRenderer } from "@/game/render/factory-renderer";
import { CONFIG } from "@/game/config";
import { SoundBoard } from "@/game/audio/sound";
import { getEngineerFeedback } from "@/backend/functions/engineer.functions";
import { fallbackFeedback } from "@/shared/engineer-rules";
import type { Pt } from "@/game/projection";
export type Tool = { kind: "rail"; line: number } | { kind: "hub"; material: RawMaterial } | { kind: "inspect" } | { kind: "tube"; from: number | null };
export interface Toast { id: number; title: string }
export function useGameSession(charter: Charter, runKey: number, seed: number) {
  const canvasRef=useRef<HTMLCanvasElement>(null),gameRef=useRef<FactoryGame|null>(null),soundRef=useRef(new SoundBoard());
  const [tick,setTick]=useState(0),[tool,setTool]=useState<Tool>({kind:"inspect"}),[paused,setPaused]=useState(false),[speed,setSpeed]=useState(1),[muted,setMuted]=useState(false);
  const [selected,setSelected]=useState<number|null>(null),[toasts,setToasts]=useState<Toast[]>([]),[message,setMessage]=useState(""),[weekly,setWeekly]=useState<{week:number;feedback:EngineerFeedback|null}|null>(null);
  const hoverRef=useRef<Pt|null>(null),stateRef=useRef({tool,paused,speed,selected});stateRef.current={tool,paused,speed,selected};
  const timerRef=useRef<ReturnType<typeof setTimeout>[]>([]);
  const toast=useCallback((title:string)=>{const id=Date.now();setToasts(ts=>[...ts.slice(-2),{id,title}]);timerRef.current.push(setTimeout(()=>setToasts(ts=>ts.filter(t=>t.id!==id)),5000));},[]);
  useEffect(()=>{soundRef.current.muted=muted;},[muted]);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const game=new FactoryGame(charter,seed);gameRef.current=game;
    if(import.meta.env.DEV)(window as unknown as {__factoryGame?:FactoryGame}).__factoryGame=game;
    setPaused(false);setSelected(null);setWeekly(null);setToasts([]);setTool({kind:"inspect"});setMessage("");
    const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=CONFIG.canvas.width*dpr;canvas.height=CONFIG.canvas.height*dpr;ctx.scale(dpr,dpr);
    const renderer=new FactoryRenderer(ctx,game,dpr);const off=game.on(e=>{
      if(e.type==="deliver")soundRef.current.deliver();
      if(e.type==="contract"&&e.title)toast(e.title);
      if(e.type==="week"){const metrics=game.metrics(),week=e.week??game.week-1;setWeekly({week,feedback:fallbackFeedback(metrics)});getEngineerFeedback({data:{metrics,final:false}}).catch(()=>fallbackFeedback(metrics)).then(feedback=>{if(gameRef.current===game)setWeekly(w=>w&&w.week===week?{...w,feedback}:w);});}
    });
    let raf=0,last=performance.now(),elapsed=0;const loop=(now:number)=>{const dt=Math.min(.05,(now-last)/1000);last=now;const state=stateRef.current;if(!state.paused)for(let i=0;i<state.speed;i++)game.step(dt);
      renderer.draw({selectedLine:state.tool.kind==="rail"?state.tool.line:null,hover:hoverRef.current,placement:state.tool.kind==="hub"?state.tool.material:null,selectedNode:state.selected,tubeFrom:state.tool.kind==="tube"?state.tool.from:null});
      elapsed+=dt;if(elapsed>.15){elapsed=0;setTick(t=>t+1);}raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf);off();for(const timer of timerRef.current)clearTimeout(timer);timerRef.current=[];if(gameRef.current===game)gameRef.current=null;};
  },[charter,runKey,seed,toast]);
  const point=(element:HTMLCanvasElement,x:number,y:number):Pt=>{const r=element.getBoundingClientRect();return[(x-r.left)/r.width*CONFIG.canvas.width,(y-r.top)/r.height*CONFIG.canvas.height];};
  const act=(fn:(g:FactoryGame)=>string|null|void,ok?:string)=>{const g=gameRef.current;if(!g)return;const error=fn(g);if(error){setMessage(error);soundRef.current.error();}else if(ok)setMessage(ok);setTick(t=>t+1);};
  const place=(material:RawMaterial,p:Pt)=>{act(g=>g.placeHub(material,p),"Collection hub established.");};
  const onClick=(e:React.MouseEvent<HTMLCanvasElement>)=>{const g=gameRef.current;if(!g||g.phase==="complete")return;soundRef.current.unlock();const p=point(e.currentTarget,e.clientX,e.clientY),t=stateRef.current.tool;
    if(t.kind==="hub"){place(t.material,p);return;}const idx=g.stationAt(...p);if(idx<0){setSelected(null);return;}setSelected(idx);
    if(t.kind==="rail")act(gg=>{const result=gg.extend(t.line,idx);return result.ok?null:result.error;},"Freight line connected.");
    if(t.kind==="tube"){if(t.from===null)setTool({kind:"tube",from:idx});else{act(gg=>{const result=gg.buildTube(t.from??idx,idx);return result.ok?null:result.error;},"Pneumatic freight connected.");setTool({kind:"tube",from:null});}}
  };
  const onDrop=(e:React.DragEvent<HTMLCanvasElement>)=>{e.preventDefault();const material=e.dataTransfer.getData("application/brassworks-material");if(material!=="iron"&&material!=="coal"&&material!=="timber")return;place(material,point(e.currentTarget,e.clientX,e.clientY));setTool({kind:"inspect"});hoverRef.current=null;};
  return {canvasRef,game:gameRef.current,tick,tool,setTool,paused,setPaused,speed,setSpeed,muted,setMuted,selected,setSelected,toasts,message,weekly,act,onClick,onDrop,onMove:(e:React.MouseEvent<HTMLCanvasElement>)=>{hoverRef.current=point(e.currentTarget,e.clientX,e.clientY);},onDragOver:(e:React.DragEvent<HTMLCanvasElement>)=>{e.preventDefault();e.dataTransfer.dropEffect="copy";hoverRef.current=point(e.currentTarget,e.clientX,e.clientY);},onLeave:()=>{hoverRef.current=null;},hoverRef};
}
