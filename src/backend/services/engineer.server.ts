/** Chief Engineer: AI critique of network metrics, with rule-based fallback. Server-only. */
import type { EngineerFeedback, NetworkMetrics } from "@/shared/types";
import { fallbackFeedback } from "@/shared/engineer-rules";
import { askJson } from "./ai.server";

const SYSTEM = `You are the Chief Engineer of a Gilded Age transit company. Speak in a crisp, slightly Victorian voice.
You receive metrics about the player's rail network. Diagnose its real weaknesses using transit-planning concepts
(hub-and-spoke vs grid, headways, redundancy, coverage, transfers, express vs local, fuel and maintenance logistics).
Cite specific numbers. Be concrete about what to build next. Keep each note under 35 words.
JSON shape: {"headline": string (max 12 words), "notes": string[] (2-4 items), "concept": {"title": string, "body": string (max 45 words)}}`;

export async function critiqueNetwork(m: NetworkMetrics, final: boolean): Promise<EngineerFeedback> {
  const raw = await askJson<Partial<EngineerFeedback>>(SYSTEM, JSON.stringify({ stage: final ? "final report" : `end of week ${m.week}`, metrics: m }));
  const notes = Array.isArray(raw?.notes) ? raw!.notes.filter((n): n is string => typeof n === "string").slice(0, 4) : [];
  if (!raw || typeof raw.headline !== "string" || !notes.length) return fallbackFeedback(m);
  const concept = raw.concept && typeof raw.concept.title === "string" && typeof raw.concept.body === "string"
    ? { title: raw.concept.title.slice(0, 60), body: raw.concept.body.slice(0, 300) } : undefined;
  return { headline: raw.headline.slice(0, 90), notes: notes.map((n) => n.slice(0, 240)), concept, source: "ai" };
}
