import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const n = z.number();
const snapshotSchema = z.object({
  lvl: z.string().max(40), diff: z.string().max(20), wk: n, wkOf: n, t: n, cr: n, rev: n, prod: n,
  ord: z.object({ done: n, miss: n, open: z.array(z.object({ co: n, g: z.enum(["iron", "coal", "timber", "steel", "planks", "machinery"]), need: n, left: n })).max(20) }),
  inv: z.object({ trk: n, loco: n, car: n, br: n, tun: n, boat: n, tube: n, coll: n }),
  lines: n, trains: n,
  hubs: z.array(z.object({ m: z.string().max(20), x: n, y: n, stock: n })).max(60),
  cos: z.array(z.object({ i: n, k: z.string().max(20), x: n, y: n, on: z.boolean(), made: n, inputs: z.array(z.string().max(20)).max(4) })).max(60),
  dep: z.object({ claimed: n, total: n }), perf: n,
});

/** Background planning call; returns null when Gemini is unavailable so the game uses RNG. */
export const getDirectorPlan = createServerFn({ method: "POST" })
  .inputValidator((input) => snapshotSchema.parse(input))
  .handler(async ({ data }) => {
    const { planNext } = await import("../services/director.server");
    return planNext(data);
  });
