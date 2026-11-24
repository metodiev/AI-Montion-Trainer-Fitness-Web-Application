import { describe, expect, it } from 'vitest';
import { BurpeeTracker } from '@/exercises/tracking/burpee';
import { JumpSquatTracker } from '@/exercises/tracking/jumpSquat';
import { plankFigure } from '@/core/skeleton';
import {
  baselineFrom,
  currentReps,
  drive,
  findRepEvent,
  frameOf,
  jumpPose,
  sideStanding,
  squatPose,
} from '../helpers/pose';

const baseline = baselineFrom(sideStanding());
const standing = sideStanding();
const crouch = squatPose({ hipFlex: 100, kneeBend: 110, lean: 10, armFlex: 5 });
const plank = plankFigure();
const jump = jumpPose(0.06);
const mid = squatPose({ hipFlex: 70, kneeBend: 80, lean: 5, armFlex: 60 });
const deep = squatPose({ hipFlex: 95, kneeBend: 115, lean: 5, armFlex: 90 });

describe('BurpeeTracker', () => {
  it('counts a complete stand-crouch-plank-jump sequence', () => {
    const tracker = new BurpeeTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: crouch, ms: 300 },
        { pose: plank, ms: 500 },
        { pose: crouch, ms: 250 },
        { pose: jump, ms: 300 },
        { pose: standing, ms: 400 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(1);
    const events = findRepEvent(run.results);
    expect(events[0].score).toBeGreaterThanOrEqual(80);
  });

  it('does not count when the jump is missing', () => {
    const tracker = new BurpeeTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: crouch, ms: 300 },
        { pose: plank, ms: 500 },
        { pose: crouch, ms: 250 },
        { pose: standing, ms: 3000 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
    expect(
      run.results.some((result) =>
        result.cues.some((cue) => cue.message.toLowerCase().includes('jump')),
      ),
    ).toBe(true);
  });

  it('does not count a standalone squat', () => {
    const tracker = new BurpeeTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: crouch, ms: 800 },
        { pose: standing, ms: 800 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });

  it('reports not ready when landmarks vanish', () => {
    const tracker = new BurpeeTracker();
    const result = tracker.update(frameOf(crouch, 0, 0.1), {
      baseline,
      now: 100,
      dtMs: 33,
    });
    expect(result.ready).toBe(false);
    expect(result.reps).toBe(0);
  });
});

describe('JumpSquatTracker', () => {
  it('counts a squat followed by an airborne jump', () => {
    const tracker = new JumpSquatTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: mid, ms: 250 },
        { pose: deep, ms: 500 },
        { pose: jump, ms: 300 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(1);
    const events = findRepEvent(run.results);
    expect(events[0].score).toBeGreaterThanOrEqual(80);
    expect(run.lastResult.metrics.peakJump).toBeGreaterThan(0.02);
  });

  it('does not count a squat without a jump', () => {
    const tracker = new JumpSquatTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: deep, ms: 500 },
        { pose: standing, ms: 900 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'add-jump'))).toBe(true);
  });

  it('does not count a jump without squat depth', () => {
    const tracker = new JumpSquatTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: jump, ms: 500 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });
});
