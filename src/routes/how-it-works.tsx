import { createFileRoute, Link } from "@tanstack/react-router";
import { CONCEPTS } from "@/shared/concepts";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How the Works Work — Brassworks Transit" },
      { name: "description", content: "Rules of Brassworks Transit: districts, terrain, crossings, depots, pneumatic tubes and grading." },
      { property: "og:title", content: "How the Works Work — Brassworks Transit" },
      { property: "og:description", content: "Learn the rules of the Gilded Age transit game." },
    ],
  }),
  component: How,
});

const rules = [
  ["Districts", "Real places are chartered over time. Circles are commuters, squares students, triangles shoppers. Each rider wants the nearest district of their shape. Commuters surge at the morning and evening rush."],
  ["Laying track", "Pick a line, then click districts. Track comes from a limited budget, and real ground sets the price: woods, marsh, parks and steep hills cost more. Each line needs a locomotive. Click a line's first stop again to close a loop."],
  ["Water", "Every stretch of water needs a crossing. Bridges are cheap but only span short gaps; wider water needs a tunnel."],
  ["Depots", "Coal depots, crew barracks, repair yards and iron foundries appear at random. Run a line to a station near one to claim it. Trains without coal crawl, tired crews dwell longer, and worn boilers break down."],
  ["Pneumatic tubes", "A fast point-to-point express with two stops and a short range. It needs no coal, like Beach's 1870 tube under Broadway."],
  ["Weekly requisition", "At the end of each of the 8 weeks you get more rails and pick one shipment: locomotive, carriage, tunnel, bridge, interchange, tube or extra rails."],
  ["Failure", "If a district has more riders waiting than its platform holds for too long, the board revokes your charter. Riders who wait too long give up, and that counts against you."],
  ["Grading", "Your grade weighs service (40%), coverage (25%), resilience to a single station failing (20%) and riders per unit of track (15%), then scales it by how many weeks you lasted. One straight line will not pass."],
];

function How() {
  return (
    <main className="brass-frame m-3 min-h-[calc(100vh-1.5rem)] px-8 py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl text-brass">How the Works Work</h1>
        <dl className="mt-8 space-y-5">
          {rules.map(([t, d]) => (
            <div key={t} className="border-l-2 border-brass pl-4">
              <dt className="font-display text-xl">{t}</dt>
              <dd className="text-lg text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-12 font-display text-2xl text-brass">Engineering primer</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Object.values(CONCEPTS).map((c) => (
            <div key={c.title}><p className="font-display text-lg">{c.title}</p><p className="text-muted-foreground">{c.body}</p></div>
          ))}
        </div>
        <Link to="/" className="btn-brass mt-10 inline-block">Back to charters</Link>
      </div>
    </main>
  );
}
