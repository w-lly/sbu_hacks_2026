/** Graph utilities over the built lines: routing tables and resilience. Pure functions. */
import type { RiderKind } from "@/shared/types";
import type { Line, Station } from "./entities";

export type Adjacency = Map<number, Set<number>>;

export function buildAdjacency(lines: Line[]): Adjacency {
  const adj: Adjacency = new Map();
  const link = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const l of lines) for (let i = 1; i < l.stops.length; i++) {
    link(l.stops[i - 1]!, l.stops[i]!); link(l.stops[i]!, l.stops[i - 1]!);
  }
  return adj;
}

/**
 * For each rider kind, the next station to move to from every station (multi-source BFS from targets).
 * -1 = unreachable, -2 = already at a station of that kind.
 */
export function buildRoutes(stations: Station[], adj: Adjacency): Record<RiderKind, Int16Array> {
  const kinds: RiderKind[] = ["commuter", "student", "shopper"];
  const out = {} as Record<RiderKind, Int16Array>;
  for (const k of kinds) {
    const dist = new Int16Array(stations.length).fill(-1);
    const next = new Int16Array(stations.length).fill(-1);
    const q: number[] = [];
    for (const s of stations) if (s.active && s.kind === k) { dist[s.index] = 0; next[s.index] = -2; q.push(s.index); }
    while (q.length) {
      const c = q.shift()!;
      for (const n of adj.get(c) ?? []) if (dist[n] === -1) { dist[n] = dist[c]! + 1; next[n] = c; q.push(n); }
    }
    out[k] = next;
  }
  return out;
}

/** Worst-case single-station failure: min over served stations of the share of station pairs still connected. */
export function resilience(adj: Adjacency): number {
  const nodes = [...adj.keys()];
  const n = nodes.length;
  if (n < 3) return n === 2 ? 0.5 : 0;
  const pairs = ((n - 1) * (n - 2)) / 2;
  let worst = 1;
  for (const removed of nodes) {
    const seen = new Set<number>([removed]);
    let connectedPairs = 0;
    for (const start of nodes) {
      if (seen.has(start)) continue;
      let size = 0; const q = [start]; seen.add(start);
      while (q.length) {
        const c = q.pop()!; size++;
        for (const nb of adj.get(c) ?? []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
      }
      connectedPairs += (size * (size - 1)) / 2;
    }
    worst = Math.min(worst, connectedPairs / pairs);
  }
  return worst;
}
