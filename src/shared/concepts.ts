/** Transit-planning concepts shown as tooltips and in the Engineering Primer. */
export const CONCEPTS = {
  hubSpoke: { title: "Hub-and-spoke vs. grid", body: "A hub concentrates transfers in one place: simple, but fragile. A grid spreads them across many crossings, so one failure strands fewer riders." },
  headway: { title: "Headways", body: "The gap between trains on a line. Halve the headway by doubling locomotives and average platform waits fall by half too." },
  express: { title: "Express vs. local", body: "Locals stop everywhere and serve coverage. Expresses, like your pneumatic tubes, skip stops to link busy pairs quickly." },
  redundancy: { title: "Redundancy", body: "If removing one station splits your network, you have a single point of failure. Loops and parallel lines keep riders moving." },
  transfers: { title: "Transfers", body: "Each change of train adds waiting and risk. Riders prefer one-seat rides; long through-lines reduce transfers." },
  coverage: { title: "Coverage", body: "The share of districts within reach of a line. Unserved districts still generate riders who have nowhere to go." },
  logistics: { title: "Fuel & maintenance", body: "Steam needs coal, crews need rest and boilers need repair. A network that never passes its depots slowly grinds to a crawl." },
  terrain: { title: "Grades & ground", body: "Hills slow locomotives and cost more track. Woods and marsh are costlier still. Follow the valleys when you can." },
} as const;

export type ConceptKey = keyof typeof CONCEPTS;
