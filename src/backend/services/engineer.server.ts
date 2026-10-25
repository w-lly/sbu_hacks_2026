/** Chief Engineer: AI critique of network metrics, with rule-based fallback. Server-only. */
import type { EngineerFeedback, NetworkMetrics } from "@/shared/types";
import { fallbackFeedback } from "@/shared/engineer-rules";
import { askJson } from "./ai.server";

const SYSTEM = `You are the Chief Engineer of a Gilded Age industrial freight company. Speak in a crisp, slightly Victorian voice.
When metrics.factory is present, this is a factory logistics game, not a passenger game. Delivered means freight crates;
stranded means missed contract units; waitingNow means stored crates; ridersPerTrack means crates per track unit.
Players place collection hubs within range of coal, iron and timber deposits, then connect rail lines to pre-spawned companies.
Foundries consume 2 iron + 1 coal to produce 2 steel; sawmills consume 2 timber to produce 2 planks;
machine works consume 2 steel + 1 plank to produce machinery; exporters buy machinery and planks.
Diagnose supply-chain starvation, freight capacity, company coverage, production, timed contracts and routing bottlenecks.
Trains do not require fuel, crew shifts or repairs in factory mode. Never mention passenger shapes, crowds or rider abandonment.
For legacy metrics, diagnose headways, redundancy, coverage and transfers.
Cite specific numbers. Be concrete about what to build next. Keep each note under 35 words.
For the final report you also get "snapshot" (player state, difficulty, perf) and "baseline" (rule-based score 0-100 and parts).
Then grade the run: harder difficulty and fewer missed orders earn credit; stay within ±12 of the baseline score unless the stats strongly justify it.
Final-report JSON adds "grade": {"letter": "A"|"B"|"C"|"D"|"F", "score": integer 0-100, "rationale": string (max 25 words)}.
JSON shape: {"headline": string (max 12 words), "notes": string[] (2-4 items), "concept": {"title": string, "body": string (max 45 words)}}`;

export async function critiqueNetwork(m: NetworkMetrics, final: boolean, extra?: { snapshot?: unknown; baseline?: unknown }): Promise<EngineerFeedback> {
  const raw = await askJson<Partial<EngineerFeedback>>(SYSTEM, JSON.stringify({ stage: final ? "final report" : `end of week ${m.week}`, metrics: m, ...(final ? extra : {}) }));
  const notes = Array.isArray(raw?.notes) ? raw.notes.filter((n): n is string => typeof n === "string").slice(0, 4) : [];
  if (!raw || typeof raw.headline !== "string" || !notes.length) return fallbackFeedback(m);
  const concept = raw.concept && typeof raw.concept.title === "string" && typeof raw.concept.body === "string"
    ? { title: raw.concept.title.slice(0, 60), body: raw.concept.body.slice(0, 300) } : undefined;
  const g = raw.grade, score = Math.round(Number(g?.score));
  const grade = final && g && ["A", "B", "C", "D", "F"].includes(g.letter) && Number.isFinite(score) ? { letter: g.letter, score: Math.max(0, Math.min(100, score)), rationale: String(g.rationale ?? "").slice(0, 200) } : undefined;
  return { headline: raw.headline.slice(0, 90), notes: notes.map((n) => n.slice(0, 240)), concept, grade, source: "ai" };
}
