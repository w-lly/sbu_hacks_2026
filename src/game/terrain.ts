/**
 * Rasterised terrain built from real geography: water / woods / wetland / park masks and an elevation field.
 * Pure TS (no DOM) so it runs in tests and in the headless baseline.
 */
import type { MapGeography } from "@/shared/types";
import { CONFIG } from "./config";
import type { Projection, Pt } from "./projection";

export const enum Ground { Land = 0, Water = 1, Woods = 2, Wetland = 3, Park = 4 }

export interface SegmentSurvey {
  length: number;
  /** Track units required (length weighted by ground and grade). */
  cost: number;
  /** Contiguous water runs in px. Each needs a bridge or tunnel. */
  waterRuns: number[];
  /** Max grade (metres per 10px) along the segment. */
  grade: number;
  /** Ground mix for UI. */
  mix: Record<"land" | "woods" | "wetland" | "park" | "water", number>;
}

export class Terrain {
  readonly cols: number; readonly rows: number;
  readonly ground: Uint8Array;
  readonly projected: { water: Pt[][]; woods: Pt[][]; wetland: Pt[][]; parks: Pt[][] };
  private elevGeo: MapGeography["elevation"];
  readonly bounds: { x0: number; y0: number; x1: number; y1: number };

  constructor(geo: MapGeography, readonly proj: Projection, width = CONFIG.canvas.width, height = CONFIG.canvas.height) {
    const cell = CONFIG.terrain.cell;
    this.cols = Math.ceil(width / cell); this.rows = Math.ceil(height / cell);
    this.ground = new Uint8Array(this.cols * this.rows);
    const pr = (rings: MapGeography["water"]) => rings.map((r) => r.map((p) => proj.project(p)));
    this.projected = { water: pr(geo.water), woods: pr(geo.woods), wetland: pr(geo.wetland), parks: pr(geo.parks) };
    this.elevGeo = geo.elevation;
    const [w, s, e, n] = geo.bbox;
    const a = proj.project([w, n]), b = proj.project([e, s]);
    this.bounds = { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
    // Paint lowest priority first so water wins.
    this.paint(this.projected.parks, Ground.Park);
    this.paint(this.projected.woods, Ground.Woods);
    this.paint(this.projected.wetland, Ground.Wetland);
    this.paint(this.projected.water, Ground.Water);
  }

  private paint(rings: Pt[][], value: Ground) {
    const cell = CONFIG.terrain.cell;
    for (const ring of rings) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of ring) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
      const c0 = Math.max(0, Math.floor(minX / cell)), c1 = Math.min(this.cols - 1, Math.floor(maxX / cell));
      const r0 = Math.max(0, Math.floor(minY / cell)), r1 = Math.min(this.rows - 1, Math.floor(maxY / cell));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (pointInRing((c + 0.5) * cell, (r + 0.5) * cell, ring)) this.ground[r * this.cols + c] = value;
      }
    }
  }

  inBounds(x: number, y: number) {
    const b = this.bounds;
    return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  }

  groundAt(x: number, y: number): Ground {
    const cell = CONFIG.terrain.cell;
    const c = Math.floor(x / cell), r = Math.floor(y / cell);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return Ground.Land;
    return this.ground[r * this.cols + c] as Ground;
  }

  isWater(x: number, y: number) { return this.groundAt(x, y) === Ground.Water; }

  /** Bilinear elevation (metres) from the coarse DEM grid. */
  elevationAt(x: number, y: number): number {
    const { cols, rows, values } = this.elevGeo;
    const b = this.bounds;
    const fx = ((x - b.x0) / (b.x1 - b.x0)) * cols - 0.5, fy = ((y - b.y0) / (b.y1 - b.y0)) * rows - 0.5;
    const cx = Math.max(0, Math.min(cols - 1, fx)), cy = Math.max(0, Math.min(rows - 1, fy));
    const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
    const tx = cx - x0, ty = cy - y0;
    // DEM rows run south→north; canvas rows run north→south.
    const v = (c: number, r: number) => values[(rows - 1 - r) * cols + c] ?? 0;
    return (v(x0, y0) * (1 - tx) + v(x1, y0) * tx) * (1 - ty) + (v(x0, y1) * (1 - tx) + v(x1, y1) * tx) * ty;
  }

  survey(a: Pt, b: Pt): SegmentSurvey {
    const t = CONFIG.terrain;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(length / t.sampleStep));
    const step = length / n;
    const mix = { land: 0, woods: 0, wetland: 0, park: 0, water: 0 };
    const waterRuns: number[] = [];
    let cost = 0, run = 0, grade = 0, prevElev = this.elevationAt(a[0], a[1]);
    for (let i = 1; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * (i - 0.5)) / n, y = a[1] + ((b[1] - a[1]) * (i - 0.5)) / n;
      const g = this.groundAt(x, y);
      const elev = this.elevationAt(x, y);
      const g10 = Math.min(3, (Math.abs(elev - prevElev) / step) * 10);
      prevElev = elev;
      if (g === Ground.Water) { run += step; mix.water += step; cost += step; continue; }
      if (run > 0) { waterRuns.push(run); run = 0; }
      grade = Math.max(grade, g10);
      const mult = (g === Ground.Woods ? t.woodsMult : g === Ground.Wetland ? t.wetlandMult : g === Ground.Park ? t.parkMult : 1) + g10 * t.gradeMult;
      mix[g === Ground.Woods ? "woods" : g === Ground.Wetland ? "wetland" : g === Ground.Park ? "park" : "land"] += step;
      cost += step * mult;
    }
    if (run > 0) waterRuns.push(run);
    return { length, cost: Math.round(cost), waterRuns, grade, mix };
  }

  /** Nearest dry cell to a point (stations that fall in water due to coarse data get nudged ashore). */
  nearestLand(p: Pt): Pt {
    if (!this.isWater(p[0], p[1])) return p;
    for (let r = 4; r < 120; r += 4) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r;
      if (!this.isWater(x, y) && this.inBounds(x, y)) return [x, y];
    }
    return p;
  }
}

export function pointInRing(x: number, y: number, ring: Pt[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
