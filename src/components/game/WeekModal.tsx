import type { FactoryGame } from "@/game/factory";
import type { EngineerFeedback } from "@/shared/types";
import { Btn, Modal } from "./ui";
import { TrainFront, Trees, Package, Waypoints, Waves, Mountain, Ship, Route } from "lucide-react";
import { ArtIcon, GoodIcon } from "./icons";
const upgradeIcons: Record<string, typeof TrainFront> = {line:Route,hubs:Trees,train:TrainFront,wagons:Package,track:Waypoints,bridge:Waves,tunnel:Mountain,boat:Ship,tube:Waypoints};

export function WeekModal({ game, week, feedback, onPick }: { game: FactoryGame; week: number; feedback: EngineerFeedback | null; onPick: (i: number) => void }) {
  const advice = game.contractsMissed > 0 ? "Supply the order with the least time left." : game.hubs.some(h => Object.values(h.stock).some(n => n >= 20)) ? "Add trains or carriages where cargo is piling up." : "Connect more collectors to factories that need supplies.";
  return (
    <Modal>
      <div className="weekly-event">
      <p className="label-caps text-xs text-brass">Week {week} complete</p>
      <h2 className="font-display text-2xl">Choose one upgrade</h2>
      <p className="text-sm text-muted-foreground">Your extra track and credits are already added.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {game.offers.map((o, i) => {const Icon=upgradeIcons[o.id]??Package;return (
          <Btn key={o.id} onClick={() => onPick(i)} className="weekly-offer border border-border bg-background/40 text-left transition hover:border-brass hover:bg-accent">
            <div className="mb-2 flex items-center gap-2 text-base font-semibold text-brass">{o.id==="train"||o.id==="line"?<ArtIcon kind="train" size={24}/>:o.id==="wagons"?<ArtIcon kind="carriage" size={24}/>:o.id==="hubs"?<GoodIcon good="timber" size={24}/>:o.id==="bridge"||o.id==="tunnel"||o.id==="boat"?<ArtIcon kind={o.id} size={24}/>:o.id==="tube"?<ArtIcon kind="pipe" size={24}/>:<Icon size={24} aria-hidden="true"/>}{o.label}</div>
            <div className="text-sm text-muted-foreground">{o.description}</div>
          </Btn>
        );})}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="label-caps text-xs text-brass">Engineer’s tip</p>
        <p className="dispatch-headline text-sm">{advice}</p>
        <p className="text-sm text-muted-foreground">{game.products} products made · {game.contractsCompleted} orders filled</p>
      </div>
      </div>
    </Modal>
  );
}
