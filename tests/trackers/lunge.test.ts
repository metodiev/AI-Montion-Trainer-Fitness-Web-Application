import { describe, expect, it } from 'vitest';
import { LungeTracker } from '@/exercises/tracking/lunge';
import {
  baselineFrom,
  clonePose,
  currentReps,
  drive,
  findRepEvent,
  lungePose,
  sideStanding,
} from '../helpers/pose';

const baseline = baselineFrom(sideStanding());
const standing = sideStanding();
const deep = lungePose({ frontFlex: 80, frontKnee: 92, backFlex: -12, backKnee: 35, lean: 8, stride: 0 });
const shallow = lungePose({ frontFlex: 40, frontKnee: 50, backFlex: -10, backKnee: 20, lean: 5, stride: 0 });

describe('LungeTracker', () => {
  it('counts one rep per lunge instead of one per leg', () => {
    const tracker = new LungeTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 350 },
        { pose: deep, ms: 800 },
        { pose: standing, ms: 600 },
        { pose: deep, ms: 800 },
        { pose: standing, ms: 600 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(2);
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(2);
    expect(events[0].side).toBe('left');
    expect(events[0].score).toBeGreaterThanOrEqual(80);
  });

  it('does not count shallow knee bends', () => {
    const tracker = new LungeTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: shallow, ms: 700 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });

  it('penalises a knee travelling far past the ankle', () => {
    const tracker = new LungeTracker();
    const bad = clonePose(deep);
    bad.joints.kneeL = [bad.joints.kneeL[0] + 0.14, bad.joints.kneeL[1]];
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: bad, ms: 800 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(90);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'knee-over-toe'))).toBe(
      true,
    );
  });

  it('penalises a collapsing torso', () => {
    const tracker = new LungeTracker();
    const collapsed = lungePose({
      frontFlex: 80,
      frontKnee: 92,
      backFlex: -12,
      backKnee: 35,
      lean: 45,
      stride: 0,
    });
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: collapsed, ms: 800 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(90);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'torso-lunge'))).toBe(
      true,
    );
  });

  it('needs both knees to return to standing before counting', () => {
    const tracker = new LungeTracker();
    const halfReturned = lungePose({
      frontFlex: 10,
      frontKnee: 5,
      backFlex: -12,
      backKnee: 70,
      lean: 8,
      stride: 0,
    });
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: deep, ms: 500 },
        { pose: halfReturned, ms: 700 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });
});
