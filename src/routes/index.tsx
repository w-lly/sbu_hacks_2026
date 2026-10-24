import { createFileRoute, Link } from "@tanstack/react-router";
import { MapThumb } from "@/components/MapThumb";
import { listCharters } from "@/backend/functions/charters.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brassworks Transit — Choose Your Charter" },
      { name: "description", content: "A steampunk factory rail-logistics game on real Long Island and New York terrain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Brassworks Transit" },
      { property: "og:description", content: "Lay the rails. Feed the factories. Forge an empire." },
    ],
  }),
  loader: () => listCharters(),
  component: Index,
});

const badge: Record<string, string> = {
  Tutorial: "text-verdigris border-verdigris/60",
  Medium: "text-brass border-brass/60",
  Hard: "text-rust border-rust/60",
};

function Index() {
  const charters = Route.useLoaderData();
  return (
    <main className="brass-frame relative m-3 min-h-[calc(100vh-1.5rem)] overflow-hidden">
      <Gear className="absolute -left-24 -top-24 h-80 w-80 text-brass/15" />
      <Gear className="absolute -bottom-28 -right-20 h-72 w-72 text-brass/15" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-8 py-16 lg:grid-cols-2 lg:items-center">
        <section>
          <p className="label-caps text-xs text-brass">SBUHacks 2026 · Steel and Steam</p>
          <h1 className="mt-3 font-display text-6xl font-bold text-brass md:text-7xl">BRASSWORKS</h1>
          <p className="font-display text-4xl tracking-[0.35em] text-foreground">TRANSIT</p>
          <div className="my-6 flex items-center gap-3 text-brass"><span className="h-px flex-1 bg-brass/50" />◆<span className="h-px flex-1 bg-brass/50" /></div>
          <p className="text-2xl italic">Lay the rails. Feed the factories. Forge an empire.</p>
          <p className="mt-3 max-w-md text-lg text-muted-foreground">
            Connect iron, coal and timber to industrial companies across real New York terrain. Build supply chains, fulfill contracts and keep the works turning.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/play/$map" params={{ map: "setauket" }} className="label-caps bg-primary px-6 py-3 text-sm text-primary-foreground transition hover:brightness-110">Begin Charter</Link>
            <Link to="/how-it-works" className="label-caps border border-border px-6 py-3 text-sm transition hover:bg-accent">How the works work</Link>
          </div>
        </section>
        <section>
          <h2 className="font-display text-3xl font-semibold">Choose Your Charter</h2>
          <p className="label-caps mb-5 text-xs text-brass">Real ground · industrial companies</p>
          <div className="space-y-4">
            {charters.map((m) => (
              <div key={m.slug} className="flex gap-4 border border-border bg-card/70 p-3 transition hover:border-brass">
                <Link to="/play/$map" params={{ map: m.slug }}><MapThumb thumb={m.thumbnail} /></Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link to="/play/$map" params={{ map: m.slug }} className="font-display text-lg font-semibold hover:text-brass">{m.name}</Link>
                    <span className={`label-caps border px-1.5 py-0.5 text-[10px] ${badge[m.difficulty]}`}>{m.difficulty}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.difficulty === "Tutorial" ? "Coastal mills and woodland supplies." : m.difficulty === "Hard" ? "River crossings and a dense industrial market." : "An inland corridor of interconnected industries."}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="label-caps text-[11px] text-brass">{m.districtCount} companies · real terrain</p>
                    <Link to="/play/$map" params={{ map: m.slug }} className="label-caps text-[11px] text-verdigris hover:underline">Open charter →</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <p className="label-caps absolute bottom-3 left-5 text-[10px] text-muted-foreground">Map data © OpenStreetMap contributors · Elevation: Open-Meteo / Copernicus DEM</p>
    </main>
  );
}

export function Gear({ className }: { className?: string }) {
  const teeth = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
      {teeth.map((a) => <rect key={a} x="45" y="2" width="10" height="16" transform={`rotate(${a} 50 50)`} />)}
      <circle cx="50" cy="50" r="36" /><circle cx="50" cy="50" r="14" className="fill-background" />
    </svg>
  );
}
