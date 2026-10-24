import { geoMercator } from "d3-geo";
import type { CharterSummary } from "@/shared/types";

/** Small real-geography preview drawn from the charter's water outlines. */
export function MapThumb({ thumb }: { thumb: CharterSummary["thumbnail"] }) {
  const w = 130, h = 84;
  const [W, S, E, N] = thumb.bbox;
  const proj = geoMercator().fitExtent([[0, 0], [w, h]], { type: "MultiPoint", coordinates: [[W, S], [E, N]] });
  const pts = thumb.preview.map((p) => proj(p)!);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[84px] w-[130px] shrink-0 border border-border bg-parchment">
      {thumb.water.map((ring, i) => (
        <path key={i} className="fill-verdigris/70" d={"M" + ring.map((p) => proj(p)!.join(",")).join("L") + "Z"} />
      ))}
      <polyline points={pts.map((p) => p.join(",")).join(" ")} className="fill-none stroke-rust" strokeWidth={2.5} />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} className="fill-parchment stroke-ink" strokeWidth={1.5} />)}
    </svg>
  );
}
