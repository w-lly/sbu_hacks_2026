/** Rasterises the bundled OpenStreetMap snapshots into coarse fields that seed endless procedural terrain. */
import manhattan from '@/shared/maps/manhattan.json';
import nassau from '@/shared/maps/nassau.json';
import setauket from '@/shared/maps/setauket.json';
import type { MapGeography } from '@/shared/types';
import { pointInRing } from './terrain';
import type { Pt } from './projection';

const RES = 40;
export interface RealField { slug: string; water: Float32Array; woods: Float32Array; elev: Float32Array }
const SOURCES = [setauket, manhattan, nassau] as unknown as MapGeography[];
let cache: RealField[] | null = null;

function rasterise(geo: MapGeography): RealField {
  const [w, s, e, n] = geo.bbox, water = new Float32Array(RES * RES), woods = new Float32Array(RES * RES), elev = new Float32Array(RES * RES);
  const toCell = (ring: Pt[]) => ring.map(([lon, lat]): Pt => [((lon - w) / (e - w)) * RES, ((n - lat) / (n - s)) * RES]);
  const paint = (rings: Pt[][], out: Float32Array) => {
    for (const raw of rings) {
      const ring = toCell(raw); let x0 = RES, x1 = 0, y0 = RES, y1 = 0;
      for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let r = Math.max(0, Math.floor(y0)); r <= Math.min(RES - 1, Math.floor(y1)); r++)
        for (let c = Math.max(0, Math.floor(x0)); c <= Math.min(RES - 1, Math.floor(x1)); c++)
          if (pointInRing(c + .5, r + .5, ring)) out[r * RES + c] = 1;
    }
  };
  paint(geo.water, water); paint(geo.woods, woods); paint(geo.parks, woods);
  const { cols, rows, values } = geo.elevation; const lo = Math.min(...values), hi = Math.max(...values, lo + 1);
  for (let r = 0; r < RES; r++) for (let c = 0; c < RES; c++) {
    const fx = Math.min(cols - 1, (c / RES) * cols), fy = Math.min(rows - 1, (r / RES) * rows);
    const v = values[(rows - 1 - Math.floor(fy)) * cols + Math.floor(fx)] ?? lo;
    elev[r * RES + c] = (v - lo) / (hi - lo);
  }
  return { slug: geo.slug, water: blur(water), woods: blur(woods), elev: blur(blur(elev)) };
}
function blur(a: Float32Array) {
  const out = new Float32Array(a.length);
  for (let r = 0; r < RES; r++) for (let c = 0; c < RES; c++) {
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const rr = r + dy, cc = c + dx; if (rr < 0 || cc < 0 || rr >= RES || cc >= RES) continue; sum += a[rr * RES + cc] ?? 0; n++; }
    out[r * RES + c] = sum / n;
  }
  return out;
}
export function realFields(primary?: string): RealField[] {
  cache ??= SOURCES.map(rasterise);
  const first = cache.find(f => f.slug === primary);
  return first ? [first, ...cache.filter(f => f !== first)] : cache;
}
/** Mirror-tiled bilinear sample: u,v in map-widths, continuous everywhere so terrain never ends at a seam. */
export function sampleReal(f: Float32Array, u: number, v: number) {
  const m = (t: number) => { const k = ((t % 2) + 2) % 2; return (k > 1 ? 2 - k : k) * (RES - 1); };
  const x = m(u), y = m(v), x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(RES - 1, x0 + 1), y1 = Math.min(RES - 1, y0 + 1), tx = x - x0, ty = y - y0;
  const g = (c: number, r: number) => f[r * RES + c] ?? 0;
  return (g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty) + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty;
}
