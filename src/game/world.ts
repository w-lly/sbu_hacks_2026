/** Seeded continuous terrain blended from real OSM snapshots and value noise; contour polygons are shared by drawing and collision checks. */
import { contours } from 'd3-contour';
import type { MapGeography } from '@/shared/types';
import { CONFIG } from './config';
import { Rng } from './rng';
import { realFields, sampleReal } from './realSeed';
import type { Pt } from './projection';
export type Biome = 'meadow' | 'forest' | 'hills' | 'marsh' | 'water';
export interface WorldTile { center: Pt; biome: Biome; ring: Pt[] }

function hash(x: number, y: number, s: number) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x: number, y: number, s: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
export function fbm(x: number, y: number, s: number) { let v = 0, amp = .5, f = 1; for (let o = 0; o < 4; o++) { v += amp * noise(x * f, y * f, s + o * 31); amp *= .5; f *= 2; } return v / .9375 - .5; }

export function generateWorld(seed: number, primary?: string) {
  const rng = new Rng(seed), width = CONFIG.factory.worldWidth, height = CONFIG.factory.worldHeight;
  const cell = CONFIG.factory.grid, cols = width / cell, rows = height / cell, span = CONFIG.factory.realTileSpan;
  const maps = realFields(primary), offsets = maps.map(() => [rng.next() * 2, rng.next() * 2] as const), s = Math.floor(rng.next() * 1e6);
  const cx = width / 2, cy = height / 2;
  const fields: Record<'water'|'forest'|'hills', Float32Array> = { water: new Float32Array(cols*rows), forest: new Float32Array(cols*rows), hills: new Float32Array(cols*rows) };
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = (col + .5) * cell, y = (row + .5) * cell, i = row * cols + col;
    // Low-frequency weights choose which real place dominates each region; the primary map anchors the start.
    const dist = Math.hypot(x - cx, y - cy) / span;
    const raw = maps.map((_, m) => m === 0 ? 1.4 - dist * .6 : .6 + fbm(x / span * 1.3, y / span * 1.3, s + m * 97) * 2);
    let total = 0; const w = raw.map(v => { const e = Math.exp(Math.max(-4, Math.min(4, v * 3))); total += e; return e; });
    let water = 0, woods = 0, elev = 0;
    maps.forEach((f, m) => { const u = (x - cx) / span + .5 + (m ? (offsets[m]?.[0] ?? 0) : 0), v = (y - cy) / span + .5 + (m ? (offsets[m]?.[1] ?? 0) : 0), k = (w[m] ?? 0) / total; water += k * sampleReal(f.water, u, v); woods += k * sampleReal(f.woods, u, v); elev += k * sampleReal(f.elev, u, v); });
    const n1 = fbm(x / 420, y / 420, s), n2 = fbm(x / CONFIG.factory.hillsNoiseSpan, y / CONFIG.factory.hillsNoiseSpan, s + 7), n3 = fbm(x / 340, y / 340, s + 13);
    const spawnCalm = Math.max(0, 1 - Math.hypot(x - cx, y - cy) / 520) * .5;
    fields.water[i] = water * 1.5 + n1 * .9 - .62 - spawnCalm;
    fields.hills[i] = elev * 1.3 + n2 * 1.1 - CONFIG.factory.hillsThreshold - spawnCalm - Math.max(0, water - .3);
    fields.forest[i] = woods * 1.2 + n3 * 1.4 - .25;
  }
  const rings = (values: Float32Array): Pt[][] => contours().size([cols, rows]).thresholds([0])(Array.from(values)).flatMap(shape => shape.coordinates.flatMap(polygon => polygon.slice(0, 1).map(ring => ring.map(([x = 0, y = 0]): Pt => [x * cell, y * cell]))));
  const water = rings(fields.water), hills = rings(fields.hills), woods = rings(fields.forest);
  const tiles: WorldTile[] = [];
  for (const [biome, regions] of [['forest', woods], ['hills', hills], ['water', water]] as const) for (const ring of regions) tiles.push({ biome, ring, center: ring[0] ?? [0, 0] });
  const sample = (f: Float32Array, x: number, y: number) => {
    const fx = Math.max(0, Math.min(cols - 1, x / cell - .5)), fy = Math.max(0, Math.min(rows - 1, y / cell - .5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1), tx = fx - x0, ty = fy - y0, g = (c: number, r: number) => f[r * cols + c] ?? 0;
    return (g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty) + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty;
  };
  const isWater = (x: number, y: number) => sample(fields.water, x, y) > 0;
  const isMountain = (x: number, y: number) => !isWater(x, y) && sample(fields.hills, x, y) > 0;
  const isForest = (x: number, y: number) => sample(fields.forest, x, y) > 0;
  const height01 = (x: number, y: number) => Math.max(0, sample(fields.hills, x, y));
  const geography: MapGeography = { slug: 'generated', bbox: [0, height, width, 0], water, woods, wetland: [], parks: [], elevation: { cols: 1, rows: 1, values: [0] }, source: 'Procedural terrain seeded by © OpenStreetMap contributors' };
  return { tiles, geography, isWater, isMountain, isForest, height01, projection: { project: (p: Pt): Pt => p, invert: (p: Pt): Pt => p } };
}
