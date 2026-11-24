import { describe, expect, it } from 'vitest';
import { SquatTracker } from '@/exercises/tracking/squat';
import {
  baselineFrom,
  currentReps,
  drive,
  findRepEvent,
  frameOf,
  sideStanding,
  squatPose,
} from '../helpers/pose';

const baseline = baselineFrom(sideStanding());
const standing = sideStanding();
const deep = squatPose({ hipFlex: 95, kneeBend: 115, lean: 5, armFlex: 90 });
const medium = squatPose({ hipFlex: 60, kneeBend: 65, lean: 5, armFlex: 90 });
const mid = squatPose({ hipFlex: 70, kneeBend: 80, lean: 5, armFlex: 90 });
const shallow = squatPose({ hipFlex: 40, kneeBend: 45, lean: 5, armFlex: 90 });

describe('SquatTracker', () => {
  it('counts complete squats with clean technique', () => {
    const tracker = new SquatTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: mid, ms: 220 },
        { pose: deep, ms: 500 },
        { pose: mid, ms: 200 },
        { pose: standing, ms: 500 },
        { pose: mid, ms: 220 },
        { pose: deep, ms: 500 },
        { pose: mid, ms: 200 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(2);
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(2);
    expect(events[0].score).toBeGreaterThanOrEqual(85);
    expect(events[0].issues).toHaveLength(0);
    expect(run.lastResult.chips.some((chip) => chip.label.startsWith('Depth'))).toBe(true);
  });

  it('ignores small bounces and shallow movements', () => {
    const tracker = new SquatTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: shallow, ms: 400 },
        { pose: standing, ms: 400 },
        { pose: squatPose({ hipFlex: 20, kneeBend: 20 }), ms: 350 },
        { pose: standing, ms: 350 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });

  it('counts a shallow squat but flags it and scores lower', () => {
    const tracker = new SquatTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: medium, ms: 650 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(85);
    expect(events[0].issues.join(' ')).toMatch(/deep/i);
    expect(
      run.results.some((result) => result.cues.some((cue) => cue.code === 'deeper')),
    ).toBe(true);
  });

  it('reduces the score for excessive forward lean', () => {
    const tracker = new SquatTracker();
    const leaning = squatPose({ hipFlex: 95, kneeBend: 115, lean: 50, armFlex: 90 });
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: leaning, ms: 650 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(95);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'chest-up'))).toBe(true);
  });

  it('stops counting when the legs are not visible', () => {
    const tracker = new SquatTracker();
    const hidden = frameOf(deep, 0, 0.1);
    const result = tracker.update(hidden, { baseline, now: 100, dtMs: 33 });
    expect(result.ready).toBe(false);
    expect(result.reps).toBe(0);
    expect(result.cues[0].code).toBe('body-lost');
  });

  it('reports progress toward depth while descending', () => {
    const tracker = new SquatTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 200 },
        { pose: deep, ms: 300 },
      ],
      { baseline },
    );
    expect(run.lastResult.progress).toBeGreaterThan(0.7);
    expect(run.lastResult.stateLabel).toMatch(/squat/i);
  });

  it('does not count without a completed return to standing', () => {
    const tracker = new SquatTracker();
    const run = drive(tracker, [{ pose: deep, ms: 1200 }], { baseline });
    expect(currentReps(run.results)).toBe(0);
  });
});
