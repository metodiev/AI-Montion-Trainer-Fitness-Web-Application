import { clamp, distance, range } from '@/core/geometry';
import { hipMid, shoulderMid } from '@/core/pose';
import { LM, type PoseFrame, type Side } from '@/core/types';
import type { ExerciseTracker, RepEvent, TrackerContext, TrackerResult } from '../types';
import {
  buildChip,
  bodyLost,
  cue,
  CycleCounter,
  liveScore,
  makeRepEvent,
  RepIssues,
} from './core';
import { hasLandmarks, shoulderTilt, SQUAT_LANDMARKS } from './measure';
import { horizontalPosture } from './pushupHelpers';

const REQUIRED = [
  ...SQUAT_LANDMARKS,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
] as const;

export class PlankShoulderTapTracker implements ExerciseTracker {
  private counters: Record<Side, CycleCounter> = {
    left: this.makeCounter(),
    right: this.makeCounter(),
  };
  private taps: Record<Side, number> = { left: 0, right: 0 };
  private reps = 0;
  private issues = new RepIssues();
  private hipHistory: { at: number; y: number }[] = [];
  private lastSide: Side | null = null;

  reset(): void {
    this.counters = { left: this.makeCounter(), right: this.makeCounter() };
    this.taps = { left: 0, right: 0 };
    this.reps = 0;
    this.issues = new RepIssues();
    this.hipHistory = [];
    this.lastSide = null;
  }

  private makeCounter(): CycleCounter {
    return new CycleCounter({
      mode: 'low',
      enter: 0.5,
      exit: 0.78,
      countOn: 'enter',
      minCycleMs: 300,
      cooldownMs: 150,
    });
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, REQUIRED, 0.35)) {
      return { ...bodyLost('Keep your body and hands in frame.'), reps: this.reps };
    }

    const posture = horizontalPosture(frame);
    if (!posture.horizontal || posture.bodyLine < 140) {
      return {
        ready: false,
        reps: this.reps,
        stateLabel: 'Find your plank',
        formScore: 0,
        progress: 0,
        cues: [cue('set-plank-taps', 'Start in a high plank with your hands under your shoulders.', 'info')],
        holdSeconds: 0,
        side: null,
        metrics: { bodyLine: posture.bodyLine },
        chips: [],
      };
    }

    const distances: Record<Side, number> = {
      left: distance(frame.points[LM.leftWrist], frame.points[LM.rightShoulder]),
      right: distance(frame.points[LM.rightWrist], frame.points[LM.leftShoulder]),
    };
    const hip = hipMid(frame);
    this.hipHistory.push({ at: context.now, y: hip.y });
    while (this.hipHistory.length > 0 && this.hipHistory[0].at < context.now - 1100) {
      this.hipHistory.shift();
    }
    const hipRange = range(this.hipHistory.map((entry) => entry.y));
    const tilt = shoulderTilt(frame);
    let repEvent: RepEvent | undefined;

    for (const side of ['left', 'right'] as const) {
      const otherSide = side === 'left' ? 'right' : 'left';
      const enabled = distances[otherSide] > 0.55;
      const step = this.counters[side].update(distances[side], context.now, enabled);
      if (step.justActivated) {
        this.issues.reset();
        this.scoreTap(posture.bodyLine, hipRange, tilt);
        this.taps[side] += 1;
        this.reps += 1;
        this.lastSide = side;
        repEvent = makeRepEvent(
          this.reps,
          this.issues.score,
          side,
          0,
          this.issues.messages,
          context.now,
        );
      }
    }

    const bodyLine = posture.bodyLine;
    const cues: TrackerResult['cues'] = [];
    if (hipRange > 0.1) {
      cues.push(cue('hips-rock', 'Keep your hips square — don’t rock.', 'warning'));
    }
    if (tilt > 0.18) {
      cues.push(cue('shoulders-level', 'Keep your shoulders level.', 'warning'));
    }
    if (posture.bodyLine < 160) {
      cues.push(cue('tap-line', 'Brace your core and keep one straight line.', 'warning'));
    }
    if (this.reps > 0) {
      cues.push(cue('tap-next', 'Tap the opposite shoulder with control.', 'info'));
    }
    if (this.reps >= 4 && hipRange < 0.1 && tilt < 0.18) {
      cues.push(cue('tap-strong', 'Strong, stable shoulder taps!', 'success'));
    }

    const formScore = liveScore([
      Math.max(0, 160 - bodyLine) * 1.2,
      Math.max(0, hipRange - 0.05) * 260,
      Math.max(0, tilt - 0.12) * 220,
    ]);
    const shoulder = shoulderMid(frame);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: this.reps > 0 ? 'Shoulder taps' : 'Holding plank',
      formScore,
      progress: clamp(this.reps / 10, 0, 1),
      cues,
      holdSeconds: 0,
      side: this.lastSide,
      metrics: {
        ...distances,
        bodyLine,
        hipOffset: posture.hipOffset,
        hipRange,
        tilt,
        shoulderY: shoulder.y,
        leftTaps: this.taps.left,
        rightTaps: this.taps.right,
        reps: this.reps,
      },
      chips: [
        { label: `${this.reps} taps`, tone: this.reps > 0 ? 'good' : 'neutral' },
        buildChip('Hips square', clamp(100 - hipRange * 400, 0, 100), 80, 55),
        buildChip('Plank line', clamp(((bodyLine - 130) / 50) * 100, 0, 100), 80, 55),
      ],
    };
  }

  private scoreTap(bodyLine: number, hipRange: number, tilt: number): void {
    if (bodyLine < 155) {
      this.issues.flag('sagging', 'Keep your body straight', 16);
    }
    if (hipRange > 0.1) {
      this.issues.flag('hip-rock', 'Keep your hips square', 12);
    }
    if (tilt > 0.2) {
      this.issues.flag('tilt', 'Level your shoulders', 10);
    }
  }
}

