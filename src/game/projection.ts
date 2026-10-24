import { geoMercator } from "d3-geo";
import type { LngLat, MapGeography } from "@/shared/types";
import { CONFIG } from "./config";

export type Pt = [number, number];
export interface Projection { project(p: LngLat): Pt; invert(p: Pt): LngLat }

/** Fit the survey bbox to the canvas with Mercator. */
export function makeProjection(bbox: MapGeography["bbox"], width = CONFIG.canvas.width, height = CONFIG.canvas.height): Projection {
  const [w, s, e, n] = bbox;
  const pad = CONFIG.canvas.padding;
  const proj = geoMercator().fitExtent([[pad, pad], [width - pad, height - pad]], {
    type: "MultiPoint", coordinates: [[w, s], [e, s], [e, n], [w, n]],
  });
  return {
    project: (p) => proj(p) as Pt,
    invert: (p) => proj.invert!(p) as LngLat,
  };
}
