/** Pre-renders the static map (terrain, contours, water) to an offscreen canvas once per game. */
import { contours } from "d3-contour";
import type { Game } from "../engine";
import type { Pt } from "../projection";
import { PALETTE } from "./palette";

export function renderTerrainLayer(game: Pick<Game, "terrain" | "charter">, width: number, height: number, scale = 1): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = width * scale; cv.height = height * scale;
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  ctx.scale(scale, scale);
  const { terrain } = game;
  const b = terrain.bounds;

  ctx.fillStyle = PALETTE.outside; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = PALETTE.parchment; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.save();
  ctx.beginPath(); ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.clip();

  // elevation tint + contours
  const elev = game.charter.geography.elevation;
  const flipped: number[] = [];
  for (let r = elev.rows - 1; r >= 0; r--) for (let c = 0; c < elev.cols; c++) flipped.push(elev.values[r * elev.cols + c] ?? 0);
  const max = Math.max(...flipped, 1);
  const sx = (b.x1 - b.x0) / elev.cols, sy = (b.y1 - b.y0) / elev.rows;
  const toCanvas = ([x, y]: number[]): Pt => [b.x0 + x! * sx, b.y0 + y! * sy];
  const levels = contours().size([elev.cols, elev.rows]).thresholds(Array.from({ length: 10 }, (_, i) => ((i + 1) * max) / 11))(flipped);
  levels.forEach((lvl, i) => {
    ctx.beginPath();
    for (const poly of lvl.coordinates) for (const ring of poly) ring.forEach((p, k) => {
      const [x, y] = toCanvas(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.fillStyle = `rgba(150,105,55,${0.025 + i * 0.004})`; ctx.fill("evenodd");
    ctx.strokeStyle = PALETTE.contour; ctx.lineWidth = i % 3 === 2 ? 1.2 : 0.6; ctx.stroke();
  });

  // survey grid
  ctx.strokeStyle = PALETTE.grid; ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 50) line(ctx, [x, 0], [x, height]);
  for (let y = 0; y < height; y += 50) line(ctx, [0, y], [width, y]);

  fillRings(ctx, terrain.projected.parks, PALETTE.park);
  fillRings(ctx, terrain.projected.woods, PALETTE.woods);
  hatch(ctx, terrain.projected.woods, PALETTE.woodsHatch, 7);
  fillRings(ctx, terrain.projected.wetland, PALETTE.wetland);
  stipple(ctx, terrain.projected.wetland);

  fillRings(ctx, terrain.projected.water, PALETTE.water);
  // shoreline ripples
  ctx.strokeStyle = PALETTE.waterLine; ctx.lineWidth = 1;
  for (const off of [3, 7]) {
    ctx.save(); ctx.translate(0, off);
    strokeRings(ctx, terrain.projected.water);
    ctx.restore();
  }
  ctx.strokeStyle = PALETTE.inkSoft; ctx.lineWidth = 1.2; strokeRings(ctx, terrain.projected.water);
  ctx.restore();

  // frame, compass, scale
  ctx.strokeStyle = PALETTE.brass; ctx.lineWidth = 2; ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.lineWidth = 0.6; ctx.strokeRect(b.x0 + 5, b.y0 + 5, b.x1 - b.x0 - 10, b.y1 - b.y0 - 10);
  compass(ctx, b.x1 - 50, b.y0 + 55);
  return cv;
}

function line(ctx: CanvasRenderingContext2D, a: Pt, b: Pt) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
function path(ctx: CanvasRenderingContext2D, rings: Pt[][]) {
  ctx.beginPath();
  for (const r of rings) r.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}
function fillRings(ctx: CanvasRenderingContext2D, rings: Pt[][], color: string) { path(ctx, rings); ctx.fillStyle = color; ctx.fill(); }
function strokeRings(ctx: CanvasRenderingContext2D, rings: Pt[][]) { path(ctx, rings); ctx.stroke(); }
function hatch(ctx: CanvasRenderingContext2D, rings: Pt[][], color: string, gap: number) {
  ctx.save(); path(ctx, rings); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = 0.7;
  for (let d = -800; d < 1900; d += gap) line(ctx, [d, 0], [d + 700, 700]);
  ctx.restore();
}
function stipple(ctx: CanvasRenderingContext2D, rings: Pt[][]) {
  ctx.save(); path(ctx, rings); ctx.clip(); ctx.fillStyle = "rgba(60,80,60,0.4)";
  for (let y = 0; y < 700; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 1100; x += 6) ctx.fillRect(x, y, 1, 1);
  ctx.restore();
}
function compass(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = PALETTE.ink; ctx.fillStyle = PALETTE.ink; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(4, 0); ctx.lineTo(-4, 0); ctx.closePath();
    i === 3 ? ctx.fill() : ctx.stroke();
  }
  ctx.font = "600 11px 'Cinzel', serif"; ctx.textAlign = "center"; ctx.fillText("N", 0, -30);
  ctx.restore();
}
