/** Server-only access to pre-baked map data. Never import from client code. */
import type { Charter, CharterSummary, MapGeography, Scenario } from "@/shared/types";
import { CHARTERS, type CharterDef } from "../data/charters";
import setauket from "../data/maps/setauket.json";
import manhattan from "../data/maps/manhattan.json";
import nassau from "../data/maps/nassau.json";

const GEO: Record<string, MapGeography> = {
  setauket: setauket as unknown as MapGeography,
  manhattan: manhattan as unknown as MapGeography,
  nassau: nassau as unknown as MapGeography,
};

export function findCharter(slug: string): CharterDef | undefined {
  return CHARTERS.find((c) => c.slug === slug);
}

export function listCharterSummaries(): CharterSummary[] {
  return CHARTERS.map((c) => {
    const geo = GEO[c.slug]!;
    // Keep thumbnails light: only the largest water bodies.
    const water = [...geo.water].sort((a, b) => b.length - a.length).slice(0, 6);
    return {
      slug: c.slug, name: c.name, difficulty: c.difficulty, blurb: c.blurb,
      districtCount: c.districts.length,
      thumbnail: { water, bbox: geo.bbox, preview: c.districts.slice(0, 4).map((d) => [d.lng, d.lat]) },
    };
  });
}

export function buildCharter(slug: string, scenario?: Scenario): Charter | null {
  const c = findCharter(slug);
  const geography = GEO[slug];
  if (!c || !geography) return null;
  return {
    slug: c.slug, name: c.name, difficulty: c.difficulty, blurb: c.blurb,
    districtCount: c.districts.length, geography, districts: c.districts, start: c.start,
    scenario: scenario ?? c.scenario,
  };
}

/** Light land-use digest the AI uses to theme a scenario. */
export function landUseDigest(slug: string) {
  const g = GEO[slug];
  if (!g) return null;
  const elev = g.elevation.values;
  return {
    waterBodies: g.water.length, woodlands: g.woods.length, wetlands: g.wetland.length, parks: g.parks.length,
    maxElevationM: Math.max(...elev), minElevationM: Math.min(...elev),
  };
}
