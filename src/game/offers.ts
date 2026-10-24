/** Weekly resource picks. Add a new pick by appending to OFFER_POOL. */
import type { Inventory, Offer } from "./entities";
import type { Rng } from "./rng";

export const OFFER_POOL: Offer[] = [
  { id: "loco", label: "Locomotive", description: "Open a new line, or add a train to shorten headways.", apply: (i) => { i.locomotives++; } },
  { id: "carriage", label: "Carriage", description: "+4 seats on every train of one line.", apply: (i) => { i.carriages++; } },
  { id: "tunnel", label: "Tunnel", description: "Cross water of any width beneath the surface.", apply: (i) => { i.tunnels++; } },
  { id: "bridge", label: "Bridge", description: "Span a short stretch of water. Cheap, but short.", apply: (i) => { i.bridges += 2; } },
  { id: "interchange", label: "Interchange", description: "Expand a station: more platform room for transfers.", apply: (i) => { i.interchanges++; } },
  { id: "tube", label: "Pneumatic tube", description: "A fast point-to-point express. No coal needed.", apply: (i) => { i.tubes++; } },
  { id: "track", label: "Iron rails", description: "+350 units of track.", apply: (i) => { i.track += 350; } },
];

export function drawOffers(rng: Rng, n = 3): Offer[] {
  return rng.shuffle([...OFFER_POOL]).slice(0, n);
}
