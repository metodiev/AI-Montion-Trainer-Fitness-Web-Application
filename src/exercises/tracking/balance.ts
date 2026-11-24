import { clamp, range } from '@/core/geometry';
import { hipMid, torsoLean } from '@/core/pose';
import { LM, type PoseFrame, type Side } from '@/core/types';
import type { ExerciseTracker, TrackerContext, TrackerResult } from '../types';
import { buildChip, bodyLost, cue, liveScore } from './core';
import { ankleLift, hasLandmarks, SQUAT_LANDMARKS } from './measure';

export class SingleLegBalanceTracker implements ExerciseTracker {
  private totalSeconds = 0;
  private sideSeconds: Record<Side, number> = { left: 0, right: 0 };
  private currentSide: Side | null = null;
  private hipHistory: { at: number; x: number }[] = [];

  reset(): void {
    this.totalSeconds = 0;
    this.sideSeconds = { left: 0, right: 0 };
    this.currentSide = null;
    this.hipHistory = [];
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, SQUAT_LANDMARKS, 0.35)) {
      return { ...bodyLost('Step back so I can see your feet.'), holdSeconds: this.totalSeconds };
    }

    const liftLeft = ankleLift(frame, 'left', context.baseline);
    const liftRight = ankleLift(frame, 'right', context.baseline);
    const leftUp = liftLeft > 0.02;
    const rightUp = liftRight > 0.02;
    const hip = hipMid(frame);
    this.hipHistory.push({ at: context.now, x: hip.x });
    while (this.hipHistory.length > 0 && this.hipHistory[0].at < context.now - 1000) {
      this.hipHistory.shift();
    }
    const sway = range(this.hipHistory.map((entry) => entry.x));
    const hipTilt = Math.abs(frame.points[LM.leftHip].y - frame.points[LM.rightHip].y);
    const lean = torsoLean(frame);
    const exactlyOne = leftUp !== rightUp;
    const supportDown =
      (leftUp && liftRight < 0.015) || (rightUp && liftLeft < 0.015);
    const valid = exactlyOne && supportDown && hipTilt < 0.08 && lean < 18 && sway < 0.12;
    const dt = clamp(context.dtMs, 0, 150) / 1000;

    if (valid) {
      this.totalSeconds += dt;
      const side: Side = leftUp ? 'left' : 'right';
      this.currentSide = side;
      this.sideSeconds[side] += dt;
    }

    const cues: TrackerResult['cues'] = [];
    if (!exactlyOne) {
      cues.push(
        leftUp && rightUp
          ? cue('one-foot', 'Keep one foot grounded.', 'warning')
          : cue('lift-one-foot', 'Lift one foot and find your balance.', 'info'),
      );
    }
    if (hipTilt > 0.06) {
      cues.push(cue('hips-level', 'Keep your hips level — don’t let one drop.', 'warning'));
    }
    if (lean > 16) {
      cues.push(cue('balance-tall', 'Stand tall and lengthen your spine.', 'warning'));
    }
    if (sway > 0.09) {
      cues.push(cue('steady-gaze', 'Fix your gaze on a point and steady your hips.', 'warning'));
    }
    if (valid && this.sideSeconds[this.currentSide ?? 'left'] >= 2) {
      cues.push(cue('balanced', 'Beautiful balance — stay calm and breathe.', 'success'));
    }

    const formScore = liveScore([
      Math.max(0, hipTilt - 0.03) * 500,
      Math.max(0, lean - 10) * 2,
      Math.max(0, sway - 0.04) * 400,
      exactlyOne ? 0 : 15,
    ]);

    return {
      ready: true,
      reps: 0,
      stateLabel: valid
        ? `Balancing · ${this.currentSide ?? 'single leg'}`
        : exactlyOne
          ? 'Find your balance'
          : 'Two feet down',
      formScore,
      progress: clamp(this.totalSeconds / 30, 0, 1),
      cues,
      holdSeconds: this.totalSeconds,
      side: valid ? this.currentSide : null,
      metrics: {
        liftLeft,
        liftRight,
        leftSeconds: this.sideSeconds.left,
        rightSeconds: this.sideSeconds.right,
        hipTilt,
        lean,
        sway,
        totalSeconds: this.totalSeconds,
      },
      chips: [
        { label: `Hold ${this.totalSeconds.toFixed(1)}s`, tone: valid ? 'good' : 'neutral' },
        buildChip('Hip level', clamp(100 - hipTilt * 700, 0, 100), 80, 55),
        buildChip('Steady', clamp(100 - sway * 500, 0, 100), 80, 55),
      ],
    };
  }
}
