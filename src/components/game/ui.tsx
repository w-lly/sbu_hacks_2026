/** Small presentational primitives shared by game UI. */
import type { ReactNode, ButtonHTMLAttributes } from "react";

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="label-caps text-[11px] text-brass">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "warn" | undefined }) {
  return (
    <div className="border border-border bg-background/40 px-1 py-1.5 text-center">
      <div className={`font-display text-lg leading-tight ${tone === "warn" ? "text-destructive" : "text-brass"}`}>{value}</div>
      <div className="label-caps text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function Btn({ children, variant = "ghost", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "brass" | "ghost" | "danger" }) {
  const v = variant === "brass" ? "btn-brass" : variant === "danger" ? "btn-danger" : "btn-ghost";
  return <button type="button" {...props} className={`${v} ${className}`}>{children}</button>;
}

export function Modal({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div role="dialog" aria-modal="true" className="reference-theme fixed inset-0 z-20 flex items-center justify-center bg-background/75 p-4 backdrop-blur-[2px]">
      <div className={`brass-frame max-h-full w-full overflow-y-auto bg-card p-6 ${wide ? "max-w-3xl" : "max-w-xl"}`}>{children}</div>
    </div>
  );
}
