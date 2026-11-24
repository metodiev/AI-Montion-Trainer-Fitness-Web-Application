import { describe, expect, it } from 'vitest';
import { KneeRaiseTracker } from '@/exercises/tracking/kneeRaise';
import { frontFigure } from '@/core/skeleton';
import {
  baselineFrom,
  clonePose,
  currentReps,
  drive,
  findRepEvent,
  frameOf,
  frontStanding,
  withRaisedKnee,
} from '../helpers/pose';

const baseline = baselineFrom(frontStanding());
const standing = frontStanding();
const leftUp = withRaisedKnee(standing, 'left');
const rightUp = withRaisedKnee(standing, 'right');

describe('KneeRaiseTracker', () => {
  it('counts left and right knee raises separately', () => {
    const tracker = new KneeRaiseTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: leftUp, ms: 500 },
        { pose: standing, ms: 500 },
        { pose: rightUp, ms: 500 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(2);
    const events = findRepEvent(run.results);
    expect(events.map((event) => event.side)).toEqual(['left', 'right']);
    expect(events[0].score).toBeGreaterThan(70);
  });

  it('does not count a small knee bend that is not lifted', () => {
    const tracker = new KneeRaiseTracker();
    const small = clonePose(standing);
    const hip = small.joints.hipL;
    small.joints.kneeL = [hip[0] - 0.06, hip[1] + 0.15];
    small.joints.ankleL = [hip[0] - 0.08, hip[1] + 0.32];
    small.joints.footL = [hip[0] - 0.12, hip[1] + 0.33];
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 300 },
        { pose: small, ms: 600 },
        { pose: standing, ms: 500 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });

  it('warns about leaning back', () => {
    const tracker = new KneeRaiseTracker();
    const leaningStanding = frontFigure({ rootY: 0.56, lean: 28 });
    const leaningUp = withRaisedKnee(leaningStanding, 'left');
    const run = drive(
      tracker,
      [
        { pose: leaningStanding, ms: 300 },
        { pose: leaningUp, ms: 500 },
        { pose: leaningStanding, ms: 500 },
      ],
      { baseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(90);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'stand-tall'))).toBe(true);
  });

  it('hints when the same leg is used repeatedly', () => {
    const tracker = new KneeRaiseTracker();
    const run = drive(
      tracker,
      [
        { pose: standing, ms: 250 },
        { pose: leftUp, ms: 520 },
        { pose: standing, ms: 450 },
        { pose: leftUp, ms: 520 },
        { pose: standing, ms: 450 },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(2);
    expect(
      run.results.some((result) => result.cues.some((cue) => cue.code === 'alternate')),
    ).toBe(true);
  });

  it('does not count when the body is not visible', () => {
    const tracker = new KneeRaiseTracker();
    const result = tracker.update(frameOf(leftUp, 0, 0.2), { baseline, now: 100, dtMs: 33 });
    expect(result.ready).toBe(false);
    expect(result.reps).toBe(0);
  });
});
