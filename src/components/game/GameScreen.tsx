import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Volume2, VolumeX, Factory } from "lucide-react";
import { CONFIG } from "@/game/config";
import type { Charter, NetworkMetrics } from "@/shared/types";
import { GOODS, RECIPES, type Commodity } from "@/shared/factory";
import { Primer } from "./Primer";
import { ReportModal } from "./ReportModal";
import { Sidebar } from "./Sidebar";
import { useGameSession } from "./useGameSession";
import { WeekModal } from "./WeekModal";
import { Btn } from "./ui";
export function GameScreen({charter}:{charter:Charter}){
  const [runKey,setRunKey]=useState(0),[primer,setPrimer]=useState(false),[report,setReport]=useState<NetworkMetrics|null>(null);
  const seed=useMemo(()=>71267+runKey,[runKey]),s=useGameSession(charter,runKey,seed),g=s.game;
  useEffect(()=>{setReport(null);},[runKey]);
  useEffect(()=>{if(g?.phase==="complete"&&!report)setReport(g.metrics());},[g,s.tick,report]);
  const hover=g&&s.hoverRef.current?g.stationAt(...s.hoverRef.current):-1,hs=g&&hover>=0?g.stations[hover]:null;
  return <main className="flex min-h-screen flex-col gap-3 p-3 lg:flex-row">
    {g?<Sidebar game={g} name={charter.name} tool={s.tool} setTool={s.setTool} act={s.act} message={s.message} onPrimer={()=>setPrimer(true)} onEnd={()=>{s.setPaused(true);setReport(g.metrics());}} selected={s.selected} onSelect={s.setSelected}/>:<aside className="brass-frame w-80 bg-card/70"/>}
    <section className="relative flex min-w-0 flex-1 flex-col justify-center bg-card/40 p-3">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><div><p className="label-caps text-[10px] text-verdigris">Supply & Steam</p><h2 className="flex items-center gap-2 font-display text-xl text-brass"><Factory size={22}/>Brassworks Transit</h2></div><div className="flex gap-1"><Btn onClick={()=>s.setPaused(!s.paused)} title={s.paused?"Resume":"Pause"}>{s.paused?<Play size={15}/>:<Pause size={15}/>}</Btn>{[1,2,3].map(n=><Btn key={n} variant={s.speed===n?"brass":"ghost"} onClick={()=>s.setSpeed(n)}>{n}×</Btn>)}<Btn onClick={()=>s.setMuted(!s.muted)} title={s.muted?"Enable sound":"Mute sound"}>{s.muted?<VolumeX size={15}/>:<Volume2 size={15}/>}</Btn></div></header>
      <div className="relative mx-auto w-full max-w-[1100px]">
        <canvas aria-label="Industrial railway map" ref={s.canvasRef} onClick={s.onClick} onMouseMove={s.onMove} onMouseLeave={s.onLeave} onDragOver={s.onDragOver} onDrop={s.onDrop} style={{aspectRatio:`${CONFIG.canvas.width}/${CONFIG.canvas.height}`}} className="block w-full cursor-crosshair"/>
        {hs&&<div className="pointer-events-none absolute left-3 top-3 max-w-64 border border-border bg-card/95 p-3 text-sm"><p className="font-display text-brass">{hs.name}</p>{hs.companyKind?<p className="mt-1 text-muted-foreground">{Object.entries(RECIPES[hs.companyKind].inputs).map(([k,n])=>`${n} ${GOODS[k as Commodity].label}`).join(" + ")} → {RECIPES[hs.companyKind].output?GOODS[RECIPES[hs.companyKind].output??"steel"].label:"Exports"}</p>:<p className="text-muted-foreground">{hs.material?GOODS[hs.material].label:""} collection hub</p>}</div>}
        <div className="pointer-events-none absolute right-3 top-3 flex max-w-64 flex-col gap-2">{s.toasts.map(t=><div key={t.id} className="border border-brass bg-card/95 p-3 text-sm">{t.title}</div>)}</div>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-border pt-3"><p className="label-caps text-[10px] text-muted-foreground">{charter.geography.source}</p><p className="label-caps text-[10px] text-brass">{g?.companies.length??0} companies · {g?.hubs.length??0} hubs · {g?.resources.length??0} deposits</p></div>
      {g&&g.phase==="picking"&&s.weekly&&!report&&<WeekModal game={g} week={s.weekly.week} feedback={s.weekly.feedback} onPick={i=>s.act(gg=>gg.pickOffer(i))}/>}
      {g&&report&&<ReportModal game={g} metrics={report} seed={seed} onRetry={()=>setRunKey(k=>k+1)}/>}
      {primer&&<Primer onClose={()=>setPrimer(false)}/>}
    </section>
  </main>;
}
