import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { GameScreen } from "@/components/game/GameScreen";
import { getCharter } from "@/backend/functions/charters.functions";

export const Route = createFileRoute("/play/$map")({
  validateSearch: z.object({ ai: z.boolean().optional() }),
  loaderDeps: ({ search }) => ({ ai: search.ai ?? false }),
  loader: async ({ params, deps }) => {
    const charter = await getCharter({ data: { slug: params.map, ai: deps.ai } });
    if (!charter) throw notFound();
    return charter;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Survey"} — Brassworks Transit` },
      { name: "description", content: `Build a steam transit network across the real ground of ${loaderData?.name ?? "the city"}.` },
      { property: "og:title", content: `${loaderData?.name ?? "Survey"} — Brassworks Transit` },
      { property: "og:description", content: "Lay the rails. Move the city. Learn why it works." },
    ],
  }),
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="font-display animate-pulse text-2xl text-brass">Surveying the ground…</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="font-display text-2xl">No such charter.</p>
      <Link to="/" className="btn-brass">Back to charters</Link>
    </div>
  ),
  ssr: false,
  component: Play,
});

function Play() {
  const charter = Route.useLoaderData();
  return <GameScreen key={charter.slug + charter.scenario.source} charter={charter} />;
}
