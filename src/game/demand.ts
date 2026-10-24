/** Time-of-day demand waves. hour is 0-24. */
import type { RiderKind } from "@/shared/types";

export function timeOfDayMultiplier(kind: RiderKind, hour: number): number {
  if (hour < 5 || hour >= 22) return 0.3;
  const rush = (hour >= 7 && hour < 9.5) || (hour >= 16.5 && hour < 19);
  if (kind === "commuter") return rush ? 2.2 : 0.8;
  if (kind === "student") return hour >= 8 && hour < 15 ? 1.7 : 0.6;
  return hour >= 11 && hour < 19 ? 1.7 : 0.6;
}

export function periodLabel(hour: number) {
  if (hour < 5 || hour >= 22) return "Night";
  if (hour < 9.5 && hour >= 7) return "Morning rush";
  if (hour >= 16.5 && hour < 19) return "Evening rush";
  if (hour < 12) return "Morning";
  if (hour < 16.5) return "Afternoon";
  return "Evening";
}

export function clockLabel(hour: number) {
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m.toString().padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
