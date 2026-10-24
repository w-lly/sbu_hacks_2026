import type { RiderKind } from "@/shared/types";
import type { Pt } from "./projection";
import type { SegmentSurvey } from "./terrain";

export type LineType = "rail" | "tube";
export type ResourceKind = "coal" | "barracks" | "repair" | "foundry";
export type CrossingKind = "bridge" | "tunnel";

export interface Station {
  index: number; id: string; name: string; lore: string; realName: string;
  kind: RiderKind; pos: Pt; demand: number;
  active: boolean; interchange: boolean;
  waiting: Rider[]; overload: number; transfers: number;
  services: Set<ResourceKind>;
}

export interface Rider { want: RiderKind; born: number; waitingSince: number; transfers: number; waited: number }

export interface Segment { a: number; b: number; survey: SegmentSurvey; crossings: CrossingKind[] }

export interface Train {
  id: number; seg: number; t: number; dir: 1 | -1; cargo: Rider[]; dwell: number;
  coal: number; fatigue: number; wear: number; brokenFor: number;
}

export interface Line {
  id: number; type: LineType; color: string; name: string;
  stops: number[]; segments: Segment[]; trains: Train[]; carriages: number;
}

export interface ResourceNode { id: number; kind: ResourceKind; pos: Pt; claimedBy: number | null; spent: boolean }

export interface Inventory {
  track: number; locomotives: number; carriages: number; bridges: number; tunnels: number; interchanges: number; tubes: number;
}

export type Offer = { id: string; label: string; description: string; apply: (inv: Inventory) => void };

export type GameEvent =
  | { type: "deliver"; station: number }
  | { type: "depart"; line: number }
  | { type: "week"; week: number }
  | { type: "fail"; station: number }
  | { type: "complete" }
  | { type: "breakdown"; line: number }
  | { type: "scenario"; title: string; description: string; station: number }
  | { type: "claim"; kind: ResourceKind; station: number }
  | { type: "reveal"; station: number };
