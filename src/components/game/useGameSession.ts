/**
 * Binds a Game instance to React: animation loop, input tools, sounds, toasts and AI feedback calls.
 * UI components read live state from `game` and re-render on `tick`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Charter, EngineerFeedback, NetworkMetrics } from "@/shared/types";
import { fallbackFeedback } from "@/shared/engineer-rules";
import { getEngineerFeedback } from "@/backend/functions/engineer.functions";
import { SoundBoard } from "@/game/audio/sound";
import { CONFIG } from "@/game/config";
import { Game } from "@/game/engine";
import { Renderer, type Overlay } from "@/game/render/renderer";

export type Tool = { kind: "rail"; line: number } | { kind: "tube"; from: number | null } | { kind: "interchange" };
export interface Toast { id: number; title: string; body?: string; tone: "info" | "warn" | "good" }

const RESOURCE_TOAST = {
  coal: "Coal depot linked: trains refuel here.",
  barracks: "Crew barracks linked: crews change shifts here.",
  repair: "Repair yard linked: boilers are serviced here.",
  foundry: `Iron foundry linked: +${CONFIG.resources.foundryTrack} track.`,
} as const;

export function useGameSession(charter: Charter, runKey: number, seed: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const soundRef = useRef(new SoundBoard());
  const [tick, setTick] = useState(0);
  const [tool, setTool] = useState<Tool>({ kind: "rail", line: 0 });
  const toolRef = useRef(tool); toolRef.current = tool;
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(speed); speedRef.current = speed;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [message, setMessage] = useState("Select a line, then click districts to lay track.");
  const [weekly, setWeekly] = useState<{ week: number; feedback: EngineerFeedback | null; metrics: NetworkMetrics } | null>(null);
  const [muted, setMuted] = useState(false);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000);
  }, []);

  useEffect(() => { soundRef.current.muted = muted; }, [muted]);

  useEffect(() => {
    const game = new Game(charter, seed);
    gameRef.current = game;
    // Dev convenience: inspect the running sim from the console / browser tests.
    if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = game;
    setWeekly(null); setPaused(false); setTool({ kind: "rail", line: 0 });
    const canvas = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CONFIG.canvas.width * dpr; canvas.height = CONFIG.canvas.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const renderer = new Renderer(ctx, game, dpr);
    const sfx = soundRef.current;

    const off = game.on((e) => {
      switch (e.type) {
        case "deliver": sfx.deliver(); break;
        case "depart": sfx.chuff(); break;
        case "breakdown": sfx.clank(); toast({ title: "Boiler failure", body: `A train on ${game.lines[e.line]?.name ?? "a line"} has broken down.`, tone: "warn" }); break;
        case "scenario": sfx.whistle(); toast({ title: e.title, body: e.description, tone: "info" }); break;
        case "claim": sfx.bell(); toast({ title: game.stations[e.station]!.name, body: RESOURCE_TOAST[e.kind], tone: "good" }); break;
        case "reveal": toast({ title: "New district chartered", body: game.stations[e.station]!.name, tone: "info" }); break;
        case "fail": sfx.horn(); break;
        case "complete": sfx.bell(); break;
        case "week": {
          sfx.bell();
          const metrics = game.metrics();
          setWeekly({ week: e.week, feedback: null, metrics });
          if (game.phase !== "complete") {
            getEngineerFeedback({ data: { metrics, final: false } })
              .catch(() => fallbackFeedback(metrics))
              .then((feedback) => setWeekly((w) => (w && w.week === e.week ? { ...w, feedback } : w)));
          }
          break;
        }
      }
    });

    let raf = 0, last = performance.now(), uiT = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!pausedRef.current) for (let i = 0; i < speedRef.current; i++) game.step(dt);
      renderer.draw(pausedRef.current ? 0 : dt, overlayFor(game, toolRef.current, hover.current));
      uiT += dt;
      if (uiT > 0.2) { uiT = 0; setTick((t) => t + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); off(); };
  }, [charter, runKey, seed, toast]);

  const toCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CONFIG.canvas.width, y: ((e.clientY - r.top) / r.height) * CONFIG.canvas.height };
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => { hover.current = toCanvas(e); };
  const onLeave = () => { hover.current = null; };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current; if (!g || g.phase === "failed" || g.phase === "complete") return;
    soundRef.current.unlock();
    const { x, y } = toCanvas(e);
    const idx = g.stationAt(x, y);
    if (idx < 0) return;
    const t = toolRef.current;
    const sfx = soundRef.current;
    if (t.kind === "rail") {
      const res = g.extend(t.line, idx);
      if (res.ok) { sfx.build(); setMessage(`${g.stations[idx]!.name} joined ${g.lines[t.line]!.name}.`); }
      else { sfx.error(); setMessage(res.error ?? "Cannot build there."); }
    } else if (t.kind === "tube") {
      if (t.from === null) { setTool({ kind: "tube", from: idx }); setMessage("Now pick the other end of the tube."); return; }
      const res = g.buildTube(t.from, idx);
      if (res.ok) { sfx.build(); setMessage("Pneumatic tube laid."); } else { sfx.error(); setMessage(res.error ?? ""); }
      setTool({ kind: "tube", from: null });
    } else {
      const err = g.placeInterchange(idx);
      if (err) { sfx.error(); setMessage(err); } else { sfx.build(); setMessage(`${g.stations[idx]!.name} is now an interchange.`); }
    }
    setTick((n) => n + 1);
  };

  const act = (fn: (g: Game) => string | null | void, ok?: string) => {
    const g = gameRef.current; if (!g) return;
    const err = fn(g);
    if (err) { soundRef.current.error(); setMessage(err); } else if (ok) setMessage(ok);
    setTick((n) => n + 1);
  };

  return {
    canvasRef, game: gameRef.current, tick, tool, setTool, paused, setPaused, speed, setSpeed, muted, setMuted,
    toasts, message, setMessage, weekly, setWeekly, onClick, onMove, onLeave, act, hoverRef: hover,
  };
}

function overlayFor(game: Game, tool: Tool, hover: { x: number; y: number } | null): Overlay {
  const hoverStation = hover ? game.stationAt(hover.x, hover.y) : -1;
  const o: Overlay = { hoverStation, ghost: null, selectedLine: tool.kind === "rail" ? tool.line : null, tubeFrom: tool.kind === "tube" ? tool.from : null };
  if (!hover || game.phase !== "running" && game.phase !== "picking") return o;
  if (tool.kind === "rail") {
    const line = game.lines[tool.line];
    if (!line || !line.stops.length) return o;
    const target = hoverStation >= 0 ? hoverStation : -1;
    if (target < 0) return o;
    const plan = game.planExtend(tool.line, target);
    const from = plan.from !== undefined ? game.stations[plan.from]!.pos : game.stations[line.stops[line.stops.length - 1]!]!.pos;
    o.ghost = { from, to: game.stations[target]!.pos, plan, color: line.color };
  } else if (tool.kind === "tube" && tool.from !== null) {
    const from = game.stations[tool.from]!.pos;
    const plan = hoverStation >= 0 ? game.planTube(tool.from, hoverStation) : { ok: true };
    o.ghost = { from, to: hoverStation >= 0 ? game.stations[hoverStation]!.pos : [hover.x, hover.y], plan, color: "#9a7b4f" };
  }
  return o;
}
