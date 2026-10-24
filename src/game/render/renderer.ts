/** Draws the live simulation each frame on top of the cached terrain layer. */
import type { RiderKind } from "@/shared/types";
import { CONFIG } from "../config";
import { isLoop, type ExtendPlan, type Game } from "../engine";
import type { Line, ResourceKind } from "../entities";
import type { Pt } from "../projection";
import { PALETTE } from "./palette";
import { renderTerrainLayer } from "./terrainLayer";

export interface Overlay {
  hoverStation: number;
  ghost: { from: Pt; to: Pt; plan: ExtendPlan; color: string } | null;
  selectedLine: number | null;
  tubeFrom: number | null;
}

interface Puff { x: number; y: number; r: number; life: number }
interface Pulse { x: number; y: number; t: number; color: string }

export class Renderer {
  private terrain: HTMLCanvasElement;
  private puffs: Puff[] = [];
  private pulses: Pulse[] = [];
  private puffT = 0;

  constructor(private ctx: CanvasRenderingContext2D, private game: Game, dpr = 1) {
    this.terrain = renderTerrainLayer(game, CONFIG.canvas.width, CONFIG.canvas.height, dpr);
    game.on((e) => {
      if (e.type === "deliver") { const s = game.stations[e.station]!; this.pulse(s.pos, PALETTE.brass); }
      if (e.type === "claim" || e.type === "scenario" || e.type === "reveal") { const s = game.stations[e.station]!; this.pulse(s.pos, PALETTE.danger); }
    });
  }

  private pulse(p: Pt, color: string) { this.pulses.push({ x: p[0], y: p[1], t: 0, color }); }

  draw(dt: number, o: Overlay) {
    const { ctx, game } = this;
    const { width: W, height: H } = CONFIG.canvas;
    ctx.drawImage(this.terrain, 0, 0, W, H);
    this.drawResources();
    for (const l of game.lines) this.drawLine(l, l.id === o.selectedLine);
    if (o.ghost) this.drawGhost(o.ghost);
    this.drawStations(o);
    this.drawTrains(dt);
    this.drawPulses(dt);
    this.drawClock();
  }

  private drawResources() {
    const { ctx, game } = this;
    for (const r of game.resources) {
      const [x, y] = r.pos;
      ctx.save();
      ctx.globalAlpha = r.spent && r.kind === "foundry" ? 0.4 : 1;
      if (r.claimedBy !== null) {
        const s = game.stations[r.claimedBy]!;
        ctx.strokeStyle = PALETTE.inkSoft; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(s.pos[0], s.pos[1]); ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "rgba(58,42,28,0.15)"; ctx.beginPath(); ctx.arc(x, y, CONFIG.resources.claimRadius, 0, Math.PI * 2); ctx.stroke();
      }
      resourceIcon(ctx, r.kind, x, y);
      ctx.restore();
    }
  }

