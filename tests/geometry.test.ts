import { describe, expect, it } from 'vitest';
import {
  angleAt,
  angleFromVertical,
  clamp,
  distance,
  median,
  offsetFromLine,
  range,
} from '@/core/geometry';

const p = (x: number, y: number, z = 0) => ({ x, y, z });

describe('geometry', () => {
  it('computes a right angle', () => {
    expect(angleAt(p(0, 0), p(1, 1), p(2, 0))).toBeCloseTo(90, 5);
  });

  it('computes a straight line as 180 degrees', () => {
    expect(angleAt(p(0, 0), p(1, 0), p(2, 0))).toBeCloseTo(180, 5);
  });

  it('measures lean from vertical', () => {
    expect(angleFromVertical(p(0, 1))).toBeCloseTo(0, 5);
    expect(angleFromVertical(p(1, 0))).toBeCloseTo(90, 5);
    expect(angleFromVertical(p(-1, -1))).toBeCloseTo(45, 5);
  });

  it('handles degenerate angles without NaN', () => {
    expect(angleAt(p(0, 0), p(0, 0), p(0, 0))).toBe(0);
  });

  it('computes distance in 3D', () => {
    expect(distance(p(0, 0, 0), p(1, 2, 2))).toBeCloseTo(3, 6);
  });

  it('computes median for odd and even arrays', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('measures offsets from a line', () => {
    expect(offsetFromLine(p(0, 0), p(2, 0), p(1, 0.5))).toBeCloseTo(0.5, 6);
    expect(offsetFromLine(p(0, 0), p(2, 0), p(1, -0.25))).toBeCloseTo(-0.25, 6);
  });

  it('clamps and computes ranges', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(range([2, 9, 4])).toBe(7);
    expect(range([])).toBe(0);
  });
});
