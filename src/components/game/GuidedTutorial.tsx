import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Btn } from './ui';
import { TUTORIAL_STEPS, TUTORIAL } from './tutorial-steps';
type Point = [number, number];
type Props = { step: number; onStep: (n: number) => void; onClose: () => void; mapPoint: (kind: 'forest' | 'source' | 'destination') => Point | null; orders: boolean };
export function GuidedTutorial({ step, onStep, onClose, mapPoint, orders }: Props) {
  const guide = useRef<HTMLElement>(null);
  const [marks, setMarks] = useState<{ rect: { x: number; y: number; width: number; height: number } | undefined; from: Point; to: Point; dragFrom: Point | undefined } | null>(null);
  const content = TUTORIAL_STEPS[step];
  useEffect(() => {
    const update = () => {
      const box = guide.current?.getBoundingClientRect();
      if (!box || !content) return;
      const element = content.target ? document.querySelector(content.target) : null;
      const r = element?.getBoundingClientRect();
      const p = content.map ? mapPoint(content.map) : r ? [r.x + r.width / 2, r.y + r.height / 2] as Point : null;
      if (!p) { setMarks(null); return; }
      const to: Point = [Math.max(20, Math.min(window.innerWidth - 20, p[0])), Math.max(85, Math.min(window.innerHeight - 65, p[1]))];
      const from: Point = [Math.max(box.left + 20, Math.min(box.right - 20, to[0])), to[1] < box.top ? box.top - 5 : box.bottom + 5];
      setMarks({ from, to, rect: r && content.target !== '.map-stage' ? { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 } : undefined, dragFrom: step === TUTORIAL.drag ? mapPoint('source') ?? undefined : undefined });
    };
    update(); const timer = window.setInterval(update, 180); return () => clearInterval(timer);
  }, [step, content, mapPoint, orders]);
  if (!content) return null;
  const waiting = Boolean(content.action) && !(step === TUTORIAL.orders && orders);
  const arrow = (a: Point, b: Point) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return `M ${a[0]} ${a[1]} L ${b[0] - (b[0] - a[0]) / d * 24} ${b[1] - (b[1] - a[1]) / d * 24}`; };
  return <>
    <svg className="tutorial-directions" aria-hidden="true">
      <defs><marker id="tutorial-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>
      {marks && <>{marks.rect && <rect {...marks.rect} rx="6" className="tutorial-target"/>}<path d={arrow(marks.dragFrom ?? marks.from, marks.to)} markerEnd="url(#tutorial-arrow)" className={marks.dragFrom ? 'tutorial-drag-arrow' : 'tutorial-pointer'}/><circle cx={marks.to[0]} cy={marks.to[1]} r="19" className="tutorial-target"/>{marks.dragFrom && <circle cx={marks.dragFrom[0]} cy={marks.dragFrom[1]} r="19" className="tutorial-target"/>}</>}
    </svg>
    <section ref={guide} className={`tutorial-guide hud tutorial-expanded ${content.map ? 'tutorial-map-step' : ''}`} aria-label="Guided tutorial">
      <div className="tutorial-heading"><span className="tutorial-step">{step + 1} / {TUTORIAL_STEPS.length}</span><Btn title="Skip tutorial" onClick={onClose}><X size={16}/></Btn></div>
      <h2>{content.title}</h2><p>{content.body}</p>
      {waiting && <div className="tutorial-task"><ArrowRight size={15}/>{content.action}</div>}
      <div className="tutorial-navigation"><Btn title="Previous tutorial step" disabled={step === 0} onClick={() => onStep(step - 1)}><ArrowLeft size={16}/>Back</Btn><Btn variant="brass" disabled={waiting} onClick={() => step === TUTORIAL_STEPS.length - 1 ? onClose() : onStep(step + 1)}>{step === TUTORIAL_STEPS.length - 1 ? 'Continue playing' : 'Next'}<ArrowRight size={16}/></Btn></div>
    </section>
  </>;
}