  private drawLine(l: Line, selected: boolean) {
    const { ctx, game } = this;
    if (l.stops.length < 2) {
      if (l.stops.length === 1) {
        const s = game.stations[l.stops[0]!]!;
        ctx.strokeStyle = l.color; ctx.lineWidth = 3; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(s.pos[0], s.pos[1], 18, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      return;
    }
    const pts = l.stops.map((i) => game.stations[i]!.pos);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (selected) { ctx.strokeStyle = "rgba(201,151,63,0.5)"; ctx.lineWidth = 14; poly(ctx, pts); ctx.stroke(); }
    if (l.type === "tube") {
      ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 9; poly(ctx, pts); ctx.stroke();
      ctx.strokeStyle = l.color; ctx.lineWidth = 6; ctx.setLineDash([8, 5]); poly(ctx, pts); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = PALETTE.ink; ctx.lineWidth = 8; poly(ctx, pts); ctx.stroke();
      ctx.strokeStyle = l.color; ctx.lineWidth = 5.5; poly(ctx, pts); ctx.stroke();
      // sleepers
      ctx.strokeStyle = "rgba(58,42,28,0.55)"; ctx.lineWidth = 1;
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1]!, pts[i]!]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
        for (let d = 8; d < len - 8; d += 9) {
          const x = a[0] + ((b[0] - a[0]) * d) / len, y = a[1] + ((b[1] - a[1]) * d) / len;
          ctx.beginPath(); ctx.moveTo(x - nx * 5, y - ny * 5); ctx.lineTo(x + nx * 5, y + ny * 5); ctx.stroke();
        }
      }
      // crossings
      l.segments.forEach((seg) => {
        if (!seg.crossings.length) return;
        const a = game.stations[seg.a]!.pos, b = game.stations[seg.b]!.pos;
        const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ctx.font = "600 10px 'Barlow Condensed', sans-serif"; ctx.textAlign = "center";
        ctx.fillStyle = PALETTE.parchment; ctx.fillRect(mid[0] - 20, mid[1] - 18, 40, 12);
        ctx.fillStyle = PALETTE.ink; ctx.fillText(seg.crossings.map((c) => c.toUpperCase()).join("+"), mid[0], mid[1] - 9);
      });
    }
    if (isLoop(l)) {
      const p = pts[0]!; ctx.fillStyle = l.color; ctx.font = "600 10px 'Barlow Condensed'"; ctx.fillText("LOOP", p[0], p[1] - 24);
    }
  }

  private drawGhost(g: NonNullable<Overlay["ghost"]>) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.75; ctx.setLineDash([6, 6]); ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.strokeStyle = g.plan.ok ? g.color : PALETTE.danger;
    ctx.beginPath(); ctx.moveTo(g.from[0], g.from[1]); ctx.lineTo(g.to[0], g.to[1]); ctx.stroke();
    ctx.restore();
    const label = g.plan.ok
      ? `${g.plan.cost ?? 0} track${g.plan.crossings?.length ? " · " + g.plan.crossings.join(", ") : ""}${g.plan.survey && g.plan.survey.grade > 1.2 ? " · steep" : ""}`
      : g.plan.error ?? "";
    const mx = (g.from[0] + g.to[0]) / 2, my = (g.from[1] + g.to[1]) / 2;
    ctx.font = "600 12px 'Barlow Condensed', sans-serif";
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = "rgba(42,31,22,0.88)"; ctx.fillRect(mx - w / 2, my + 8, w, 18);
    ctx.fillStyle = g.plan.ok ? PALETTE.parchment : "#f0b9a8"; ctx.textAlign = "center"; ctx.fillText(label, mx, my + 21);
  }

  private drawStations(o: Overlay) {
    const { ctx, game } = this;
    ctx.textAlign = "center";
    for (const s of game.stations) {
      if (!s.active) continue;
      const [x, y] = s.pos;
      const cap = game.capacity(s);
      if (s.overload > 0) {
        ctx.strokeStyle = PALETTE.danger; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 21, -Math.PI / 2, -Math.PI / 2 + (s.overload / CONFIG.station.failSeconds) * Math.PI * 2); ctx.stroke();
      }
      if (game.activeEvents.some((e) => e.station === s.index)) {
        ctx.strokeStyle = PALETTE.brass; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(x, y, 26 + Math.sin(game.time * 4) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      const r = s.interchange ? 14 : 11;
      if (s.interchange) { shape(ctx, s.kind, x, y, r + 4); ctx.fillStyle = PALETTE.ink; ctx.fill(); }
      shape(ctx, s.kind, x, y, r);
      ctx.fillStyle = s.index === o.tubeFrom ? PALETTE.brass : PALETTE.station; ctx.fill();
      ctx.strokeStyle = s.index === o.hoverStation ? PALETTE.brass : PALETTE.ink; ctx.lineWidth = 3; ctx.stroke();
      // services
      [...s.services].forEach((k, i) => resourceIcon(ctx, k, x - 14 + i * 10, y - 22, 0.55));
      ctx.font = "600 12px 'EB Garamond', serif";
      const label = s.name;
      const w = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(233,219,184,0.85)"; ctx.fillRect(x - w / 2 - 3, y + 17, w + 6, 15);
      ctx.fillStyle = PALETTE.ink; ctx.fillText(label, x, y + 28);
      // waiting riders
      const over = s.waiting.length > cap;
      s.waiting.slice(0, 18).forEach((p, i) => {
        shape(ctx, p.want, x + 19 + (i % 6) * 8, y - 10 + Math.floor(i / 6) * 8, 2.8);
        ctx.fillStyle = over ? PALETTE.danger : PALETTE.ink; ctx.fill();
      });
    }
  }

  private drawTrains(dt: number) {
    const { ctx, game } = this;
    this.puffT += dt;
    const emit = this.puffT > 0.12;
    if (emit) this.puffT = 0;
    for (const l of game.lines) for (const tr of l.trains) {
      if (l.stops.length < 2) continue;
      const { x, y, ang } = game.trainPos(l, tr);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      const len = l.type === "tube" ? 18 : 22 + l.carriages * 6;
      ctx.fillStyle = PALETTE.ink; roundRect(ctx, -len / 2, -7, len, 14, 3); ctx.fill();
      ctx.fillStyle = l.color; roundRect(ctx, -len / 2 + 2, -5, len - 4, 10, 2); ctx.fill();
      const cap = game.trainCapacity(l);
      ctx.fillStyle = PALETTE.station;
      for (let i = 0; i < tr.cargo.length; i++) {
        const col = i % Math.ceil(cap / 2), row = Math.floor(i / Math.ceil(cap / 2));
        ctx.fillRect(-len / 2 + 4 + col * 4, -3 + row * 4, 2.6, 2.6);
      }
      if (tr.brokenFor > 0) { ctx.fillStyle = PALETTE.danger; ctx.font = "bold 12px serif"; ctx.fillText("!", 0, -10); }
      else if (l.type === "rail" && tr.coal <= 0) { ctx.fillStyle = PALETTE.danger; ctx.fillRect(-3, -12, 6, 3); }
      ctx.restore();
      if (emit && l.type === "rail" && tr.dwell <= 0 && tr.brokenFor <= 0) {
        this.puffs.push({ x: x + Math.cos(ang) * (len / 2) * tr.dir, y: y + Math.sin(ang) * (len / 2) * tr.dir, r: 3, life: 1 });
      }
      if (emit && tr.brokenFor > 0) this.puffs.push({ x, y, r: 5, life: 1.2 });
    }
    ctx.fillStyle = PALETTE.steam;
    this.puffs = this.puffs.filter((p) => (p.life -= dt) > 0);
    for (const p of this.puffs) {
      p.r += dt * 9; p.y -= dt * 10;
      ctx.globalAlpha = Math.max(0, p.life) * 0.8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawPulses(dt: number) {
    const { ctx } = this;
    this.pulses = this.pulses.filter((p) => (p.t += dt) < 0.8);
    for (const p of this.pulses) {
      ctx.strokeStyle = p.color; ctx.globalAlpha = 1 - p.t / 0.8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 12 + p.t * 30, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawClock() {
    const { ctx, game } = this;
    const h = game.hourOfDay;
    const night = h < 5 || h >= 21 ? 0.22 : h < 6.5 || h >= 19.5 ? 0.12 : 0;
    if (night) { ctx.fillStyle = `rgba(20,25,45,${night})`; ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height); }
  }
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
export function shape(ctx: CanvasRenderingContext2D, kind: RiderKind, x: number, y: number, r: number) {
  ctx.beginPath();
  if (kind === "commuter") ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === "student") ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
  else { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.1, y + r * 0.8); ctx.lineTo(x - r * 1.1, y + r * 0.8); ctx.closePath(); }
}
export function resourceIcon(ctx: CanvasRenderingContext2D, kind: ResourceKind, x: number, y: number, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = PALETTE.resource[kind]; ctx.strokeStyle = PALETTE.parchment; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (kind === "coal") { ctx.moveTo(-8, 4); ctx.lineTo(-4, -6); ctx.lineTo(3, -7); ctx.lineTo(8, 2); ctx.lineTo(2, 7); ctx.closePath(); }
  else if (kind === "barracks") { ctx.moveTo(-8, 7); ctx.lineTo(-8, -2); ctx.lineTo(0, -8); ctx.lineTo(8, -2); ctx.lineTo(8, 7); ctx.closePath(); }
  else if (kind === "repair") { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a + 0.4) * 5.5, Math.sin(a + 0.4) * 5.5); } ctx.closePath(); }
  else { ctx.rect(-8, -3, 16, 10); ctx.rect(2, -9, 4, 6); }
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
