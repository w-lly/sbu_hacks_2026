import { createFileRoute, Link } from "@tanstack/react-router";
import { RECIPES, GOODS, type Commodity } from "@/shared/factory";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How the Works Work — Brassworks Transit" },
      { name: "description", content: "Factory logistics rules: collection hubs, freight railways, production chains and company contracts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "How the Works Work — Brassworks Transit" },
      { property: "og:description", content: "Learn how to supply industrial companies on real terrain." },
    ],
  }),
  component: How,
});

const rules = [
  ["Collection hubs", "All companies and deposits are present from the start. Drag an iron, coal or timber facility onto dry land within collection range of a matching deposit. You can also select a facility and click the map. Hubs cost 100 credits and automatically gather crates until storage fills."],
  ["Freight railways", "Select a freight route, then click hubs and companies in stop order. A locomotive begins running when the second stop is connected. Cargo is loaded automatically for reachable companies that need it; shared stops allow transfers between routes."],
  ["Production", "Companies retain their recipe inputs and export their outputs. Supply iron and coal to ironworks, timber to sawmills, steel and planks to machine works, and machinery and planks to export houses. Each production cycle pays credits."],
  ["Terrain and crossings", "Real forests, marshes and hills increase rail costs; steep terrain slows freight. Bridges and tunnels are automatically spent when a route crosses water. Wide crossings require tunnels."],
  ["Orders", "Companies continuously consume recipe ingredients. Timed contracts add bonus demand: deliver the requested crates before the deadline for 150 credits. Missed contracts cost 60 credits; they do not erase your factories."],
  ["Weekly shipments", "Each week brings rails and credits plus a choice of one upgrade: collection facilities, locomotives, carriages, crossings, rails or pneumatic freight. The simulation pauses while you choose."],
  ["Industrial report", "The eight-week charter is graded on delivery service, company coverage, route diversity and freight per rail unit. Short runs are penalized, and a single freight route cannot pass. The Chief Engineer reviews your production and contract results."],
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
          {Object.values(RECIPES).map((c) => (
            <div key={c.label}><p className="font-display text-lg">{c.label}</p><p className="text-muted-foreground">{Object.entries(c.inputs).map(([k,n]) => `${n} ${GOODS[k as Commodity].label}`).join(" + ")} → {c.output ? `${c.quantity} ${GOODS[c.output].label}` : "Exports"}</p></div>
          ))}
        </div>
        <Link to="/" className="btn-brass mt-10 inline-block">Back to charters</Link>
      </div>
    </main>
  );
}
