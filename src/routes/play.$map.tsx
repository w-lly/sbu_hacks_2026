import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { GameScreen } from "@/components/game/GameScreen";
import { useEffect, useState } from "react";
import { levelUnlocked, readCompleted, LEVEL_NAMES } from "@/shared/levels";
import { localCharter } from "@/shared/local-charters";

export const Route = createFileRoute("/play/$map")({
  validateSearch: z.object({ ai: z.boolean().optional() }),
  loaderDeps: ({ search }) => ({ ai: search.ai ?? false }),
  loader: async ({ params, deps }) => {
    const charter = localCharter(params.map);
    if (!charter) throw notFound();
    return charter;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Survey"} — Back On Track` },
      { name: "description", content: `Build an industrial freight network in the generated world of ${loaderData?.name ?? "the city"}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: `${loaderData?.name ?? "Survey"} — Back On Track` },
      { property: "og:description", content: "Collect resources, supply companies and fulfill industrial contracts." },
    ],
  }),
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="font-display animate-pulse text-2xl text-brass">Opening map…</p>
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
  const [unlocked,setUnlocked]=useState(false);
  useEffect(()=>setUnlocked(levelUnlocked(charter.slug,readCompleted())),[charter.slug]);
  if(!unlocked)return <main className="flex min-h-screen flex-col items-center justify-center gap-4"><h1 className="font-display text-3xl">{LEVEL_NAMES[charter.slug]} is locked</h1><Link to="/" className="btn-brass">Back to levels</Link></main>;
  return <GameScreen key={charter.slug + charter.scenario.source} charter={charter} />;
}
