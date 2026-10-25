import { CHARTERS } from "./charter-catalogue";
import { LEVEL_NAMES } from "./levels";
const setauket={slug:"generated",bbox:[0,0,1536,960],water:[],woods:[],wetland:[],parks:[],elevation:{cols:1,rows:1,values:[0]},source:"Seeded industrial world"};
const manhattan=setauket;
const nassau=setauket;
import type { Charter, CharterSummary, MapGeography } from "./types";

function geography(data: typeof setauket): MapGeography {
  const point = (p: number[]): [number, number] => [p[0] ?? 0, p[1] ?? 0];
  const rings = (rs: number[][][]) => rs.map(r => r.map(point));
  const [west = 0, south = 0, east = 0, north = 0] = data.bbox;
  return { ...data, bbox: [west, south, east, north], water: rings(data.water), woods: rings(data.woods), wetland: rings(data.wetland), parks: rings(data.parks) };
}
const maps: Record<string, MapGeography> = { setauket: geography(setauket), manhattan: geography(manhattan), nassau: geography(nassau) };
export function localCharter(slug: string): Charter | null {
  const def = CHARTERS.find(c => c.slug === slug), geography = maps[slug];
  if (!def || !geography) return null;
  return { ...def, name:LEVEL_NAMES[slug]??def.name, geography, districtCount: def.districts.length };
}
export function localCharters(): CharterSummary[] {
  return CHARTERS.flatMap(def => {
    const geography = maps[def.slug];
    return geography ? [{ slug: def.slug, name: LEVEL_NAMES[def.slug]??def.name, difficulty: def.difficulty, blurb: def.blurb, districtCount: def.districts.length, thumbnail: { bbox: geography.bbox, water: geography.water, preview: def.districts.slice(0, 5).map(d => [d.lng, d.lat] as [number, number]) } }] : [];
  });
}