import { describe, expect, it } from 'vitest';
import { PoseCalibration } from '@/core/calibration';
import type { PoseFrame } from '@/core/types';
import { frontFigure } from '@/core/skeleton';
import { baselineFrom, frameOf, frontStanding } from './helpers/pose';

function feed(
  calibration: PoseCalibration,
  frames: { frame: PoseFrame | null; now: number }[],
) {
  let last = calibration.update(null, 0);
  for (const entry of frames) {
    last = calibration.update(entry.frame, entry.now);
  }
  return last;
}

describe('PoseCalibration', () => {
  it('stays idle until started', () => {
    const calibration = new PoseCalibration({ holdMs: 500 });
    const state = calibration.update(frameOf(frontStanding()), 16);
    expect(state.phase).toBe('idle');
    expect(state.baseline).toBeNull();
  });

  it('completes after a stable neutral hold and captures a baseline', () => {
    const calibration = new PoseCalibration({ holdMs: 800 });
    calibration.start(0);
    const frame = frameOf(frontStanding(), 0);
    const frames = Array.from({ length: 80 }, (_, index) => ({
      frame,
      now: index * 33,
    }));
    const state = feed(calibration, frames);
    expect(state.phase).toBe('complete');
    expect(state.baseline).not.toBeNull();
    expect(state.baseline!.hipAnkle).toBeGreaterThan(1.4);
    expect(state.baseline!.shoulderWidth).toBeGreaterThan(0.7);
    expect(state.baseline!.shoulderWidth).toBeLessThan(1.1);
    expect(state.baseline!.groundY).toBeCloseTo(baselineFrom(frontStanding()).groundY, 3);
    expect(state.progress).toBe(1);
  });

  it('does not complete when the body is not fully visible', () => {
    const calibration = new PoseCalibration({ holdMs: 300 });
    calibration.start(0);
    const frame = frameOf(frontStanding(), 0, 0.2);
    const state = feed(
      calibration,
      Array.from({ length: 40 }, (_, index) => ({ frame, now: index * 33 })),
    );
    expect(state.phase).not.toBe('complete');
    expect(state.baseline).toBeNull();
    expect(state.checks.bodyVisible).toBe(false);
  });

  it('does not complete while the user is moving', () => {
    const calibration = new PoseCalibration({ holdMs: 400 });
    calibration.start(0);
    const frames = Array.from({ length: 60 }, (_, index) => ({
      frame: frameOf(frontFigure({ rootY: 0.56 + (index % 2 === 0 ? 0.03 : -0.03) }), index * 33),
      now: index * 33,
    }));
    const state = feed(calibration, frames);
    expect(state.phase).not.toBe('complete');
    expect(state.checks.stable).toBe(false);
  });

  it('handles missing frames without throwing', () => {
    const calibration = new PoseCalibration({ holdMs: 300 });
    calibration.start(0);
    const state = feed(
      calibration,
      Array.from({ length: 20 }, (_, index) => ({ frame: null, now: index * 33 })),
    );
    expect(state.phase).toBe('searching');
    expect(state.checks.bodyVisible).toBe(false);
  });

  it('resets captured state', () => {
    const calibration = new PoseCalibration({ holdMs: 300 });
    calibration.start(0);
    const frame = frameOf(frontStanding(), 0);
    feed(
      calibration,
      Array.from({ length: 60 }, (_, index) => ({ frame, now: index * 33 })),
    );
    expect(calibration.result).not.toBeNull();
    calibration.reset();
    expect(calibration.result).toBeNull();
    expect(calibration.update(frame, 3000).phase).toBe('idle');
  });
});
