import type { Vec3 } from './types';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const distance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const distance2D = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
});

/** Angle at `b` formed by the points a-b-c, in degrees (0..180). */
export function angleAt(a: Vec3, b: Vec3, c: Vec3): number {
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAb = Math.hypot(ab.x, ab.y, ab.z);
  const magCb = Math.hypot(cb.x, cb.y, cb.z);
  if (magAb < 1e-6 || magCb < 1e-6) return 0;
  const cosine = clamp(dot / (magAb * magCb), -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** Angle between a vector and straight up (positive y is down), in degrees. */
export function angleFromVertical(vector: Vec3): number {
  const horizontal = Math.hypot(vector.x, vector.z);
  const vertical = Math.abs(vector.y);
  if (horizontal < 1e-6 && vertical < 1e-6) return 0;
  return (Math.atan2(horizontal, vertical) * 180) / Math.PI;
}

/** Angle of a 2D vector from vertical, preserving sign (degrees). */
export function signedAngleFromVertical(x: number, y: number): number {
  return (Math.atan2(x, Math.abs(y)) * 180) / Math.PI;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

export function range(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/** Linear interpolation of a point along a line. */
export function pointOnLine(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

/** Hook for symmetric measurements that do not need the shoulder midpoint. */
export function hipAnkleHeight(hips: [Vec3, Vec3], ankles: [Vec3, Vec3]): number {
  const hip = midpoint(hips[0], hips[1]);
  const ankle = midpoint(ankles[0], ankles[1]);
  return ankle.y - hip.y;
}

/** Signed offset of `point` from the line a-b at the point's projection. */
export function offsetFromLine(a: Vec3, b: Vec3, point: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-9) return point.y - a.y;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  const projected = { x: a.x + dx * t, y: a.y + dy * t };
  return point.y - projected.y;
}

export function averagePoints(points: Vec3[]): Vec3 {
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: mean(points.map((p) => p.x)),
    y: mean(points.map((p) => p.y)),
    z: mean(points.map((p) => p.z)),
  };
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return clamp((value / total) * 100, 0, 100);
}
