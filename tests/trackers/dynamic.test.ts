import { describe, expect, it } from 'vitest';
import { ArmRaiseTracker } from '@/exercises/tracking/armRaise';
import { TorsoTwistTracker } from '@/exercises/tracking/torsoTwist';
import { HighKneesTracker } from '@/exercises/tracking/highKnees';
import { frontFigure } from '@/core/skeleton';
import { LM } from '@/core/types';
import {
  baselineFrom,
  currentReps,
  drive,
  findRepEvent,
  frameOf,
  frontStanding,
  sideStanding,
  twistedPose,
  withRaisedKnee,
} from '../helpers/pose';

const frontBaseline = baselineFrom(frontStanding());
const standing = frontStanding();
const armsUp = frontFigure({ rootY: 0.56, armAbductL: 168, armAbductR: 168 });

describe('ArmRaiseTracker', () => {
  it('counts complete arm raise cycles', () => {
    const tracker = new ArmRaiseTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 350 },
        { pose: armsUp, ms: 600 },
        { pose: standing, ms: 550 },
        { pose: armsUp, ms: 600 },
        { pose: standing, ms: 550 },
      ],
      { baseline: frontBaseline },
    );
    expect(currentReps(run.results)).toBe(2);
    const events = findRepEvent(run.results);
    expect(events[0].score).toBeGreaterThanOrEqual(85);
  });

  it('does not count a partial raise to shoulder height', () => {
    const tracker = new ArmRaiseTracker();
    const partial = frontFigure({ rootY: 0.56, armAbductL: 96, armAbductR: 96 });
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: partial, ms: 700 },
        { pose: standing, ms: 500 },
      ],
      { baseline: frontBaseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });

  it('penalises bent elbows', () => {
    const tracker = new ArmRaiseTracker();
    const bent = frontFigure({
      rootY: 0.56,
      armAbductL: 168,
      armAbductR: 168,
      elbowL: 70,
      elbowR: 70,
    });
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: bent, ms: 600 },
        { pose: standing, ms: 500 },
      ],
      { baseline: frontBaseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(90);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'straighten-arms'))).toBe(true);
  });

  it('is not ready when the wrists disappear', () => {
    const tracker = new ArmRaiseTracker();
    const result = tracker.update(frameOf(armsUp, 0, 0.2), {
      baseline: frontBaseline,
      now: 100,
      dtMs: 33,
    });
    expect(result.ready).toBe(false);
    expect(result.reps).toBe(0);
  });
});

describe('TorsoTwistTracker', () => {
  it('counts a full twist and return with a direction', () => {
    const tracker = new TorsoTwistTracker();
    const twist = twistedPose(0.4);
    const z = { [LM.leftShoulder]: -0.1, [LM.rightShoulder]: 0.1 };
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: twist, ms: 800, zOverrides: z },
        { pose: standing, ms: 500 },
      ],
      { baseline: frontBaseline },
    );
    expect(currentReps(run.results)).toBe(1);
    const events = findRepEvent(run.results);
    expect(events[0].side).toBe('right');
    expect(events[0].score).toBeGreaterThanOrEqual(85);
  });

  it('warns when the hips rotate with the torso', () => {
    const tracker = new TorsoTwistTracker();
    const twist = twistedPose(0.35);
    twist.joints.hipL = [0.48, twist.joints.hipL[1]];
    twist.joints.hipR = [0.52, twist.joints.hipR[1]];
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: twist, ms: 800 },
        { pose: standing, ms: 500 },
      ],
      { baseline: frontBaseline },
    );
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'hips-square'))).toBe(true);
    const events = findRepEvent(run.results);
    expect(events[0].score).toBeLessThan(95);
  });

  it('asks the user to face the camera when calibrated sideways', () => {
    const tracker = new TorsoTwistTracker();
    const sideBaseline = baselineFrom(sideStanding());
    const result = tracker.update(frameOf(standing), {
      baseline: sideBaseline,
      now: 100,
      dtMs: 33,
    });
    expect(result.ready).toBe(false);
    expect(result.cues[0].code).toBe('face-camera');
  });
});

describe('HighKneesTracker', () => {
  it('counts alternating high knees at pace', () => {
    const tracker = new HighKneesTracker();
    const left = withRaisedKnee(standing, 'left');
    const right = withRaisedKnee(standing, 'right');
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 250 },
        { pose: left, ms: 400 },
        { pose: standing, ms: 300 },
        { pose: right, ms: 400 },
        { pose: standing, ms: 300 },
      ],
      { baseline: frontBaseline },
    );
    expect(currentReps(run.results)).toBe(2);
    const events = findRepEvent(run.results);
    expect(events.map((event) => event.side)).toEqual(['left', 'right']);
    expect(run.lastResult.metrics.cadence).toBeGreaterThan(0);
  });

  it('warns when the knees stay low', () => {
    const tracker = new HighKneesTracker();
    const low = frontStanding();
    low.joints.kneeL = [low.joints.hipL[0] + 0.12, low.joints.hipL[1] + 0.12];
    low.joints.ankleL = [low.joints.hipL[0] + 0.14, low.joints.hipL[1] + 0.28];
    low.joints.footL = [low.joints.hipL[0] + 0.19, low.joints.hipL[1] + 0.29];
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 200 },
        { pose: low, ms: 500 },
        { pose: standing, ms: 400 },
      ],
      { baseline: frontBaseline },
    );
    expect(currentReps(run.results)).toBe(0);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'knees-higher'))).toBe(true);
  });
});
