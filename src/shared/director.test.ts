import { describe, expect, it } from "vitest";
import { sanitizePlan } from "./director";

const snap = { cos: [{ i: 0, k: "foundry", x: 0, y: 0, on: true, made: 0, inputs: ["iron", "coal"] }] };

describe("director plan validation", () => {
  it("clamps upgrade amounts and drops unknown upgrades", () => {
    const plan = sanitizePlan({ pace: "push", upgrades: [{ id: "track", amount: 99999 }, { id: "nuke", amount: 1 }, { id: "train", amount: 1 }, { id: "wagons", amount: 0 }] }, snap);
    expect(plan?.upgrades).toEqual([{ id: "track", amount: 800 }, { id: "train", amount: 1 }, { id: "wagons", amount: 1 }]);
  });
  it("rejects orders for goods a company cannot use", () => {
    const plan = sanitizePlan({ orders: [{ company: 0, good: "timber", quantity: 8, seconds: 90 }, { company: 0, good: "iron", quantity: 50, seconds: 10 }] }, snap);
    expect(plan?.orders).toEqual([{ company: 0, good: "iron", quantity: 16, seconds: 60 }]);
  });
  it("returns null for garbage so the RNG fallback is used", () => {
    expect(sanitizePlan("nope", snap)).toBeNull();
  });
});
