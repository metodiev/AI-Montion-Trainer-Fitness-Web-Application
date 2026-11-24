import { describe, expect, it } from 'vitest';
import { createPoseFrame } from '@/core/pose';
import { PoseSmoother } from '@/core/smoothing';
import { demoPoseToLandmarks, frontFigure } from '@/core/skeleton';
import { LM } from '@/core/types';
import { frameOf } from './helpers/pose';

describe('pose frame normalisation', () => {
  it('returns null for an invalid landmark array', () => {
    expect(createPoseFrame(null, 1, 0)).toBeNull();
    expect(createPoseFrame([], 1, 0)).toBeNull();
  });

  it('normalises the torso length to one body unit', () => {
    const frame = frameOf(frontFigure());
    const shoulder = {
      x: (frame.points[LM.leftShoulder].x + frame.points[LM.rightShoulder].x) / 2,
      y: (frame.points[LM.leftShoulder].y + frame.points[LM.rightShoulder].y) / 2,
      z: 0,
    };
    const hip = {
      x: (frame.points[LM.leftHip].x + frame.points[LM.rightHip].x) / 2,
      y: (frame.points[LM.leftHip].y + frame.points[LM.rightHip].y) / 2,
      z: 0,
    };
    expect(Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)).toBeCloseTo(1, 5);
  });

  it('aspect-corrects horizontal measurements', () => {
    const landmarks = demoPoseToLandmarks(frontFigure());
    const square = createPoseFrame(landmarks, 1, 0)!;
    const wide = createPoseFrame(landmarks, 2, 0)!;
    const widthOf = (frame: typeof square) =>
      Math.abs(frame.points[LM.leftShoulder].x - frame.points[LM.rightShoulder].x);
    expect(widthOf(wide)).toBeCloseTo(widthOf(square) * 2, 4);
  });

  it('marks low-visibility poses as unreliable', () => {
    const frame = frameOf(frontFigure(), 0, 0.1);
    expect(frame.reliable).toBe(false);
    expect(frame.quality).toBeLessThan(0.35);
  });

  it('keeps reliable high-confidence poses armed', () => {
    const frame = frameOf(frontFigure(), 0, 0.99);
    expect(frame.reliable).toBe(true);
    expect(frame.quality).toBeGreaterThan(0.9);
  });
});

describe('pose smoothing', () => {
  it('reduces small jitter', () => {
    const smoother = new PoseSmoother(70);
    const base = demoPoseToLandmarks(frontFigure());
    const first = smoother.smooth(base, 0);
    const noisy = base.map((landmark) => ({
      ...landmark,
      x: landmark.x + (Math.random() - 0.5) * 0.004,
    }));
    const second = smoother.smooth(noisy, 33);
    const originalX = base[LM.leftWrist].x;
    const noisyX = noisy[LM.leftWrist].x;
    const smoothedX = second[LM.leftWrist].x;
    expect(Math.abs(smoothedX - noisyX)).toBeLessThan(Math.abs(noisyX - originalX) + 1e-9);
    expect(first[LM.leftWrist].visibility).toBeGreaterThan(0.9);
  });

  it('passes through large fast movements and resets cleanly', () => {
    const smoother = new PoseSmoother(70);
    const base = demoPoseToLandmarks(frontFigure());
    smoother.smooth(base, 0);
    const moved = demoPoseToLandmarks(frontFigure({ x: 0.58 }));
    const next = smoother.smooth(moved, 33);
    expect(next[LM.leftHip].x).toBeCloseTo(moved[LM.leftHip].x, 5);
    smoother.reset();
    const afterReset = smoother.smooth(moved, 66);
    expect(afterReset[LM.leftHip].x).toBeCloseTo(moved[LM.leftHip].x, 5);
  });
});
