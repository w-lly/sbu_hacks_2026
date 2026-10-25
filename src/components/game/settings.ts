/** Device-local audio settings shared by the sound board, narrator and settings modal. */
import { useSyncExternalStore } from "react";

export interface AudioSettings { volume: number; gameSound: boolean; narration: boolean }
const KEY = "factory-audio-settings";
const DEFAULTS: AudioSettings = { volume: 0.8, gameSound: true, narration: true };
let current: AudioSettings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { current = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<AudioSettings>) }; } catch { current = DEFAULTS; }
}
export function getSettings(): AudioSettings { load(); return current; }
export function updateSettings(patch: Partial<AudioSettings>) {
  load(); current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}
export function subscribeSettings(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useSettings() { return useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULTS); }
