import { describe, expect, it } from 'vitest';
import { JumpingJackTracker } from '@/exercises/tracking/jumpingJack';
import { frontFigure } from '@/core/skeleton';
import {
  baselineFrom,
  currentReps,
  drive,
  findRepEvent,
  frameOf,
  frontStanding,
  jackOpen,
} from '../helpers/pose';

const baseline = baselineFrom(frontStanding());
const closed = frontStanding();
const open = jackOpen();
const partial = frontFigure({
  rootY: 0.56,
  armAbductL: 172,
  armAbductR: 172,
  legSpreadL: 12,
  legSpreadR: 12,
});

describe('JumpingJackTracker', () => {
  it('counts complete open-close cycles', () => {
    const tracker = new JumpingJackTracker();
    const run = drive(
      tracker,
      [
        { pose: closed, ms: 400 },
        { pose: open, ms: 400 },
        { pose: closed, ms: 450 },
        { pose: open, ms: 400 },
        { pose: closed, ms: 450 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(2);
    const events = findRepEvent(run.results);
    expect(events[0].score).toBeGreaterThanOrEqual(85);
    expect(events[0].issues).toHaveLength(0);
  });

  it('does not count opening the arms without the legs', () => {
    const tracker = new JumpingJackTracker();
    const run = drive(
      tracker,
      [
        { pose: closed, ms: 300 },
        { pose: partial, ms: 600 },
        { pose: closed, ms: 500 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
    expect(
      run.results.some((result) => result.cues.some((cue) => cue.code === 'open-all-the-way')),
    ).toBe(true);
  });

  it('warns when the arms are bent', () => {
    const tracker = new JumpingJackTracker();
    const bent = frontFigure({
      rootY: 0.56,
      armAbductL: 150,
      armAbductR: 150,
      elbowL: 65,
      elbowR: 65,
      legSpreadL: 30,
      legSpreadR: 30,
    });
    const run = drive(
      tracker,
      [
        { pose: closed, ms: 300 },
        { pose: bent, ms: 500 },
        { pose: closed, ms: 500 },
      ],
      { baseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(90);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'straight-arms'))).toBe(true);
  });

  it('reports not ready when the wrists are hidden', () => {
    const tracker = new JumpingJackTracker();
    const hidden = frameOf(open, 0, 0.2);
    const result = tracker.update(hidden, { baseline, now: 50, dtMs: 33 });
    expect(result.ready).toBe(false);
    expect(result.reps).toBe(0);
  });

  it('exposes arm and feet chips for the HUD', () => {
    const tracker = new JumpingJackTracker();
    const run = drive(
      tracker,
      [
        { pose: closed, ms: 200 },
        { pose: open, ms: 300 },
      ],
      { baseline },
    );
    expect(run.lastResult.chips.map((chip) => chip.label.split(' ')[0])).toEqual([
      'Arms',
      'Feet',
      'Arms',
    ]);
  });
});
