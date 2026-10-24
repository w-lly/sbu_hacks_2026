import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { runBaseline } from "@/game/baseline";
import type { Game } from "@/game/engine";
import { scoreBreakdown, WEIGHTS } from "@/game/scoring";
import { getEngineerFeedback } from "@/backend/functions/engineer.functions";
import { fallbackFeedback } from "@/shared/engineer-rules";
import type { EngineerFeedback, NetworkMetrics } from "@/shared/types";
import { Btn, Modal } from "./ui";

const PART_LABEL = { service: "Service", coverage: "Coverage", resilience: "Resilience", efficiency: "Track efficiency", survival: "Weeks survived" } as const;

export function ReportModal({ game, metrics, seed, onRetry }: { game: Game; metrics: NetworkMetrics; seed: number; onRetry: () => void }) {
  const result = scoreBreakdown(metrics);
  const [feedback, setFeedback] = useState<EngineerFeedback | null>(null);
  const [baseline, setBaseline] = useState<ReturnType<typeof scoreBreakdown> | null>(null);

  useEffect(() => {
    getEngineerFeedback({ data: { metrics, final: true } }).catch(() => fallbackFeedback(metrics)).then(setFeedback);
    // headless greedy run on the same charter and seed, deferred so the modal paints first
    const t = setTimeout(() => setBaseline(scoreBreakdown(runBaseline(game.charter, seed, Math.max(1, metrics.week)))), 50);
    return () => clearTimeout(t);
  }, [metrics, game, seed]);

  const failed = game.failedStation !== null ? game.stations[game.failedStation]! : null;
  return (
    <Modal wide>
      <p className="label-caps text-xs text-brass">Blueprint report</p>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">{failed ? "Charter revoked" : game.phase === "complete" ? "Charter fulfilled" : "Survey filed"}</h2>
          {failed && <p className="text-sm italic text-destructive">{failed.name} was overrun with waiting riders.</p>}
        </div>
        <div className="text-right">
          <div className="font-display text-6xl leading-none text-brass">{result.grade}</div>
          <div className="label-caps text-xs text-muted-foreground">{result.score} / 100</div>
        </div>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <p className="label-caps mb-2 text-xs text-brass">How the grade was struck</p>
          {(Object.keys(result.parts) as (keyof typeof result.parts)[]).map((k) => (
            <div key={k} className="mb-1.5">
              <div className="flex justify-between text-sm">
                <span>{PART_LABEL[k]} {k in WEIGHTS ? <span className="text-muted-foreground">· {Math.round(WEIGHTS[k as keyof typeof WEIGHTS] * 100)}%</span> : <span className="text-muted-foreground">· multiplier</span>}</span>
                <span className="font-display">{Math.round(result.parts[k] * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted"><div className="h-full bg-primary" style={{ width: `${result.parts[k] * 100}%` }} /></div>
            </div>
          ))}
          {result.transferPenalty > 0 && <p className="text-sm text-destructive">Transfer penalty: −{Math.round(result.transferPenalty)}</p>}
          <div className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
            <Row k="Delivered" v={metrics.delivered} /><Row k="Gave up" v={metrics.stranded} />
            <Row k="Avg trip" v={`${metrics.avgTripSeconds.toFixed(1)}s`} /><Row k="Avg wait" v={`${metrics.avgWaitSeconds.toFixed(1)}s`} />
            <Row k="Transfers/trip" v={metrics.transfersPerTrip.toFixed(2)} /><Row k="Breakdowns" v={metrics.breakdowns} />
            <Row k="Track laid" v={metrics.trackUsed} /><Row k="Depots linked" v={`${metrics.resourcesClaimed}/${metrics.resourcesTotal}`} />
          </div>
          <div className="mt-3 border border-border p-3 text-sm">
            <p className="label-caps text-[11px] text-brass">Versus a greedy surveyor</p>
            {baseline ? (
              <p>A naive nearest-neighbour planner on the same ground scored <b className="font-display">{baseline.grade} ({baseline.score})</b>.{" "}
                {result.score > baseline.score ? "You out-engineered the algorithm." : result.score === baseline.score ? "A dead heat." : "The algorithm beat you this time."}</p>
            ) : <p className="animate-pulse italic text-muted-foreground">Running the comparison…</p>}
          </div>
        </div>
        <div>
          <p className="label-caps mb-2 text-xs text-brass">The Chief Engineer remarks</p>
          {feedback ? (
            <>
              <p className="font-display text-xl">{feedback.headline}</p>
              <ul className="mt-2 space-y-2">{feedback.notes.map((n) => <li key={n} className="border-l-2 border-brass pl-3 italic">{n}</li>)}</ul>
              {feedback.concept && (
                <div className="mt-4 bg-background/50 p-3">
                  <p className="label-caps text-[11px] text-brass">Concept · {feedback.concept.title}</p>
                  <p className="text-sm">{feedback.concept.body}</p>
                </div>
              )}
              <p className="label-caps mt-3 text-[10px] text-muted-foreground">{feedback.source === "ai" ? "Written by AI from your network's numbers" : "Rule-based assessment (AI unavailable)"}</p>
            </>
          ) : <p className="animate-pulse italic text-muted-foreground">The Engineer is reviewing your blueprints…</p>}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Btn variant="brass" className="flex-1" onClick={onRetry}>Survey again</Btn>
        <Link to="/" className="btn-ghost flex-1 text-center">Charters</Link>
      </div>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return <div className="flex justify-between border-b border-border py-1"><span className="text-muted-foreground">{k}</span><span className="font-display">{v}</span></div>;
}
