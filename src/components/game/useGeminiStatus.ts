import { useEffect, useState } from "react";
import { geminiStatus } from "@/backend/functions/director.functions";

/** Polls the Gemini reachability check so the HUD can show an online/offline icon. */
export function useGeminiStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let stopped = false;
    const ping = () =>
      geminiStatus()
        .then((r) => { if (!stopped) setOnline(r.online); })
        .catch(() => { if (!stopped) setOnline(false); });
    void ping();
    const timer = setInterval(ping, 60000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);
  return online;
}
