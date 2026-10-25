import { describe, expect, it } from 'vitest';
import { tutorialAllowsSimulation } from './tutorial-steps';
describe('Guided tutorial clock', () => {
  it('pauses for instruction steps so orders cannot expire while reading', () => {
    for (let step = 0; step < 27; step++) if (step !== 7) expect(tutorialAllowsSimulation(step)).toBe(false);
  });
  it('runs the first delivery and resumes normal play after closing', () => {
    expect(tutorialAllowsSimulation(7)).toBe(true);
    expect(tutorialAllowsSimulation(null)).toBe(true);
  });
});