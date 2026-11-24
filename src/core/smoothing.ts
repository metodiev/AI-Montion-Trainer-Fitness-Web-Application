import { clamp, distance } from './geometry';
import type { Landmark } from './types';

/**
 * Lightweight exponential smoother for MediaPipe landmarks.
 * Uses a velocity-aware alpha: fast movements are passed through almost
 * untouched, slow jitter is heavily filtered. Pose inference is expensive, so
 * filtering here also keeps the skeleton overlay visually calm.
 */
export class PoseSmoother {
  private previous: Landmark[] | null = null;
  private lastTimestamp = 0;
  private readonly tauMs: number;

  constructor(tauMs = 70) {
    this.tauMs = tauMs;
  }

  reset(): void {
    this.previous = null;
    this.lastTimestamp = 0;
  }

  smooth(landmarks: Landmark[], timestampMs: number): Landmark[] {
    if (!this.previous || this.previous.length !== landmarks.length) {
      this.previous = landmarks.map((landmark) => ({ ...landmark }));
      this.lastTimestamp = timestampMs;
      return this.previous.map((landmark) => ({ ...landmark }));
    }

    const dt = Math.max(1, timestampMs - this.lastTimestamp);
    const baseAlpha = clamp(1 - Math.exp(-dt / this.tauMs), 0.18, 0.95);

    const smoothed = landmarks.map((landmark, index) => {
      const prev = this.previous![index];
      const movement = distance(
        { x: landmark.x, y: landmark.y, z: landmark.z },
        { x: prev.x, y: prev.y, z: prev.z },
      );
      const alpha = movement > 0.06 ? 1 : baseAlpha;
      return {
        x: prev.x + (landmark.x - prev.x) * alpha,
        y: prev.y + (landmark.y - prev.y) * alpha,
        z: prev.z + (landmark.z - prev.z) * alpha,
        visibility:
          (prev.visibility ?? 1) + ((landmark.visibility ?? 1) - (prev.visibility ?? 1)) * Math.min(1, alpha * 1.2),
        presence: landmark.presence,
      };
    });

    this.previous = smoothed.map((landmark) => ({ ...landmark }));
    this.lastTimestamp = timestampMs;
    return smoothed;
  }
}
