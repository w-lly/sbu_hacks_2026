import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const metricsSchema = z.object({
  week: z.number(), delivered: z.number(), stranded: z.number(), waitingNow: z.number(),
  serviceRate: z.number(), avgTripSeconds: z.number(), avgWaitSeconds: z.number(), transfersPerTrip: z.number(),
  busiestHub: z.string().max(80), hubShare: z.number(), coverage: z.number(), resilience: z.number(),
  trackUsed: z.number(), ridersPerTrack: z.number(), linesBuilt: z.number(), tubesBuilt: z.number(),
  breakdowns: z.number(), outOfCoalSeconds: z.number(), resourcesClaimed: z.number(), resourcesTotal: z.number(),
  activeDistricts: z.number(), failed: z.boolean(),
  factory: z.object({ revenue: z.number(), products: z.number(), contractsCompleted: z.number(), contractsMissed: z.number(), companiesWorking: z.number(), companiesTotal: z.number(), hubs: z.number() }).optional(),
});

export const getEngineerFeedback = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ metrics: metricsSchema, final: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const { critiqueNetwork } = await import("../services/engineer.server");
    return critiqueNetwork(data.metrics, data.final);
  });
