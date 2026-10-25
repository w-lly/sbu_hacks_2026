import type { FactoryGame } from "@/game/factory";
import type { EngineerFeedback } from "@/shared/types";
import { Btn, Modal } from "./ui";

export function WeekModal({ game, week, feedback, onPick }: { game: FactoryGame; week: number; feedback: EngineerFeedback | null; onPick: (i: number) => void }) {
  return (
    <Modal>
      <div className="weekly-event">
      <p className="label-caps text-xs text-brass">End of week {week} · requisition</p>
      <h2 className="font-display text-2xl">The board grants you one shipment</h2>
      <p className="text-sm text-muted-foreground">The board supplies additional rails and operating credits.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {game.offers.map((o, i) => (
          <Btn key={o.id} onClick={() => onPick(i)} className="weekly-offer border border-border bg-background/40 text-left transition hover:border-brass hover:bg-accent">
            <div className="mb-2 text-base font-semibold text-brass">{o.label}</div>
            <div className="text-sm text-muted-foreground">{o.description}</div>
          </Btn>
        ))}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <p className="label-caps text-xs text-brass">The Chief Engineer's dispatch</p>
        {feedback ? (
          <>
            <p className="dispatch-headline text-lg font-semibold">{feedback.headline}</p>
            <ul className="mt-2 space-y-3">{feedback.notes.slice(0, 2).map((n) => <li key={n} className="border-l-2 border-brass pl-3 text-sm leading-relaxed">{n}</li>)}</ul>
          </>
        ) : <p className="animate-pulse text-sm italic text-muted-foreground">The Engineer is studying your blueprints…</p>}
      </div>
      </div>
    </Modal>
  );
}
