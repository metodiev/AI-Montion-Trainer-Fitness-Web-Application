import { describe, expect, it } from 'vitest';
import { PushUpTracker } from '@/exercises/tracking/pushUp';
import { LM } from '@/core/types';
import {
  baselineFrom,
  currentReps,
  drive,
  findRepEvent,
  frameOf,
  frontStanding,
  pushUpPose,
} from '../helpers/pose';

const baseline = baselineFrom(frontStanding());
const top = pushUpPose({ elbow: 'top' });
const bottom = pushUpPose({ elbow: 'bottom' });
const standardWidth = { [LM.leftWrist]: -0.12, [LM.rightWrist]: 0.12 };

describe('PushUpTracker', () => {
  it('counts a full push-up rep', () => {
    const tracker = new PushUpTracker('standard');
    const run = drive(
      tracker,
      [
        { pose: top, ms: 400, zOverrides: standardWidth },
        { pose: bottom, ms: 550, zOverrides: standardWidth },
        { pose: top, ms: 500, zOverrides: standardWidth },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(1);
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeGreaterThanOrEqual(80);
  });

  it('never counts from standing', () => {
    const tracker = new PushUpTracker('standard');
    const run = drive(tracker, [{ pose: frontStanding(), ms: 800 }], { baseline });
    expect(currentReps(run.results)).toBe(0);
    expect(run.lastResult.ready).toBe(false);
    expect(run.lastResult.cues[0].code).toBe('get-into-plank');
  });

  it('penalises sagging hips and calls out the body line', () => {
    const tracker = new PushUpTracker('standard');
    const saggingBottom = pushUpPose({ elbow: 'bottom', hipSag: 0.13 });
    const run = drive(
      tracker,
      [
        { pose: top, ms: 400, zOverrides: standardWidth },
        { pose: saggingBottom, ms: 550, zOverrides: standardWidth },
        { pose: top, ms: 500, zOverrides: standardWidth },
      ],
      { baseline },
    );
    const events = findRepEvent(run.results);
    expect(events).toHaveLength(1);
    expect(events[0].score).toBeLessThan(90);
    expect(run.results.some((result) => result.cues.some((cue) => cue.code === 'body-line'))).toBe(true);
  });

  it('tracks wide and diamond hand variants cleanly', () => {
    for (const [variant, z] of [
      ['wide', 0.18],
      ['diamond', 0.035],
    ] as const) {
      const tracker = new PushUpTracker(variant);
      const width = { [LM.leftWrist]: -z, [LM.rightWrist]: z };
      const run = drive(
        tracker,
        [
          { pose: top, ms: 300, zOverrides: width },
          { pose: bottom, ms: 550, zOverrides: width },
          { pose: top, ms: 500, zOverrides: width },
        ],
        { baseline },
      );
      expect(currentReps(run.results), variant).toBe(1);
      const handsChip = run.lastResult.chips.find((chip) => chip.label.startsWith('Hands'));
      expect(handsChip?.tone, variant).toBe('good');
    }
  });

  it('does not count a half push-up', () => {
    const tracker = new PushUpTracker('standard');
    const shallow = pushUpPose({ elbow: 'mid' });
    const run = drive(
      tracker,
      [
        { pose: top, ms: 300, zOverrides: standardWidth },
        { pose: shallow, ms: 700, zOverrides: standardWidth },
        { pose: top, ms: 500, zOverrides: standardWidth },
      ],
      { baseline },
    );
    expect(currentReps(run.results)).toBe(0);
  });

  it('is not ready without wrist visibility', () => {
    const tracker = new PushUpTracker('standard');
    const hidden = frameOf(bottom, 0, 0.2);
    const result = tracker.update(hidden, { baseline, now: 100, dtMs: 33 });
    expect(result.ready).toBe(false);
    expect(result.reps).toBe(0);
  });
});
