/** ElevenLabs narration queue for popups. Silently disabled when no key/credits are available. */
import { useSyncExternalStore } from "react";
import { narrateText, voiceStatus } from "@/backend/functions/voice.functions";
import { getSettings, subscribeSettings } from "./settings";

const cache = new Map<string, Promise<string | null>>();
let queue: string[] = [];
let playing: HTMLAudioElement | null = null;
let unavailable = false, checked: Promise<void> | null = null;
const statusListeners = new Set<() => void>();
function markUnavailable() { if (!unavailable) { unavailable = true; statusListeners.forEach((l) => l()); } }
function checkStatus() { checked ??= voiceStatus().then((r) => { if (!r.available) markUnavailable(); }).catch(() => markUnavailable()); return checked; }
/** False when ElevenLabs is not configured or has failed (bad key / no credits). */
export function useVoiceAvailable() {
  return useSyncExternalStore((l) => { statusListeners.add(l); void checkStatus(); return () => { statusListeners.delete(l); }; }, () => !unavailable, () => true);
}

function fetchAudio(text: string) {
  let p = cache.get(text);
  if (!p) {
    p = narrateText({ data: { text } }).then((r) => {
      if (!r.audio) { if (r.error === "missing_key" || r.error === "status_401" || r.error === "status_402") markUnavailable(); cache.delete(text); return null; }
      return `data:audio/mpeg;base64,${r.audio}`;
    }).catch(() => { cache.delete(text); return null; });
    cache.set(text, p);
  }
  return p;
}

async function pump() {
  if (playing || !queue.length) return;
  const text = queue.shift()!;
  const url = await fetchAudio(text);
  const s = getSettings();
  if (!url || !s.narration) { void pump(); return; }
  const audio = new Audio(url); audio.volume = s.volume; playing = audio;
  const done = () => { if (playing === audio) playing = null; void pump(); };
  audio.onended = done; audio.onerror = done;
  audio.play().catch(done);
}

/** Speak text; `interrupt` replaces whatever is queued (for tutorial steps). */
export function narrate(text: string, interrupt = false) {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!clean || unavailable || typeof window === "undefined" || !getSettings().narration) return;
  if (interrupt) stopNarration();
  if (queue.includes(clean)) return;
  queue = [...queue.slice(-2), clean];
  void pump();
}
export function stopNarration() { queue = []; if (playing) { playing.pause(); playing = null; } }

subscribeSettings(() => { const s = getSettings(); if (!s.narration) stopNarration(); else if (playing) playing.volume = s.volume; });
