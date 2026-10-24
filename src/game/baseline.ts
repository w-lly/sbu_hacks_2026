/**
 * Greedy baseline: a naive planner that keeps attaching the nearest unserved district to the nearest
 * line end, opens new lines while locomotives last, and always takes the first weekly offer.
 * Run headless with the same seed to give players a fair "would a simple algorithm beat you?" comparison.
 */
import type { Charter } from "@/shared/types";
import { Game } from "./engine";

export function greedyStep(g: Game) {
  const served = new Set(g.lines.flatMap((l) => l.stops));
  const unserved = g.activeStations.filter((s) => !served.has(s.index));
  for (const s of unserved) {
    let best: { line: number; cost: number } | null = null;
    for (const l of g.railLines()) {
      if (l.stops.length === 0) continue;
      const p = g.planExtend(l.id, s.index);
      if (p.ok && (!best || p.cost! < best.cost)) best = { line: l.id, cost: p.cost! };
    }
    if (best) { g.extend(best.line, s.index); continue; }
    const empty = g.railLines().find((l) => l.stops.length === 0);
    if (!empty || g.inv.locomotives <= 0) continue;
    // anchor a new line at the nearest served station
    const near = [...served].map((i) => g.stations[i]!).sort((a, b) =>
      Math.hypot(a.pos[0] - s.pos[0], a.pos[1] - s.pos[1]) - Math.hypot(b.pos[0] - s.pos[0], b.pos[1] - s.pos[1]))[0];
    const anchor = near ?? g.activeStations.find((x) => x.index !== s.index);
    if (!anchor) continue;
    g.extend(empty.id, anchor.index);
    if (!g.extend(empty.id, s.index).ok) g.clearLine(empty.id);
  }
  // spend spare rolling stock on the longest line
  const longest = [...g.railLines()].sort((a, b) => b.stops.length - a.stops.length)[0];
  if (longest && longest.stops.length > 1) {
    if (g.inv.locomotives > 0 && longest.trains.length < 3) g.addTrain(longest.id);
    if (g.inv.carriages > 0) g.addCarriage(longest.id);
  }
}

export function runBaseline(charter: Charter, seed: number, untilWeek: number, maxSeconds = 600) {
  const g = new Game(charter, seed);
  let t = 0, think = 0;
  const dt = 0.1;
  while (t < maxSeconds && (g.phase === "running" || g.phase === "picking")) {
    if (g.phase === "picking") { if (g.week > untilWeek) break; g.pickOffer(0); }
    think += dt;
    if (think > 1) { think = 0; greedyStep(g); }
    g.step(dt); t += dt;
  }
  return g.metrics();
}
