/** 2.5D isometric view: world (x,y) is rotated 45° and squashed vertically. Shared by drawing and pointer picking. */
import type { Pt } from '../projection';
const A = Math.SQRT1_2, B = Math.SQRT1_2 * .58, C = -Math.SQRT1_2, D = Math.SQRT1_2 * .58;
const DET = A * D - B * C;
/** Canvas transform arguments (a,b,c,d,e,f) for world → iso screen. */
export const ISO = [A, B, C, D, 0, 0] as const;
/** Inverse linear part; apply at a world point to draw upright billboards. */
export const ISO_INV = [D / DET, -B / DET, -C / DET, A / DET, 0, 0] as const;
export const toIso = ([x, y]: Pt): Pt => [A * x + C * y, B * x + D * y];
export const fromIso = ([x, y]: Pt): Pt => [(D * x - C * y) / DET, (-B * x + A * y) / DET];
/** World-space offset that appears as one screen pixel straight up. */
export const UP: Pt = fromIso([0, -1]);
/** Camera that fits a world-space circle into a viewport. */
export function fitCircle(center: Pt, radius: number, width: number, height: number) {
  const [ix, iy] = toIso(center), hw = radius, hh = radius * Math.hypot(B, D);
  const k = Math.min(width / (2 * hw), height / (2 * hh)) * .92;
  return { k, x: width / 2 - ix * k, y: height / 2 - iy * k };
}
