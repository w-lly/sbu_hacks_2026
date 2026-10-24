/** Deterministic Chief Engineer used when the AI is unavailable (and as a client-side instant preview). */
import type { EngineerFeedback, NetworkMetrics } from "./types";
import { CONCEPTS } from "./concepts";

export function fallbackFeedback(m: NetworkMetrics): EngineerFeedback {
  const notes: string[] = [];
  let concept: { title: string; body: string } = CONCEPTS.coverage;
  if (m.coverage < 0.75) {
    notes.push(`Only ${pct(m.coverage)} of chartered districts are on a line. Unserved districts fill up and riders abandon the trip.`);
  }
  if (m.resilience < 0.6 && m.linesBuilt > 0) {
    notes.push(`Close ${m.busiestHub} and ${pct(1 - m.resilience)} of your stations are cut off. Add a second line or a loop for redundancy.`);
    concept = CONCEPTS.redundancy;
  }
  if (m.hubShare > 0.5 && m.transfersPerTrip > 0.3) {
    notes.push(`${pct(m.hubShare)} of all transfers happen at ${m.busiestHub}. One delay there strands the city. Spread the interchange load.`);
    concept = CONCEPTS.hubSpoke;
  }
  if (m.transfersPerTrip > 0.9) {
    notes.push(`Riders change trains ${m.transfersPerTrip.toFixed(1)} times per trip. Longer through-lines trade track for fewer transfers.`);
    concept = CONCEPTS.transfers;
  }
  if (m.avgWaitSeconds > 14) {
    notes.push(`Average wait on the platform is ${m.avgWaitSeconds.toFixed(0)}s. Add locomotives to shorten headways on your busiest line.`);
    concept = CONCEPTS.headway;
  }
  if (m.outOfCoalSeconds > 20) {
    notes.push(`Trains crawled for ${m.outOfCoalSeconds.toFixed(0)} engine-seconds without coal. Route a line past a coal depot.`);
    concept = CONCEPTS.logistics;
  }
  if (m.breakdowns > 2) notes.push(`${m.breakdowns} breakdowns this run. A line through a repair yard keeps boilers sound.`);
  if (m.stranded > m.delivered * 0.25) notes.push(`${m.stranded} riders gave up waiting against ${m.delivered} delivered. Capacity is not keeping pace with demand.`);
  if (!notes.length) notes.push("Load is spread, trips are short and transfers are rare. The board is pleased; now grow without losing that balance.");
  const headline = m.failed ? "The network buckled under its own crowds" : m.serviceRate > 0.85 && m.coverage > 0.85 ? "A sound and well-balanced network" : "Workable, but the joints are straining";
  return { headline, notes: notes.slice(0, 4), concept, source: "fallback" };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
