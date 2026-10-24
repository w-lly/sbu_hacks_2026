/**
 * Contracts shared by the server (data + AI) and the client (game engine + UI).
 * Anything that crosses the network boundary is defined here.
 */

export type LngLat = [number, number];
export type Ring = LngLat[];
export type RiderKind = "commuter" | "student" | "shopper";
export type Difficulty = "Tutorial" | "Medium" | "Hard";

/** Pre-baked real-world geography (see scripts/build_map_data.py). */
export interface MapGeography {
  slug: string;
  bbox: [west: number, south: number, east: number, north: number];
  water: Ring[];
  woods: Ring[];
  wetland: Ring[];
  parks: Ring[];
  elevation: { cols: number; rows: number; values: number[] };
  source: string;
}

/** A real place on the map that becomes a station. */
export interface DistrictSeed {
  id: string;
  realName: string;
  kind: RiderKind;
  lng: number;
  lat: number;
  /** Relative passenger generation, 1 = normal. */
  demand: number;
}

/** AI-written (or cached) flavour layer on top of the real data. */
export interface Scenario {
  title: string;
  districts: { id: string; name: string; lore: string }[];
  demand: Record<RiderKind, number>;
  events: ScenarioEvent[];
  source: "ai" | "cache";
}

export interface ScenarioEvent {
  week: number;
  districtId: string;
  title: string;
  description: string;
  /** Spawn multiplier at that district while the event runs. */
  multiplier: number;
  /** Event length in game seconds. */
  duration: number;
}

export interface CharterSummary {
  slug: string;
  name: string;
  difficulty: Difficulty;
  blurb: string;
  districtCount: number;
  thumbnail: { water: Ring[]; bbox: MapGeography["bbox"]; preview: LngLat[] };
}

export interface Charter extends Omit<CharterSummary, "thumbnail"> {
  geography: MapGeography;
  districts: DistrictSeed[];
  scenario: Scenario;
  start: StartingKit;
}

export interface StartingKit {
  track: number;
  locomotives: number;
  carriages: number;
  bridges: number;
  tunnels: number;
  interchanges: number;
  tubes: number;
}

/** Computed by the engine, sent to the Chief Engineer. */
export interface NetworkMetrics {
  /** Freight-mode details; legacy fields remain wire-compatible for existing reports. */
  factory?: { revenue: number; products: number; contractsCompleted: number; contractsMissed: number; companiesWorking: number; companiesTotal: number; hubs: number } | undefined;
  week: number;
  delivered: number;
  stranded: number;
  waitingNow: number;
  serviceRate: number;
  avgTripSeconds: number;
  avgWaitSeconds: number;
  transfersPerTrip: number;
  busiestHub: string;
  hubShare: number;
  coverage: number;
  resilience: number;
  trackUsed: number;
  ridersPerTrack: number;
  linesBuilt: number;
  tubesBuilt: number;
  breakdowns: number;
  outOfCoalSeconds: number;
  resourcesClaimed: number;
  resourcesTotal: number;
  activeDistricts: number;
  failed: boolean;
}

export interface EngineerFeedback {
  headline: string;
  notes: string[];
  concept?: { title: string; body: string } | undefined;
  source: "ai" | "fallback";
}
