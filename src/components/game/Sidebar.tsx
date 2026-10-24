import { Link } from "@tanstack/react-router";
import { CONFIG } from "@/game/config";
import { clockLabel, periodLabel } from "@/game/demand";
import { isLoop, type Game } from "@/game/engine";
import type { Tool } from "./useGameSession";
import { Btn, Panel, Stat } from "./ui";

interface Props {
  game: Game; name: string; tool: Tool; setTool: (t: Tool) => void;
  act: (fn: (g: Game) => string | null | void, ok?: string) => void; message: string;
  onPrimer: () => void; onEnd: () => void;
}

export function Sidebar({ game, name, tool, setTool, act, message, onPrimer, onEnd }: Props) {
  const inv = game.inv;
  const weekPct = (game.weekTime / CONFIG.week.seconds) * 100;
  const rails = game.railLines();
  const tubes = game.lines.filter((l) => l.type === "tube");
  return (
    <aside className="brass-frame flex w-full shrink-0 flex-col gap-4 overflow-y-auto bg-card/70 p-4 lg:h-[calc(100vh-1.5rem)] lg:w-80">
      <div className="flex items-center justify-between">
        <Link to="/" className="label-caps text-[11px] text-muted-foreground hover:text-brass">← Charters</Link>
        <button onClick={onPrimer} className="label-caps text-[11px] text-muted-foreground hover:text-brass">Engineering primer</button>
      </div>
      <div>
        <h1 className="font-display text-xl leading-tight text-brass">{name}</h1>
        <p className="text-sm italic text-muted-foreground">{game.charter.scenario.title}{game.charter.scenario.source === "ai" ? " · drafted by AI" : ""}</p>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-lg">Week {game.week}<span className="text-sm text-muted-foreground"> / {CONFIG.week.total}</span></span>
          <span className="label-caps text-[11px] text-muted-foreground">{clockLabel(game.hourOfDay)} · {periodLabel(game.hourOfDay)}</span>
        </div>
        <div className="mt-1 h-1.5 bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${weekPct}%` }} /></div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="Riders" value={game.delivered} />
        <Stat label="Gave up" value={game.stranded} tone={game.stranded > game.delivered * 0.3 ? "warn" : undefined} />
        <Stat label="Districts" value={game.activeStations.length} />
        <Stat label="Track" value={Math.round(inv.track)} />
      </div>

      <Panel title="Stores">
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
          {([
            ["Locomotives", inv.locomotives], ["Carriages", inv.carriages], ["Bridges", inv.bridges],
            ["Tunnels", inv.tunnels], ["Interchanges", inv.interchanges], ["Tubes", inv.tubes],
          ] as const).map(([k, v]) => (
            <div key={k} className="border border-border py-1">
              <div className="font-display text-base text-foreground">{v}</div>
              <div className="label-caps text-[9px] text-muted-foreground">{k}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Rail lines">
        <div className="space-y-1.5">
          {rails.map((l) => {
            const selected = tool.kind === "rail" && tool.line === l.id;
            const built = l.stops.length > 1;
            const coalLow = l.trains.some((t) => t.coal <= 0);
            return (
              <div key={l.id} className={`border p-2 ${selected ? "border-brass bg-accent" : "border-border"}`}>
                <button className="flex w-full items-center gap-2 text-left" onClick={() => setTool({ kind: "rail", line: l.id })}>
                  <span className="h-2.5 w-7 shrink-0 border border-ink" style={{ background: l.color }} />
                  <span className="label-caps flex-1 text-xs">{l.name}{isLoop(l) ? " · loop" : ""}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {built ? `${l.stops.length - (isLoop(l) ? 1 : 0)} stops · ${l.trains.length}🚂 · +${l.carriages}` : l.stops.length ? "anchored" : "unbuilt"}
                  </span>
                </button>
                {coalLow && <p className="mt-1 text-[11px] text-destructive">Out of coal. Link a coal depot.</p>}
                {selected && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Btn disabled={!built || inv.locomotives < 1} onClick={() => act((g) => g.addTrain(l.id), "Another locomotive joins the line.")}>+ Loco</Btn>
                    <Btn disabled={!built || inv.carriages < 1} onClick={() => act((g) => g.addCarriage(l.id), "Carriage coupled.")}>+ Carriage</Btn>
                    <Btn disabled={!l.stops.length} onClick={() => act((g) => g.undoLast(l.id), "Last stop removed; materials refunded.")}>Undo stop</Btn>
                    <Btn variant="danger" disabled={!l.stops.length} onClick={() => act((g) => g.clearLine(l.id), "Line cleared; materials refunded.")}>Clear</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Special works">
        <div className="grid grid-cols-2 gap-1.5">
          <Btn variant={tool.kind === "tube" ? "brass" : "ghost"} onClick={() => setTool({ kind: "tube", from: null })} title="Fast point-to-point express">Pneumatic tube ({inv.tubes})</Btn>
          <Btn variant={tool.kind === "interchange" ? "brass" : "ghost"} onClick={() => setTool({ kind: "interchange" })} title="Bigger platforms, faster transfers">Interchange ({inv.interchanges})</Btn>
        </div>
        {tubes.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {tubes.map((t) => (
              <li key={t.id} className="flex items-center justify-between border border-border px-2 py-1">
                <span>{game.stations[t.stops[0]!]!.name.split(" ")[0]} ⇄ {game.stations[t.stops[1]!]!.name.split(" ")[0]}</span>
                <button className="label-caps text-[10px] text-muted-foreground hover:text-destructive" onClick={() => act((g) => g.clearLine(t.id), "Tube removed.")}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="min-h-10 border-l-2 border-brass pl-3 text-sm italic text-muted-foreground">{message}</p>

      <div className="mt-auto space-y-2">
        <Legend />
        <Btn variant="brass" className="w-full" onClick={onEnd}>End survey & file report</Btn>
      </div>
    </aside>
  );
}

function Legend() {
  return (
    <div className="label-caps grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
      <span>● Commuters</span><span>■ Students</span><span>▲ Shoppers</span><span>⬣ Coal depot</span>
      <span>⌂ Crew barracks</span><span>⚙ Repair yard</span><span>▬ Iron foundry</span><span>Hatched: woods</span>
    </div>
  );
}
