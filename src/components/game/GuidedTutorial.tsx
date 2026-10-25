import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Btn } from './ui';
import { TUTORIAL_STEPS, TUTORIAL } from './tutorial-steps';
type Point = [number, number];
type Props = { step: number; onStep: (n: number) => void; onClose: () => void; mapPoint: (kind: 'forest' | 'source' | 'destination') => Point | null; orders: boolean };
export function GuidedTutorial({ step, onStep, onClose, orders }: Props) {
  const guide = useRef<HTMLElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const content = TUTORIAL_STEPS[step];
  useEffect(() => {
    const update = () => {
      if (!content) return;
      const element = content.target ? document.querySelector(content.target) : null;
      const r = element?.getBoundingClientRect();
      setRect(r && content.target !== '.map-stage' ? { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 } : null);
    };
    update(); const timer = window.setInterval(update, 180); return () => clearInterval(timer);
  }, [step, content, orders]);
  if (!content) return null;
  const waiting = Boolean(content.action) && !(step === TUTORIAL.orders && orders);
  return <>
    {rect && <svg className="tutorial-directions" aria-hidden="true"><rect {...rect} rx="6" className="tutorial-target"/></svg>}
    <section ref={guide} className={`tutorial-guide hud tutorial-expanded ${content.map ? 'tutorial-map-step' : ''}`} aria-label="Guided tutorial">
      <div className="tutorial-heading"><span className="tutorial-step">{step + 1} / {TUTORIAL_STEPS.length}</span><Btn title="Skip tutorial" onClick={onClose}><X size={16}/></Btn></div>
      <h2>{content.title}</h2><p>{content.body}</p>
      {waiting && <div className="tutorial-task"><ArrowRight size={15}/>{content.action}</div>}
      <div className="tutorial-navigation"><Btn title="Previous tutorial step" disabled={step === 0} onClick={() => onStep(step - 1)}><ArrowLeft size={16}/>Back</Btn><Btn variant="brass" disabled={waiting} onClick={() => step === TUTORIAL_STEPS.length - 1 ? onClose() : onStep(step + 1)}>{step === TUTORIAL_STEPS.length - 1 ? 'Continue playing' : 'Next'}<ArrowRight size={16}/></Btn></div>
    </section>
  </>;
}
