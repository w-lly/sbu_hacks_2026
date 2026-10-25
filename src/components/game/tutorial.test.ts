import { describe, expect, it } from 'vitest';
import { TUTORIAL, TUTORIAL_STEPS, tutorialAllowsSimulation } from './tutorial-steps';
describe('Guided tutorial clock', () => {
  it('pauses for instruction steps so orders cannot expire while reading', () => {
    for (let step = 0; step < TUTORIAL_STEPS.length; step++) if (step !== TUTORIAL.delivery) expect(tutorialAllowsSimulation(step)).toBe(false);
  });
  it('runs the first delivery and resumes normal play after closing', () => {
    expect(tutorialAllowsSimulation(TUTORIAL.delivery)).toBe(true);
    expect(tutorialAllowsSimulation(null)).toBe(true);
  });
  it('walks the basic supply chain first: collector, place, route, drag, delivery', () => {
    expect(TUTORIAL.collector).toBe(1);
    expect(TUTORIAL.place).toBe(2);
    expect(TUTORIAL.route).toBe(3);
    expect(TUTORIAL.drag).toBe(4);
    expect(TUTORIAL.delivery).toBe(5);
    expect(TUTORIAL.produced).toBe(6);
  });
});
