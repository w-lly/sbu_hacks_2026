import { describe, expect, it } from "vitest";
import type { NetworkMetrics } from "@/shared/types";
import { runBaseline } from "./baseline";
import { Game } from "./engine";
import { buildAdjacency, resilience } from "./network";
import { gradeFor, scoreBreakdown } from "./scoring";
import { charter } from "@/test/fixtures";

const perfect: NetworkMetrics = {
  week: 8, delivered: 400, stranded: 0, waitingNow: 0, serviceRate: 1, avgTripSeconds: 10, avgWaitSeconds: 3,
  transfersPerTrip: 0.3, busiestHub: "x", hubShare: 0.3, coverage: 1, resilience: 1, trackUsed: 1500,
  ridersPerTrack: 0.3, linesBuilt: 3, tubesBuilt: 1, breakdowns: 0, outOfCoalSeconds: 0, resourcesClaimed: 4,
  resourcesTotal: 6, activeDistricts: 11, failed: false,
};

function playOneLine(slug: string) {
  const g = new Game(charter(slug), 7);
  for (let t = 0; t < 600 && (g.phase === "running" || g.phase === "picking"); t += 0.1) {
    if (g.phase === "picking") g.pickOffer(0);
    for (const s of g.activeStations) if (!g.lines[0]!.stops.includes(s.index)) g.extend(0, s.index);
    g.step(0.1);
  }
  return scoreBreakdown(g.metrics());
}

describe("grading", () => {
  it("uses A/B/C/D cutoffs of 88/78/64/50", () => {
    expect([gradeFor(88), gradeFor(87), gradeFor(78), gradeFor(64), gradeFor(50), gradeFor(49)]).toEqual(["A", "B", "B", "C", "D", "F"]);
  });

  it("a flawless, redundant network that survives all 8 weeks earns an A", () => {
    expect(scoreBreakdown(perfect).grade).toBe("A");
  });

  it("ending a run in week 1 cannot earn better than a D", () => {
    const early = { ...perfect, week: 1 };
    expect(["D", "F"]).toContain(scoreBreakdown(early).grade);
  });

  it("riders changing trains more than once per trip cost 8 points per extra transfer", () => {
    expect(scoreBreakdown({ ...perfect, transfersPerTrip: 2 }).transferPenalty).toBe(8);
  });

  it.each(["setauket", "manhattan", "nassau"])("a single line in %s grades D or worse", (slug) => {
    expect(["D", "F"]).toContain(playOneLine(slug).grade);
  });
});

describe("real terrain", () => {
  it.each(["setauket", "manhattan", "nassau"])("every %s district sits on dry land inside the survey", (slug) => {
    const g = new Game(charter(slug), 1);
    for (const s of g.stations) {
      expect(g.terrain.isWater(s.pos[0], s.pos[1])).toBe(false);
      expect(g.terrain.inBounds(s.pos[0], s.pos[1])).toBe(true);
    }
  });

  it("most of the Setauket survey is land, not sea", () => {
    const g = new Game(charter("setauket"), 1);
    const water = g.terrain.ground.reduce((n, v) => n + (v === 1 ? 1 : 0), 0);
    expect(water / g.terrain.ground.length).toBeLessThan(0.5);
  });
});

describe("network", () => {
  it("a single straight line has a single point of failure", () => {
    const g = new Game(charter("nassau"), 1);
    const [a, b, c] = g.activeStations;
    g.extend(0, a!.index); g.extend(0, b!.index); g.extend(0, c!.index);
    expect(resilience(buildAdjacency(g.lines))).toBeLessThan(0.5);
  });

  it("crossing the East River requires a bridge or tunnel", () => {
    const g = new Game(charter("manhattan"), 1);
    const wall = g.stations.find((s) => s.id === "wall")!, bh = g.stations.find((s) => s.id === "bh")!;
    wall.active = bh.active = true;
    expect(g.terrain.survey(wall.pos, bh.pos).waterRuns.length).toBeGreaterThan(0);
    g.inv.bridges = 0; g.inv.tunnels = 0;
    g.extend(0, wall.index);
    expect(g.extend(0, bh.index).ok).toBe(false);
  });

  it("the greedy baseline is deterministic for a seed", () => {
    expect(runBaseline(charter("setauket"), 3, 2).delivered).toBe(runBaseline(charter("setauket"), 3, 2).delivered);
  });
});
