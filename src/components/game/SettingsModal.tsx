import { X } from "lucide-react";
import { Btn, Modal } from "./ui";
import { updateSettings, useSettings } from "./settings";
import { narrate, useVoiceAvailable } from "./narrator";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useSettings(), voice = useVoiceAvailable();
  return (
    <Modal>
      <section aria-label="Settings">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Settings</h2>
          <Btn title="Close settings" onClick={onClose}><X size={16} /></Btn>
        </div>
        <label className="mt-5 block">
          <span className="label-caps text-xs text-brass">Volume · {Math.round(s.volume * 100)}%</span>
          <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} className="settings-range mt-2 w-full" />
        </label>
        <label className="settings-toggle mt-4">
          <span><strong>Game sounds</strong><small>Trains, deliveries, building and movement</small></span>
          <input type="checkbox" checked={s.gameSound} onChange={(e) => updateSettings({ gameSound: e.target.checked })} />
        </label>
        <label className="settings-toggle mt-3">
          <span><strong>Narration</strong><small>{voice ? "Read tutorials, orders and popups aloud (ElevenLabs)" : "Unavailable: ElevenLabs API key missing or not working"}</small></span>
          <input type="checkbox" checked={voice && s.narration} disabled={!voice} onChange={(e) => { updateSettings({ narration: e.target.checked }); if (e.target.checked) narrate("Narration is on."); }} />
        </label>
      </section>
    </Modal>
  );
}
