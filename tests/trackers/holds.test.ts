import { describe, expect, it } from 'vitest';
import { PlankTracker } from '@/exercises/tracking/plank';
import { WallSitTracker } from '@/exercises/tracking/wallSit';
import { SingleLegBalanceTracker } from '@/exercises/tracking/balance';
import {
  baselineFrom,
  drive,
  frontStanding,
  pushUpPose,
  sideStanding,
  squatPose,
  wallSitPose,
  withRaisedKnee,
} from '../helpers/pose';

const sideBaseline = baselineFrom(sideStanding());
const frontBaseline = baselineFrom(frontStanding());

describe('WallSitTracker', () => {
  it('accumulates hold time only in a valid wall sit', () => {
    const tracker = new WallSitTracker();
    const run = drive(
      tracker,
      [
        { pose: sideStanding(), ms: 500 },
        { pose: wallSitPose(), ms: 2200 },
        { pose: sideStanding(), ms: 400 },
      ],
      { baseline: sideBaseline },
    );
    expect(run.lastResult.holdSeconds).toBeGreaterThan(1.7);
    expect(run.lastResult.holdSeconds).toBeLessThan(2.6);
    expect(run.results.some((result) => result.formScore > 60)).toBe(true);
  });

  it('pauses the hold when posture breaks', () => {
    const tracker = new WallSitTracker();
    const run = drive(
      tracker,
      [
        { pose: wallSitPose(), ms: 1000 },
        { pose: sideStanding(), ms: 1000 },
      ],
      { baseline: sideBaseline },
    );
    const paused = run.lastResult.holdSeconds;
    expect(paused).toBeGreaterThan(0.6);
    expect(paused).toBeLessThan(1.2);
    expect(run.lastResult.ready).toBe(true);
    expect(run.lastResult.cues.some((cue) => cue.code === 'slide-down')).toBe(true);
  });

  it('asks for a deeper hold when the hips stay high', () => {
    const tracker = new WallSitTracker();
    const high = squatPose({ hipFlex: 55, kneeBend: 60 });
    const run = drive(tracker, [{ pose: high, ms: 900 }], { baseline: sideBaseline });
    expect(run.lastResult.holdSeconds).toBeLessThan(0.2);
    expect(run.lastResult.cues.some((cue) => cue.code === 'lower-hips')).toBe(true);
  });
});

describe('PlankTracker', () => {
  const goodPlank = pushUpPose({ elbow: 'top' });

  it('accumulates aligned plank time', () => {
    const tracker = new PlankTracker();
    const run = drive(
      tracker,
      [
        { pose: sideStanding(), ms: 400 },
        { pose: goodPlank, ms: 2400 },
      ],
      { baseline: sideBaseline },
    );
    expect(run.lastResult.holdSeconds).toBeGreaterThan(1.9);
    expect(run.lastResult.formScore).toBeGreaterThan(60);
    expect(run.lastResult.ready).toBe(true);
  });

  it('does not accumulate time while the hips sag', () => {
    const tracker = new PlankTracker();
    const sagging = pushUpPose({ elbow: 'top', hipSag: 0.14 });
    const run = drive(tracker, [{ pose: sagging, ms: 1600 }], { baseline: sideBaseline });
    expect(run.lastResult.holdSeconds).toBe(0);
    expect(run.lastResult.cues.some((cue) => cue.code === 'hips-down')).toBe(true);
  });

  it('is not ready when standing', () => {
    const tracker = new PlankTracker();
    const run = drive(tracker, [{ pose: sideStanding(), ms: 600 }], { baseline: sideBaseline });
    expect(run.lastResult.ready).toBe(false);
    expect(run.lastResult.holdSeconds).toBe(0);
    expect(run.lastResult.cues[0].code).toBe('get-into-plank');
  });
});

describe('SingleLegBalanceTracker', () => {
  it('accumulates balance time per side', () => {
    const tracker = new SingleLegBalanceTracker();
    const leftUp = withRaisedKnee(frontStanding(), 'left');
    const run = drive(
      tracker,
      [
        { pose: frontStanding(), ms: 300 },
        { pose: leftUp, ms: 2500 },
        { pose: frontStanding(), ms: 300 },
      ],
      { baseline: frontBaseline },
    );
    expect(run.lastResult.holdSeconds).toBeGreaterThan(2);
    expect(run.lastResult.metrics.leftSeconds).toBeGreaterThan(2);
    expect(run.lastResult.metrics.rightSeconds).toBe(0);
    expect(run.lastResult.side).toBeNull();
  });

  it('does not accumulate when both feet are down', () => {
    const tracker = new SingleLegBalanceTracker();
    const run = drive(tracker, [{ pose: frontStanding(), ms: 1500 }], { baseline: frontBaseline });
    expect(run.lastResult.holdSeconds).toBe(0);
    expect(run.lastResult.cues.some((cue) => cue.code === 'lift-one-foot')).toBe(true);
  });

  it('does not accumulate when both feet are off the floor', () => {
    const tracker = new SingleLegBalanceTracker();
    const jumping = sideStanding();
    const lifted = {
      joints: {
        ...jumping.joints,
        ankleL: [jumping.joints.ankleL[0], jumping.joints.ankleL[1] - 0.1] as [number, number],
        ankleR: [jumping.joints.ankleR[0], jumping.joints.ankleR[1] - 0.1] as [number, number],
        footL: [jumping.joints.footL[0], jumping.joints.footL[1] - 0.1] as [number, number],
        footR: [jumping.joints.footR[0], jumping.joints.footR[1] - 0.1] as [number, number],
      },
    };
    const run = drive(tracker, [{ pose: lifted, ms: 1200 }], { baseline: frontBaseline });
    expect(run.lastResult.holdSeconds).toBe(0);
    expect(run.lastResult.cues.some((cue) => cue.code === 'one-foot')).toBe(true);
  });
});
