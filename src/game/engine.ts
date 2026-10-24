/**
 * The simulation. Framework-free: the UI drives it with step(dt) and reads its public state.
 * Rendering lives in src/game/render, React UI in src/components/game.
 */
import type { Charter, NetworkMetrics, RiderKind, ScenarioEvent } from "@/shared/types";
import { CONFIG } from "./config";
import { timeOfDayMultiplier } from "./demand";
import type {
  CrossingKind, GameEvent, Inventory, Line, LineType, Offer, ResourceKind, ResourceNode, Rider, Segment, Station, Train,
} from "./entities";
import { buildAdjacency, buildRoutes, resilience } from "./network";
import { drawOffers } from "./offers";
import { makeProjection, type Projection, type Pt } from "./projection";
import { Rng } from "./rng";
import { Terrain, type SegmentSurvey } from "./terrain";

export const RAIL_COLORS = ["#b5532f", "#2f7f7a", "#c9a032", "#6b4f8f", "#3d6e3a"];
export const TUBE_COLOR = "#9a7b4f";
const KINDS: RiderKind[] = ["commuter", "student", "shopper"];

export type Phase = "running" | "picking" | "failed" | "complete";

export interface ExtendPlan {
  ok: boolean; error?: string; from?: number; atHead?: boolean;
  survey?: SegmentSurvey; crossings?: CrossingKind[]; cost?: number;
}

export class Game {
  readonly proj: Projection;
  readonly terrain: Terrain;
  readonly stations: Station[];
  readonly lines: Line[] = [];
  readonly resources: ResourceNode[] = [];
  readonly inv: Inventory;
  readonly rng: Rng;
  phase: Phase = "running";
  offers: Offer[] = [];
  time = 0; week = 1; weekTime = 0;
  failedStation: number | null = null;
  activeEvents: { station: number; mult: number; until: number; title: string }[] = [];

  // stats
  spawned = 0; delivered = 0; stranded = 0; tripTimeSum = 0; transferSum = 0;
  boardings = 0; waitSum = 0; breakdowns = 0; outOfCoal = 0; trackUsed = 0;

  private routes: Record<RiderKind, Int16Array> | null = null;
  private revealT = 0; private nextTrainId = 1; private nextResId = 1;
  private spawnAcc: number[];
  private firedEvents = new Set<ScenarioEvent>();
  private listeners = new Set<(e: GameEvent) => void>();

  constructor(readonly charter: Charter, seed = Date.now()) {
    this.rng = new Rng(seed);
    this.proj = makeProjection(charter.geography.bbox);
    this.terrain = new Terrain(charter.geography, this.proj);
    this.inv = { ...charter.start };
    const names = new Map(charter.scenario.districts.map((d) => [d.id, d]));
    this.stations = charter.districts.map((d, i) => ({
      index: i, id: d.id, realName: d.realName, kind: d.kind, demand: d.demand,
      name: names.get(d.id)?.name ?? d.realName, lore: names.get(d.id)?.lore ?? "",
      pos: this.terrain.nearestLand(this.proj.project([d.lng, d.lat])),
      active: false, interchange: false, waiting: [], overload: 0, transfers: 0, services: new Set(),
    }));
    this.spawnAcc = this.stations.map(() => 0);
    // first stations: one of each kind
    for (const k of KINDS) { const s = this.stations.find((st) => st.kind === k && !st.active); if (s) s.active = true; }
    for (let i = 0; i < 5; i++) this.lines.push(this.newLine("rail", i));
    const init = CONFIG.resources.initial;
    (Object.keys(init) as ResourceKind[]).forEach((k) => { for (let i = 0; i < init[k]; i++) this.spawnResource(k); });
  }

