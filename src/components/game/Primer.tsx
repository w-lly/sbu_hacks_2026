import { CONCEPTS } from "@/shared/concepts";
import { Btn, Modal } from "./ui";

export function Primer({ onClose }: { onClose: () => void }) {
  return (
    <Modal wide>
      <p className="label-caps text-xs text-brass">Engineering primer</p>
      <h2 className="font-display text-2xl">Principles of the iron road</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Object.values(CONCEPTS).map((c) => (
          <div key={c.title} className="border-l-2 border-brass pl-3">
            <p className="font-display text-lg">{c.title}</p>
            <p className="text-sm text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>
      <Btn variant="brass" className="mt-5 w-full" onClick={onClose}>Back to the survey</Btn>
    </Modal>
  );
}
