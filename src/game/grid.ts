/** Grid geometry shared by rail surveys, pointer previews and moving freight. */
import { CONFIG } from "./config";
import type { Pt } from "./projection";
export const snapPoint = (p: Pt): Pt => p.map(v => Math.round(v / CONFIG.factory.grid) * CONFIG.factory.grid) as Pt;
export const samePoint = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
/** Expand a pointer movement into individual orthogonal grid cells. */
export function gridSteps(a: Pt, b: Pt): Pt[] {
  const target = snapPoint(b), points: Pt[] = []; let p: Pt = [...a];
  while (!samePoint(p, target)) {
    const dx = target[0] - p[0], dy = target[1] - p[1];
    p = Math.abs(dx) >= Math.abs(dy) ? [p[0] + Math.sign(dx) * CONFIG.factory.grid, p[1]] : [p[0], p[1] + Math.sign(dy) * CONFIG.factory.grid];
    points.push(p);
  }
  return points;
}
/** Deterministic shortest grid walk around blocked building footprints. */
export function findGridPath(a: Pt, b: Pt, blocked: (p: Pt) => boolean): Pt[] {
  const key = (p: Pt) => `${p[0]},${p[1]}`;
  const queue: Pt[] = [a], previous = new Map<string, Pt | null>([[key(a), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]; if (!p) continue;
    if (samePoint(p, b)) { const path: Pt[] = []; let q: Pt | null | undefined = p; while (q) { path.push(q); q = previous.get(key(q)); } return path.reverse(); }
    const next: Pt[] = [[p[0]+CONFIG.factory.grid,p[1]],[p[0],p[1]+CONFIG.factory.grid],[p[0],p[1]-CONFIG.factory.grid],[p[0]-CONFIG.factory.grid,p[1]]];
    next.sort((x,y) => Math.abs(x[0]-b[0])+Math.abs(x[1]-b[1])-Math.abs(y[0]-b[0])-Math.abs(y[1]-b[1]));
    for (const q of next) if (!previous.has(key(q)) && !blocked(q)) { previous.set(key(q), p); queue.push(q); }
  }
  return [];
}
export function gridRoute(a: Pt, b: Pt, lane = 0): Pt[] {
  const grid = CONFIG.factory.grid;
  const middle = Math.round((a[0] + b[0]) / 2 / grid) * grid + lane * grid;
  if (Math.abs(a[1] - b[1]) < 1) {
    const y = a[1] + (lane + 1) * grid;
    return [a, [a[0] + grid, a[1]], [a[0] + grid, y], [b[0] - grid, y], [b[0] - grid, b[1]], b];
  }
  return [a, [middle, a[1]], [middle, b[1]], b];
}
export function pointOnRoute(path: Pt[], t: number) {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - (path[i]?.[0] ?? 0), p[1] - (path[i]?.[1] ?? 0)));
  let distance = Math.max(0, Math.min(1, t)) * lengths.reduce((a,b) => a+b, 0);
  for (let i=0;i<lengths.length;i++) {
    const length=lengths[i] ?? 0,a=path[i],b=path[i+1];
    if (!a || !b) continue;
    if (distance <= length || i === lengths.length-1) { const f=length?distance/length:0; return {x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,ang:Math.atan2(b[1]-a[1],b[0]-a[0])}; }
    distance-=length;
  }
  return {x:path[0]?.[0]??0,y:path[0]?.[1]??0,ang:0};
}