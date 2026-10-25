import { createFileRoute, Link } from "@tanstack/react-router";
import { RECIPES, GOODS, type Commodity } from "@/shared/factory";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How the Works Work — Back On Track" },
      { name: "description", content: "Factory logistics rules: collection hubs, freight railways, production chains and company contracts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "How the Works Work — Back On Track" },
      { property: "og:description", content: "Learn how to supply industrial companies on generated industrial worlds." },
    ],
  }),
  component: How,
});

const rules = [
  ["Collection hubs", "All companies and deposits are present from the start. Drag an iron, coal or timber facility onto dry land within collection range of a matching deposit. You can also select a facility and click the map. Hubs cost 100 credits and automatically gather crates until storage fills."],
  ["Freight railways", "Choose a colored route and drag one building onto another. Free sending and receiving dots are chosen automatically, and the shortest rails go around buildings and obstacles. A locomotive—the engine pulling cargo—starts automatically. Carriages carry extra crates. Boats and pneumatic pipes also connect by dragging between buildings. Escape clears your selection; Ctrl-Z undoes your latest action. Select an end track and press Delete to remove it."],
  ["Production", "Companies retain their recipe inputs and export their outputs. Supply iron and coal to steel mills, timber to sawmills, steel and planks to machine factories, and machinery and planks to shipping depots. Each production cycle pays credits."],
  ["Terrain and crossings", "Green forests supply timber, black deposits supply coal and gray deposits supply iron. Beige ground is ordinary land; blue rivers and dark gray mountains block normal rails. Weekly choices unlock bridges for water, tunnels for mountains and boats for freight between shoreline facilities. Choose river freight and connect two facilities near the same river or lake; docks are placed automatically."],
  ["Orders", "Companies continuously consume ingredients. Orders count matching crates already in storage and new deliveries, without counting the same crate twice. Finish before the timer ends for 150 credits; missed orders cost 60 credits. Numbered gold markers above buildings match the order list. Each building has its own numbered name."],
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
