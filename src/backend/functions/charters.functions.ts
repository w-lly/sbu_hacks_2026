/**
 * Public server functions (RPC) used by the client. Keep these thin:
 * validate input, then delegate to *.server.ts modules (loaded lazily so they never enter the client bundle).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listCharters = createServerFn({ method: "GET" }).handler(async () => {
  const { listCharterSummaries } = await import("../services/maps.server");
  return listCharterSummaries();
});

export const getCharter = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(40), ai: z.boolean().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { buildCharter } = await import("../services/maps.server");
    let scenario;
    if (data.ai) {
      const { draftScenario } = await import("../services/scenario.server");
      scenario = (await draftScenario(data.slug)) ?? undefined;
    }
    return buildCharter(data.slug, scenario);
  });
