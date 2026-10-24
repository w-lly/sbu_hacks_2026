import type { Charter } from "@/shared/types";
import { buildCharter } from "@/backend/services/maps.server";

export function charter(slug = "setauket"): Charter {
  const c = buildCharter(slug);
  if (!c) throw new Error(`missing charter ${slug}`);
  return c;
}
