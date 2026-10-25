/**
 * Standardised Gemini "director" contract. The game sends a compact GameSnapshot and
 * receives a DirectorPlan of upcoming upgrades and orders. Everything is validated here so
 * any malformed AI output degrades to the built-in RNG generation.
 */
import type { Commodity } from "./factory";

export const UPGRADE_IDS = ["line", "hubs", "train", "wagons", "track", "bridge", "tunnel", "boat", "tube"] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];
/** Allowed amount range per upgrade so the AI cannot break the economy. */
export const UPGRADE_LIMITS: Record<UpgradeId, [min: number, max: number, fallback: number]> = {
  line: [1, 1, 1], hubs: [1, 3, 2], train: [1, 2, 1], wagons: [1, 4, 2], track: [150, 800, 400],
  bridge: [1, 2, 1], tunnel: [1, 2, 1], boat: [1, 2, 1], tube: [1, 2, 1],
};
export type Pace = "ease" | "steady" | "push";

/** Compact player state. Short keys keep the prompt small and fast. */
export interface GameSnapshot {
  lvl: string; diff: string; wk: number; wkOf: number; t: number;
  cr: number; rev: number; prod: number;
  ord: { done: number; miss: number; open: { co: number; g: Commodity; need: number; left: number }[] };
  inv: { trk: number; loco: number; car: number; br: number; tun: number; boat: number; tube: number; coll: number };
  lines: number; trains: number; hubs: { m: string; x: number; y: number; stock: number }[];
  cos: { i: number; k: string; x: number; y: number; on: boolean; made: number; inputs: string[] }[];
  dep: { claimed: number; total: number };
  /** Simple 0–1 progress heuristic computed client-side. */
  perf: number;
}

export interface UpgradeSpec { id: UpgradeId; amount: number }
export interface OrderSpec { company: number; good: Commodity; quantity: number; seconds: number }
export interface DirectorPlan { pace: Pace; upgrades: UpgradeSpec[]; orders: OrderSpec[]; source: "ai" | "fallback" }

const GOODS: Commodity[] = ["iron", "coal", "timber", "steel", "planks", "machinery"];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Turns arbitrary AI JSON into a safe plan; invalid entries are dropped. */
export function sanitizePlan(raw: unknown, snap: Pick<GameSnapshot, "cos">): DirectorPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { pace?: unknown; upgrades?: unknown; orders?: unknown };
  const pace: Pace = r.pace === "ease" || r.pace === "push" ? r.pace : "steady";
  const upgrades: UpgradeSpec[] = [];
  for (const u of Array.isArray(r.upgrades) ? r.upgrades : []) {
    const id = (u as { id?: unknown })?.id;
    if (typeof id !== "string" || !(UPGRADE_IDS as readonly string[]).includes(id) || upgrades.some((x) => x.id === id)) continue;
    const [lo, hi, fb] = UPGRADE_LIMITS[id as UpgradeId];
    const amt = Number((u as { amount?: unknown }).amount);
    upgrades.push({ id: id as UpgradeId, amount: Number.isFinite(amt) ? clamp(amt, lo, hi) : fb });
  }
  const orders: OrderSpec[] = [];
  for (const o of Array.isArray(r.orders) ? r.orders : []) {
    const x = (o ?? {}) as { company?: unknown; good?: unknown; quantity?: unknown; seconds?: unknown };
    const co = snap.cos.find((c) => c.i === Number(x.company));
    if (!co || typeof x.good !== "string" || !GOODS.includes(x.good as Commodity) || !co.inputs.includes(x.good)) continue;
    orders.push({ company: co.i, good: x.good as Commodity, quantity: clamp(Number(x.quantity) || 8, 4, 16), seconds: clamp(Number(x.seconds) || 100, 60, 160) });
  }
  if (upgrades.length < 3 && !orders.length) return null;
  return { pace, upgrades: upgrades.length >= 3 ? upgrades.slice(0, 3) : [], orders: orders.slice(0, 4), source: "ai" };
}
