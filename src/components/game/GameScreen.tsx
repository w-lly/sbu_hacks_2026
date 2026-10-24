import { useEffect, useMemo, useState } from "react";
import { CONFIG } from "@/game/config";
import type { Charter, NetworkMetrics } from "@/shared/types";
import { Primer } from "./Primer";
import { ReportModal } from "./ReportModal";
import { Sidebar } from "./Sidebar";
import { useGameSession } from "./useGameSession";
import { WeekModal } from "./WeekModal";

export function GameScreen({ charter }: { charter: Charter }) {
  const [runKey, setRunKey] = useState(0);
  const seed = useMemo(() => 1 + Math.floor(Math.random() * 1e6) + runKey, [runKey]);
  const s = useGameSession(charter, runKey, seed);
  const [primer, setPrimer] = useState(false);
  const [report, setReport] = useState<NetworkMetrics | null>(null);
  const g = s.game;

  useEffect(() => { setReport(null); }, [runKey]);
  useEffect(() => {
    if (g && (g.phase === "failed" || g.phase === "complete") && !report) setReport(g.metrics());
  }, [g, s.tick, report]);

  const endRun = () => { if (!g) return; s.setPaused(true); setReport(g.metrics()); };
  const hover = g && s.hoverRef.current ? g.stationAt(s.hoverRef.current.x, s.hoverRef.current.y) : -1;
  const hs = hover >= 0 && g ? g.stations[hover]! : null;

  return (
    <main className="flex min-h-screen flex-col gap-3 p-3 lg:flex-row">
      {g ? <Sidebar game={g} name={charter.name} tool={s.tool} setTool={s.setTool} act={s.act} message={s.message} onPrimer={() => setPrimer(true)} onEnd={endRun} />
        : <aside className="brass-frame w-80 bg-card/70" />}
      <section className="brass-frame relative flex flex-1 flex-col items-center justify-center bg-card/40 p-3">
        <div className="mb-2 flex w-full max-w-[1100px] items-center justify-between gap-2">
          <div className="flex gap-1">
            <button className={s.paused ? "btn-brass" : "btn-ghost"} onClick={() => s.setPaused(!s.paused)}>{s.paused ? "Resume" : "Pause"}</button>
            {[1, 2, 3].map((n) => <button key={n} className={s.speed === n ? "btn-brass" : "btn-ghost"} onClick={() => s.setSpeed(n)}>{n}×</button>)}
          </div>
          <div className="label-caps text-[11px] text-muted-foreground">
            {s.tool.kind === "rail" ? `Laying ${g?.lines[s.tool.line]?.name ?? ""}: click districts` : s.tool.kind === "tube" ? "Pneumatic tube: pick two districts" : "Interchange: pick a district"}
          </div>
          <button className="btn-ghost" onClick={() => s.setMuted(!s.muted)}>{s.muted ? "Sound off" : "Sound on"}</button>
        </div>
        <div className="relative w-full max-w-[1100px]">
          <canvas ref={s.canvasRef} onClick={s.onClick} onMouseMove={s.onMove} onMouseLeave={s.onLeave}
            style={{ aspectRatio: `${CONFIG.canvas.width} / ${CONFIG.canvas.height}` }} className="block w-full cursor-crosshair" />
          {hs && (
            <div className="pointer-events-none absolute left-3 top-3 max-w-xs border border-border bg-card/95 p-3 text-sm">
              <p className="font-display text-base text-brass">{hs.name}</p>
              <p className="label-caps text-[10px] text-muted-foreground">{hs.realName} · {hs.kind}s{hs.interchange ? " · interchange" : ""}</p>
              <p className="mt-1 italic">{hs.lore}</p>
              <p className="mt-1 text-muted-foreground">Waiting {hs.waiting.length}/{g!.capacity(hs)}{hs.services.size ? ` · services: ${[...hs.services].join(", ")}` : ""}</p>
            </div>
          )}
          <div className="pointer-events-none absolute right-3 top-3 flex w-72 flex-col gap-2">
            {s.toasts.map((t) => (
              <div key={t.id} className={`border bg-card/95 p-2.5 text-sm shadow-lg ${t.tone === "warn" ? "border-destructive" : t.tone === "good" ? "border-verdigris" : "border-brass"}`}>
                <p className="font-display">{t.title}</p>
                {t.body && <p className="text-muted-foreground">{t.body}</p>}
              </div>
            ))}
          </div>
        </div>
        <p className="label-caps mt-2 text-[10px] text-muted-foreground">{charter.geography.source}</p>

        {g && g.phase === "picking" && s.weekly && !report && (
          <WeekModal game={g} week={s.weekly.week} feedback={s.weekly.feedback} onPick={(i) => { s.act((gg) => gg.pickOffer(i)); }} />
        )}
        {g && report && <ReportModal game={g} metrics={report} seed={seed} onRetry={() => setRunKey((k) => k + 1)} />}
        {primer && <Primer onClose={() => setPrimer(false)} />}
      </section>
    </main>
  );
}
