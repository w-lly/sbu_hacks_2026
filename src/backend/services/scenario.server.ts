/** AI scenario drafting with validation and cached fallback. Server-only. */
import type { Scenario } from "@/shared/types";
import { askJson } from "./ai.server";
import { findCharter, landUseDigest } from "./maps.server";

const SYSTEM = `You are the scenario writer for "Back On Track", a Gilded Age steampunk transit game on real maps.
Given real districts and land use, rename each district as a steampunk structure (max 5 words), write one-sentence lore,
choose demand weights (0.6-1.6) for commuter/student/shopper, and invent exactly 3 timed events at weeks 2, 4 and 6
that cause a demand surge at a district (multiplier 2-4, duration 20-35 seconds).
JSON shape: {"title": string, "districts":[{"id","name","lore"}], "demand":{"commuter":n,"student":n,"shopper":n},
"events":[{"week":n,"districtId":string,"title":string,"description":string,"multiplier":n,"duration":n}]}`;

const clamp = (v: unknown, lo: number, hi: number, dflt: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function draftScenario(slug: string): Promise<Scenario | null> {
  const charter = findCharter(slug);
  if (!charter) return null;
  const cached = charter.scenario;
  const raw = await askJson<Partial<Scenario>>(SYSTEM, JSON.stringify({
    map: charter.name,
    landUse: landUseDigest(slug),
    districts: charter.districts.map((d) => ({ id: d.id, realName: d.realName, riders: d.kind })),
  }));
  if (!raw) return cached;

  const ids = new Set(charter.districts.map((d) => d.id));
  const byId = new Map((raw.districts ?? []).map((d) => [d?.id, d]));
  const scenario: Scenario = {
    title: str(raw.title, 60) ?? cached.title,
    source: "ai",
    demand: {
      commuter: clamp(raw.demand?.commuter, 0.6, 1.6, 1),
      student: clamp(raw.demand?.student, 0.6, 1.6, 1),
      shopper: clamp(raw.demand?.shopper, 0.6, 1.6, 1),
    },
    districts: charter.districts.map((d) => {
      const ai = byId.get(d.id);
      const fb = cached.districts.find((c) => c.id === d.id)!;
      return { id: d.id, name: str(ai?.name, 40) ?? fb.name, lore: str(ai?.lore, 140) ?? fb.lore };
    }),
    events: (raw.events ?? [])
      .filter((e) => e && ids.has(e.districtId))
      .slice(0, 4)
      .map((e) => ({
        week: Math.round(clamp(e.week, 1, 8, 3)),
        districtId: e.districtId,
        title: str(e.title, 60) ?? "A Sudden Crowd",
        description: str(e.description, 140) ?? "",
        multiplier: clamp(e.multiplier, 1.5, 4, 3),
        duration: clamp(e.duration, 15, 40, 25),
      })),
  };
  if (!scenario.events.length) scenario.events = cached.events;
  return scenario;
}