  // ---------- events ----------
  on(fn: (e: GameEvent) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(e: GameEvent) { this.listeners.forEach((l) => l(e)); }

  // ---------- queries ----------
  get activeStations() { return this.stations.filter((s) => s.active); }
  get hour() { return ((this.time % CONFIG.day.seconds) / CONFIG.day.seconds) * 24 + 6; }
  get hourOfDay() { return this.hour % 24; }
  railLines() { return this.lines.filter((l) => l.type === "rail"); }
  stationAt(x: number, y: number) {
    return this.stations.findIndex((s) => s.active && Math.hypot(s.pos[0] - x, s.pos[1] - y) < CONFIG.station.pickRadius);
  }
  capacity(s: Station) { return s.interchange ? CONFIG.station.interchangeCapacity : CONFIG.station.capacity; }
  trainCapacity(l: Line) {
    return l.type === "tube" ? CONFIG.train.tubeCapacity : CONFIG.train.baseCapacity + l.carriages * CONFIG.train.perCarriage;
  }

  // ---------- building ----------
  private newLine(type: LineType, i: number): Line {
    return {
      id: this.lines.length, type, stops: [], segments: [], trains: [], carriages: 0,
      color: type === "tube" ? TUBE_COLOR : RAIL_COLORS[i % RAIL_COLORS.length]!,
      name: type === "tube" ? `Pneumatic ${this.lines.filter((l) => l.type === "tube").length + 1}` : `Line ${i + 1}`,
    };
  }

  private planCrossings(runs: number[], inv: { bridges: number; tunnels: number }): CrossingKind[] | null {
    const out: CrossingKind[] = [];
    let b = inv.bridges, t = inv.tunnels;
    for (const r of runs) {
      if (r <= CONFIG.crossing.maxBridgeSpan && b > 0) { out.push("bridge"); b--; }
      else if (t > 0) { out.push("tunnel"); t--; }
      else return null;
    }
    return out;
  }

  private segmentCost(survey: SegmentSurvey, crossings: CrossingKind[]) {
    let cost = survey.cost;
    survey.waterRuns.forEach((r, i) => {
      cost += r * ((crossings[i] === "bridge" ? CONFIG.crossing.bridgeTrackMult : CONFIG.crossing.tunnelTrackMult) - 1);
    });
    return Math.round(cost);
  }

  planExtend(lineId: number, idx: number): ExtendPlan {
    const line = this.lines[lineId]; const st = this.stations[idx];
    if (!line || !st) return { ok: false, error: "Nothing there." };
    if (line.type !== "rail") return { ok: false, error: "Use the tube tool for pneumatic lines." };
    if (!st.active) return { ok: false, error: "That district hasn't been chartered yet." };
    if (line.stops.length === 0) return { ok: true, cost: 0 };
    if (isLoop(line)) return { ok: false, error: "This line is a closed loop. Clear or undo to change it." };
    if (line.stops.includes(idx)) {
      // Closing a loop back to the head is allowed.
      if (!(line.stops.length >= 3 && idx === line.stops[0])) return { ok: false, error: "Already on this line." };
    }
    if (line.stops.length === 1 && this.inv.locomotives <= 0) return { ok: false, error: "No locomotive available to run a new line." };
    const head = this.stations[line.stops[0]!]!, tail = this.stations[line.stops[line.stops.length - 1]!]!;
    const atHead = line.stops.length > 1 && idx !== line.stops[0] &&
      Math.hypot(head.pos[0] - st.pos[0], head.pos[1] - st.pos[1]) < Math.hypot(tail.pos[0] - st.pos[0], tail.pos[1] - st.pos[1]);
    const from = atHead ? head : tail;
    const survey = this.terrain.survey(from.pos, st.pos);
    const crossings = this.planCrossings(survey.waterRuns, this.inv);
    if (!crossings) return { ok: false, error: `Water ahead: need ${survey.waterRuns.length} crossing(s). Spans over ${CONFIG.crossing.maxBridgeSpan} need a tunnel.`, survey };
    const cost = this.segmentCost(survey, crossings);
    if (cost > this.inv.track) return { ok: false, error: `Needs ${cost} track; you have ${Math.round(this.inv.track)}.`, survey, cost };
    return { ok: true, from: from.index, atHead, survey, crossings, cost };
  }

  extend(lineId: number, idx: number): ExtendPlan {
    const plan = this.planExtend(lineId, idx);
    if (!plan.ok) return plan;
    const line = this.lines[lineId]!;
    if (line.stops.length === 0) { line.stops.push(idx); return plan; }
    const seg: Segment = plan.atHead
      ? { a: idx, b: plan.from!, survey: plan.survey!, crossings: plan.crossings! }
      : { a: plan.from!, b: idx, survey: plan.survey!, crossings: plan.crossings! };
    this.spend(plan.cost!, plan.crossings!);
    if (plan.atHead) {
      line.stops.unshift(idx); line.segments.unshift(seg);
      line.trains.forEach((t) => { t.seg++; });
    } else { line.stops.push(idx); line.segments.push(seg); }
    if (line.trains.length === 0) { this.inv.locomotives--; line.trains.push(this.newTrain()); }
    this.networkChanged();
    return plan;
  }

  private spend(cost: number, crossings: CrossingKind[]) {
    this.inv.track -= cost; this.trackUsed += cost;
    for (const c of crossings) { if (c === "bridge") this.inv.bridges--; else this.inv.tunnels--; }
  }
  private refund(seg: Segment) {
    const cost = this.segmentCost(seg.survey, seg.crossings);
    this.inv.track += cost; this.trackUsed -= cost;
    for (const c of seg.crossings) { if (c === "bridge") this.inv.bridges++; else this.inv.tunnels++; }
  }

  undoLast(lineId: number) {
    const line = this.lines[lineId]; if (!line || !line.stops.length) return;
    if (line.type === "tube") { this.clearLine(lineId); return; }
    if (line.stops.length <= 2) { this.clearLine(lineId); return; }
    const seg = line.segments.pop()!; line.stops.pop(); this.refund(seg);
    const last = line.stops.length - 2;
    for (const t of line.trains) if (t.seg > last) { t.seg = last; t.t = 1; t.dir = -1; this.unload(t, line.stops[last + 1]!); }
    this.networkChanged();
  }

  clearLine(lineId: number) {
    const line = this.lines[lineId]; if (!line) return;
    line.segments.forEach((s) => this.refund(s));
    for (const t of line.trains) this.unload(t, line.stops[Math.min(t.seg + (t.t > 0.5 ? 1 : 0), line.stops.length - 1)]!);
    if (line.type === "rail") this.inv.locomotives += line.trains.length; else if (line.stops.length > 1) this.inv.tubes++;
    this.inv.carriages += line.carriages;
    line.stops = []; line.segments = []; line.trains = []; line.carriages = 0;
    if (line.type === "tube") this.lines.splice(this.lines.indexOf(line), 1), this.lines.forEach((l, i) => (l.id = i));
    this.networkChanged();
  }

  private unload(t: Train, at: number) {
    const s = this.stations[at]; if (!s) return;
    for (const r of t.cargo) { r.waitingSince = this.time; s.waiting.push(r); }
    t.cargo = [];
  }

  planTube(a: number, b: number): ExtendPlan {
    const A = this.stations[a], B = this.stations[b];
    if (!A || !B || a === b || !A.active || !B.active) return { ok: false, error: "Pick two different chartered districts." };
    if (this.inv.tubes <= 0) return { ok: false, error: "No pneumatic tube segments in stock." };
    const len = Math.hypot(A.pos[0] - B.pos[0], A.pos[1] - B.pos[1]);
    if (len > CONFIG.tube.maxLength) return { ok: false, error: `Too far for a pneumatic tube (max ${CONFIG.tube.maxLength}).` };
    if (this.lines.some((l) => l.type === "tube" && l.stops.includes(a) && l.stops.includes(b))) return { ok: false, error: "A tube already links these." };
    return { ok: true, cost: 0, survey: this.terrain.survey(A.pos, B.pos), crossings: [] };
  }

  buildTube(a: number, b: number): ExtendPlan {
    const plan = this.planTube(a, b);
    if (!plan.ok) return plan;
    this.inv.tubes--;
    const line = this.newLine("tube", 0);
    line.stops = [a, b];
    line.segments = [{ a, b, survey: plan.survey!, crossings: [] }];
    line.trains = [this.newTrain()];
    this.lines.push(line);
    this.networkChanged();
    return plan;
  }

  addTrain(lineId: number): string | null {
    const l = this.lines[lineId];
    if (!l || l.stops.length < 2) return "Build the line first.";
    if (l.type === "tube") return "Tubes run a single capsule.";
    if (this.inv.locomotives <= 0) return "No spare locomotives.";
    this.inv.locomotives--;
    const t = this.newTrain();
    // start opposite the existing train to even out headways
    t.seg = Math.floor((l.stops.length - 1) / 2); t.dir = l.trains.length % 2 ? -1 : 1;
    l.trains.push(t);
    return null;
  }

  addCarriage(lineId: number): string | null {
    const l = this.lines[lineId];
    if (!l || l.stops.length < 2 || l.type === "tube") return "Carriages need a built rail line.";
    if (this.inv.carriages <= 0) return "No carriages in stock.";
    this.inv.carriages--; l.carriages++;
    return null;
  }

  placeInterchange(idx: number): string | null {
    const s = this.stations[idx];
    if (!s?.active) return "Pick a chartered district.";
    if (s.interchange) return "Already an interchange.";
    if (this.inv.interchanges <= 0) return "No interchanges in stock.";
    this.inv.interchanges--; s.interchange = true;
    return null;
  }

  pickOffer(i: number) {
    if (this.phase !== "picking") return;
    this.offers[i]?.apply(this.inv);
    this.offers = [];
    this.phase = "running";
  }

  private newTrain(): Train {
    const T = CONFIG.train;
    return { id: this.nextTrainId++, seg: 0, t: 0, dir: 1, cargo: [], dwell: 0, coal: T.coalMax, fatigue: 0, wear: 0, brokenFor: 0 };
  }

  // ---------- resources ----------
  private spawnResource(kind: ResourceKind) {
    for (let tries = 0; tries < 200; tries++) {
      const b = this.terrain.bounds;
      const x = b.x0 + 30 + this.rng.next() * (b.x1 - b.x0 - 60), y = b.y0 + 30 + this.rng.next() * (b.y1 - b.y0 - 60);
      if (this.terrain.isWater(x, y)) continue;
      const nearStation = this.stations.some((s) => Math.hypot(s.pos[0] - x, s.pos[1] - y) < CONFIG.resources.minStationGap);
      const nearRes = this.resources.some((r) => Math.hypot(r.pos[0] - x, r.pos[1] - y) < 50);
      const nearAnyStation = this.stations.some((s) => Math.hypot(s.pos[0] - x, s.pos[1] - y) < CONFIG.resources.claimRadius * 1.6);
      if (nearStation || nearRes || !nearAnyStation) continue;
      this.resources.push({ id: this.nextResId++, kind, pos: [x, y], claimedBy: null, spent: false });
      return;
    }
  }

  private updateClaims() {
    const served = new Set(this.lines.flatMap((l) => (l.stops.length > 1 ? l.stops : [])));
    this.stations.forEach((s) => s.services.clear());
    for (const r of this.resources) {
      let best = -1, bd = CONFIG.resources.claimRadius;
      for (const i of served) {
        const s = this.stations[i]!; const dd = Math.hypot(s.pos[0] - r.pos[0], s.pos[1] - r.pos[1]);
        if (dd < bd) { bd = dd; best = i; }
      }
      const was = r.claimedBy;
      r.claimedBy = best >= 0 ? best : null;
      if (r.claimedBy !== null) {
        this.stations[r.claimedBy]!.services.add(r.kind);
        if (was === null) {
          if (r.kind === "foundry" && !r.spent) { r.spent = true; this.inv.track += CONFIG.resources.foundryTrack; }
          this.emit({ type: "claim", kind: r.kind, station: r.claimedBy });
        }
      }
    }
  }

  private networkChanged() {
    this.routes = buildRoutes(this.stations, buildAdjacency(this.lines));
    this.updateClaims();
  }

  private route(kind: RiderKind, at: number) {
    if (!this.routes) this.routes = buildRoutes(this.stations, buildAdjacency(this.lines));
    return this.routes[kind][at]!;
  }

  // ---------- simulation ----------
  step(dt: number) {
    if (this.phase !== "running") return;
    this.time += dt; this.weekTime += dt;
    this.revealDistricts(dt);
    this.runScenarioEvents();
    this.spawnRiders(dt);
    for (const l of this.lines) for (const t of l.trains) this.moveTrain(l, t, dt);
    this.updateStations(dt);
    if (this.weekTime >= CONFIG.week.seconds && this.phase === "running") this.endWeek();
  }

  private revealDistricts(dt: number) {
    this.revealT += dt;
    if (this.revealT < CONFIG.station.revealEvery) return;
    this.revealT = 0;
    const hidden = this.stations.filter((s) => !s.active);
    if (!hidden.length) return;
    const s = this.rng.pick(hidden);
    s.active = true;
    this.routes = null;
    this.emit({ type: "reveal", station: s.index });
  }

  private runScenarioEvents() {
    for (const e of this.charter.scenario.events) {
      if (this.firedEvents.has(e) || e.week !== this.week || this.weekTime < 20) continue;
      const s = this.stations.find((st) => st.id === e.districtId);
      this.firedEvents.add(e);
      if (!s) continue;
      if (!s.active) { s.active = true; this.routes = null; }
      this.activeEvents.push({ station: s.index, mult: e.multiplier, until: this.time + e.duration, title: e.title });
      this.emit({ type: "scenario", title: e.title, description: e.description, station: s.index });
    }
    this.activeEvents = this.activeEvents.filter((e) => e.until > this.time);
  }

  private spawnRiders(dt: number) {
    const active = this.activeStations;
    const kindsPresent = KINDS.filter((k) => active.some((s) => s.kind === k));
    const base = CONFIG.rider.baseRate * 0.25 + CONFIG.rider.ratePerWeek * 0.25 * (this.week - 1);
    const hour = this.hourOfDay;
    for (const s of active) {
      const eventMult = this.activeEvents.filter((e) => e.station === s.index).reduce((m, e) => m * e.mult, 1);
      const targets = kindsPresent.filter((k) => k !== s.kind);
      if (!targets.length) continue;
      const rate = base * s.demand * eventMult * timeOfDayMultiplier(s.kind, hour);
      this.spawnAcc[s.index]! += rate * dt * (0.6 + this.rng.next() * 0.8);
      while (this.spawnAcc[s.index]! >= 1) {
        this.spawnAcc[s.index]! -= 1;
        const want = this.rng.weighted(targets, (k) => this.charter.scenario.demand[k])!;
        s.waiting.push({ want, born: this.time, waitingSince: this.time, transfers: 0, waited: 0 });
        this.spawned++;
      }
    }
  }

  private updateStations(dt: number) {
    const F = CONFIG.station;
    for (const s of this.activeStations) {
      const before = s.waiting.length;
      s.waiting = s.waiting.filter((r) => this.time - r.waitingSince < CONFIG.rider.patience);
      this.stranded += before - s.waiting.length;
      s.overload = s.waiting.length > this.capacity(s) ? s.overload + dt : Math.max(0, s.overload - dt * 0.5);
      if (s.overload > F.failSeconds) {
        this.phase = "failed"; this.failedStation = s.index;
        this.emit({ type: "fail", station: s.index });
        return;
      }
    }
  }

  private endWeek() {
    this.emit({ type: "week", week: this.week });
    if (this.week >= CONFIG.week.total) { this.phase = "complete"; this.emit({ type: "complete" }); return; }
    this.week++; this.weekTime = 0;
    this.inv.track += CONFIG.week.trackGrant;
    this.spawnResource(this.rng.pick(["coal", "barracks", "repair", "foundry"] as const));
    this.updateClaims();
    this.offers = drawOffers(this.rng);
    this.phase = "picking";
  }

  private moveTrain(l: Line, tr: Train, dt: number) {
    if (l.stops.length < 2) return;
    const T = CONFIG.train;
    if (tr.brokenFor > 0) { tr.brokenFor -= dt; return; }
    if (tr.dwell > 0) { tr.dwell -= dt; return; }
    tr.seg = Math.max(0, Math.min(l.segments.length - 1, tr.seg));
    const seg = l.segments[tr.seg]!;
    const a = this.stations[l.stops[tr.seg]!]!, b = this.stations[l.stops[tr.seg + 1]!]!;
    const len = Math.max(1, Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1]));
    let speed = l.type === "tube" ? T.tubeSpeed : T.railSpeed / (1 + seg.survey.grade * T.gradeSlow);
    if (l.type === "rail") {
      if (tr.coal <= 0) { speed *= T.noCoalSpeed; this.outOfCoal += dt; }
      if (tr.fatigue > T.fatigueLimit) speed *= T.tiredSpeed;
      tr.coal = Math.max(0, tr.coal - T.coalBurn * dt);
      tr.fatigue += T.fatigueRate * dt;
    }
    const moved = speed * dt;
    tr.wear += moved * T.wearPerPx;
    if (tr.wear > T.breakdownStart && this.rng.next() < ((tr.wear - T.breakdownStart) / 3000) * dt * 10) {
      tr.brokenFor = T.breakdownSeconds; this.breakdowns++;
      this.emit({ type: "breakdown", line: l.id });
      return;
    }
    tr.t += (tr.dir * moved) / len;
    if (tr.t < 1 && tr.t > 0) return;
    const last = l.stops.length - 1;
    const loop = isLoop(l);
    let atIdx: number;
    if (tr.dir === 1) {
      atIdx = tr.seg + 1;
      if (atIdx === last) {
        if (loop) { atIdx = 0; tr.seg = 0; tr.t = 0; }
        else { tr.dir = -1; tr.seg = last - 1; tr.t = 1; }
      } else { tr.seg = atIdx; tr.t = 0; }
    } else {
      atIdx = tr.seg;
      if (atIdx === 0) { tr.dir = 1; tr.seg = 0; tr.t = 0; }
      else { tr.seg = atIdx - 1; tr.t = 1; }
    }
    this.arrive(l, tr, atIdx);
  }

  private arrive(l: Line, tr: Train, atIdx: number) {
    const T = CONFIG.train;
    const sIdx = l.stops[atIdx]!; const s = this.stations[sIdx]!;
    if (s.services.has("coal")) tr.coal = T.coalMax;
    if (s.services.has("barracks")) tr.fatigue = 0;
    if (s.services.has("repair")) tr.wear = 0;
    const nextStop = l.stops[atIdx + tr.dir];
    const keep: Rider[] = [];
    let moved = 0;
    for (const r of tr.cargo) {
      const hop = this.route(r.want, sIdx);
      if (hop === -2) {
        this.delivered++; this.tripTimeSum += this.time - r.born; this.transferSum += r.transfers; moved++;
        this.emit({ type: "deliver", station: sIdx });
        continue;
      }
      if (hop === nextStop) { keep.push(r); continue; }
      r.transfers++; s.transfers++; r.waitingSince = this.time; s.waiting.push(r); moved++;
    }
    tr.cargo = keep;
    const cap = this.trainCapacity(l);
    if (nextStop !== undefined) {
      s.waiting = s.waiting.filter((r) => {
        if (tr.cargo.length < cap && this.route(r.want, sIdx) === nextStop) {
          this.boardings++; this.waitSum += this.time - r.waitingSince;
          tr.cargo.push(r); moved++; return false;
        }
        return true;
      });
    }
    const tired = l.type === "rail" && tr.fatigue > T.fatigueLimit;
    tr.dwell = T.dwell * (tired ? T.tiredDwell : 1) * (s.interchange ? 0.6 : 1) + moved * 0.05;
    this.emit({ type: "depart", line: l.id });
  }

  trainPos(l: Line, tr: Train) {
    const seg = Math.max(0, Math.min(l.stops.length - 2, tr.seg));
    const a = this.stations[l.stops[seg]!]!.pos, b = this.stations[l.stops[seg + 1]!]!.pos;
    return { x: a[0] + (b[0] - a[0]) * tr.t, y: a[1] + (b[1] - a[1]) * tr.t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }

  // ---------- metrics ----------
  metrics(): NetworkMetrics {
    const adj = buildAdjacency(this.lines);
    const active = this.activeStations;
    const served = active.filter((s) => adj.has(s.index));
    const totalTransfers = this.stations.reduce((n, s) => n + s.transfers, 0);
    const hub = [...this.stations].sort((a, b) => b.transfers - a.transfers)[0]!;
    const waitingNow = active.reduce((n, s) => n + s.waiting.length, 0);
    return {
      week: this.week,
      delivered: this.delivered, stranded: this.stranded, waitingNow,
      serviceRate: this.spawned ? this.delivered / Math.max(1, this.delivered + this.stranded + waitingNow) : 0,
      avgTripSeconds: this.delivered ? this.tripTimeSum / this.delivered : 0,
      avgWaitSeconds: this.boardings ? this.waitSum / this.boardings : 0,
      transfersPerTrip: this.delivered ? this.transferSum / this.delivered : 0,
      busiestHub: totalTransfers ? hub.name : "none",
      hubShare: totalTransfers ? hub.transfers / totalTransfers : 0,
      coverage: active.length ? served.length / active.length : 0,
      resilience: resilience(adj),
      trackUsed: Math.round(this.trackUsed),
      ridersPerTrack: this.trackUsed > 0 ? this.delivered / this.trackUsed : 0,
      linesBuilt: this.lines.filter((l) => l.type === "rail" && l.stops.length > 1).length,
      tubesBuilt: this.lines.filter((l) => l.type === "tube").length,
      breakdowns: this.breakdowns,
      outOfCoalSeconds: Math.round(this.outOfCoal),
      resourcesClaimed: this.resources.filter((r) => r.claimedBy !== null).length,
      resourcesTotal: this.resources.length,
      activeDistricts: active.length,
      failed: this.phase === "failed",
    };
  }
}

export type { Pt };

export function isLoop(l: Line) {
  return l.stops.length > 3 && l.stops[0] === l.stops[l.stops.length - 1];
}
