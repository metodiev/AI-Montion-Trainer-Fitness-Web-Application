import { describe, expect, it } from 'vitest';
import { SideLungeTracker } from '@/exercises/tracking/sideLunge';
import { MountainClimbersTracker } from '@/exercises/tracking/mountainClimbers';
import { PlankShoulderTapTracker } from '@/exercises/tracking/shoulderTap';
import { plankFigure } from '@/core/skeleton';
import {
  baselineFrom,
  currentReps,
  drive,
  findRepEvent,
  frameOf,
  frontStanding,
  sideLungePose,
  sideStanding,
} from '../helpers/pose';

const frontBaseline = baselineFrom(frontStanding());
const sideBaseline = baselineFrom(sideStanding());
const standing = frontStanding();
const lowLunge = sideLungePose();

describe('SideLungeTracker', () => {
  it('counts a wide side lunge', () => {
    const tracker = new SideLungeTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: lowLunge, ms: 700 },
        { pose: standing, ms: 500 },
      ],
      { baseline: frontBaseline },
    );
    expect(currentReps(run.results)).toBe(1);
    const events = findRepEvent(run.results);
    expect(events[0].side).toBe('left');
    expect(events[0].score).toBeGreaterThanOrEqual(80);
  });

  it('does not count a wide stance without depth', () => {
    const tracker = new SideLungeTracker();
    const high = sideLungePose({ low: false });
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: high, ms: 700 },
        { pose: standing, ms: 500 },
      ],
      { baseline: frontBaseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });

  it('flags knee collapse', () => {
    const tracker = new SideLungeTracker();
    const bad = sideLungePose({ valgus: true });
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: bad, ms: 700 },
        { pose: standing, ms: 500 },
      ],
      { baseline: frontBaseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(90);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'knee-in'))).toBe(true);
  });

  it('stops tracking when the legs are not visible', () => {
    const tracker = new SideLungeTracker();
    const result = tracker.update(frameOf(lowLunge, 0, 0.1), {
      baseline: frontBaseline,
      now: 200,
      dtMs: 33,
    });
    expect(result.ready).toBe(false);
    expect(result.reps).toBe(0);
  });
});

describe('MountainClimbersTracker', () => {
  const plank = plankFigure();
  const driveLeft = plankFigure({ drive: 'left' });
  const driveRight = plankFigure({ drive: 'right' });

  it('counts alternating knee drives in a plank', () => {
    const tracker = new MountainClimbersTracker();
    const run = drive(
      tracker,
      [
        { pose: plank, ms: 300 },
        { pose: driveLeft, ms: 400 },
        { pose: plank, ms: 400 },
        { pose: driveRight, ms: 400 },
        { pose: plank, ms: 400 },
      ],
      { baseline: sideBaseline },
    );
    expect(currentReps(run.results)).toBe(2);
    const events = findRepEvent(run.results);
    expect(events.map((event) => event.side)).toEqual(['left', 'right']);
  });

  it('is not ready when standing', () => {
    const tracker = new MountainClimbersTracker();
    const run = drive(tracker, [{ pose: sideStanding(), ms: 600 }], { baseline: sideBaseline });
    expect(run.lastResult.ready).toBe(false);
    expect(run.lastResult.reps).toBe(0);
  });
});

describe('PlankShoulderTapTracker', () => {
  const plank = plankFigure();
  const tapLeft = plankFigure({ tap: 'left' });
  const tapRight = plankFigure({ tap: 'right' });

  it('counts shoulder taps and alternates sides', () => {
    const tracker = new PlankShoulderTapTracker();
    const run = drive(
      tracker,
      [
        { pose: plank, ms: 400 },
        { pose: tapLeft, ms: 450 },
        { pose: plank, ms: 450 },
        { pose: tapRight, ms: 450 },
        { pose: plank, ms: 450 },
      ],
      { baseline: sideBaseline },
    );
    expect(currentReps(run.results)).toBe(2);
    const events = findRepEvent(run.results);
    expect(events.map((event) => event.side)).toEqual(['left', 'right']);
  });

  it('does not count taps while standing', () => {
    const tracker = new PlankShoulderTapTracker();
    const run = drive(tracker, [{ pose: sideStanding(), ms: 700 }], { baseline: sideBaseline });
    expect(run.lastResult.ready).toBe(false);
    expect(run.lastResult.reps).toBe(0);
  });
});
