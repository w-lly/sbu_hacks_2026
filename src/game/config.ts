/** Every tunable number in the simulation lives here so balancing never requires touching logic. */
type DeepNumber<T> = { [K in keyof T]: T[K] extends number ? number : DeepNumber<T[K]> };
const RAW = {
  canvas: { width: 1100, height: 700, padding: 16 },
  terrain: { cell: 5, sampleStep: 6, woodsMult: 1.6, wetlandMult: 2.2, parkMult: 1.3, gradeMult: 0.2 },
  crossing: { maxBridgeSpan: 70, bridgeTrackMult: 1.6, tunnelTrackMult: 1.0 },
  week: { seconds: 60, total: 8, trackGrant: 220 },
  day: { seconds: 30 },
  station: { capacity: 10, interchangeCapacity: 18, failSeconds: 25, pickRadius: 22, firstActive: 3, revealEvery: 17 },
  rider: { patience: 50, baseRate: 0.24, ratePerWeek: 0.05 },
  train: {
    railSpeed: 85, tubeSpeed: 230, baseCapacity: 6, tubeCapacity: 4, perCarriage: 4,
    dwell: 0.5, gradeSlow: 0.25,
    coalMax: 100, coalBurn: 1.1, noCoalSpeed: 0.3,
    fatigueRate: 1, fatigueLimit: 75, tiredDwell: 3, tiredSpeed: 0.8,
    wearPerPx: 0.012, breakdownStart: 55, breakdownSeconds: 6,
  },
  tube: { maxLength: 230 },
  resources: { claimRadius: 60, initial: { coal: 2, barracks: 1, repair: 1, foundry: 1 }, foundryTrack: 250, minStationGap: 36 },
  scoring: { ridersPerTrackTarget: 0.2 },
} as const;

export const CONFIG: DeepNumber<typeof RAW> = RAW as never;
