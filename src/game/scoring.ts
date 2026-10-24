/** Grading. Pure and unit-tested (src/game/scoring.test.ts). */
import type { NetworkMetrics } from "@/shared/types";
import { CONFIG } from "./config";

export type Grade = "A" | "B" | "C" | "D" | "F";

export const WEIGHTS = { service: 0.4, coverage: 0.25, resilience: 0.2, efficiency: 0.15 } as const;
/** Surviving fewer weeks scales the whole score down: week 1 keeps ~43%, a full run keeps 100%. */
export const survivalFactor = (survival: number) => Math.min(1, 0.35 + 0.65 * survival);
export const GRADE_CUTOFFS: [Grade, number][] = [["A", 88], ["B", 78], ["C", 64], ["D", 50]];

export function scoreBreakdown(m: NetworkMetrics) {
  const parts = {
    service: m.serviceRate,
    coverage: m.coverage,
    resilience: m.resilience,
    efficiency: Math.min(1, m.ridersPerTrack / CONFIG.scoring.ridersPerTrackTarget),
    survival: Math.min(1, (m.failed ? m.week - 1 : m.week) / CONFIG.week.total),
  };
  const transferPenalty = Math.max(0, m.transfersPerTrip - 1) * 8;
  const raw = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + WEIGHTS[k] * parts[k], 0) * 100 * survivalFactor(parts.survival);
  const score = Math.min(m.factory && m.linesBuilt < 2 ? 63 : 100, Math.max(0, Math.round(raw - transferPenalty)));
  return { parts, transferPenalty, score, grade: gradeFor(score) };
}

export function gradeFor(score: number): Grade {
  for (const [g, cut] of GRADE_CUTOFFS) if (score >= cut) return g;
  return "F";
}
