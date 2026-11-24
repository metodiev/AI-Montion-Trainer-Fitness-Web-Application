import { clamp, distance } from '@/core/geometry';
import { ankleMid, shoulderMid, wristMid } from '@/core/pose';
import { bodyLineAngleSafe, elbowAngles, horizontalPosture } from './pushupHelpers';
import { LM, type PoseFrame } from '@/core/types';
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
import { hasLandmarks, SQUAT_LANDMARKS } from './measure';

export type PushUpVariant = 'standard' | 'wide' | 'diamond';

const REQUIRED = [
  ...SQUAT_LANDMARKS,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
  LM.nose,
] as const;

const VARIANT_TITLES: Record<PushUpVariant, string> = {
  standard: 'Push-up',
  wide: 'Wide push-up',
  diamond: 'Diamond push-up',
};

export class PushUpTracker implements ExerciseTracker {
  private cycle = new CycleCounter({
    mode: 'low',
    enter: 105,
    exit: 150,
    countOn: 'exit',
    minActiveMs: 250,
    minCycleMs: 500,
    cooldownMs: 300,
  });
  private reps = 0;
  private issues = new RepIssues();
  private startedAt = 0;
  private peakFlexion = 0;
  private worstBodyLine = 180;
  private worstHipOffset = 0;
  private worstHandOffset = 0;
  private worstHandRatioDeviation = 0;

  constructor(private readonly variant: PushUpVariant = 'standard') {}

  reset(): void {
    this.cycle.reset();
    this.reps = 0;
    this.issues = new RepIssues();
    this.startedAt = 0;
    this.peakFlexion = 0;
    this.worstBodyLine = 180;
    this.worstHipOffset = 0;
    this.worstHandOffset = 0;
    this.worstHandRatioDeviation = 0;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, REQUIRED, 0.35)) {
      return { ...bodyLost('Keep your body and hands in frame.'), reps: this.reps };
    }

    const posture = horizontalPosture(frame);
    if (!posture.horizontal) {
      return {
        ready: false,
        reps: this.reps,
        stateLabel: 'Find your plank',
        formScore: 0,
        progress: 0,
        cues: [cue('get-into-plank', 'Get into a push-up plank with your hands under your shoulders.', 'info')],
        holdSeconds: 0,
        side: null,
        metrics: { bodyLine: posture.bodyLine },
        chips: [],
      };
    }

    const elbows = elbowAngles(frame);
    const bodyLine = bodyLineAngleSafe(frame);
    const shoulder = shoulderMid(frame);
    const wrist = wristMid(frame);
    const bodyAxis = {
      x: ankleMid(frame).x - shoulder.x,
      y: ankleMid(frame).y - shoulder.y,
      z: ankleMid(frame).z - shoulder.z,
    };
    const axisLength = Math.hypot(bodyAxis.x, bodyAxis.y, bodyAxis.z) || 1;
    const handOffset = Math.abs(
      ((wrist.x - shoulder.x) * bodyAxis.x +
        (wrist.y - shoulder.y) * bodyAxis.y +
        (wrist.z - shoulder.z) * bodyAxis.z) /
        axisLength,
    );
    const handWidth = distance(frame.points[LM.leftWrist], frame.points[LM.rightWrist]);
    const handWidthRatio = handWidth;
    const targetDeviation = this.handWidthDeviation(handWidthRatio);
    const hipOffset = posture.hipOffset;

    const step = this.cycle.update(elbows.min, context.now, true);
    let repEvent: RepEvent | undefined;

    if (step.justActivated) {
      this.issues.reset();
      this.startedAt = context.now;
      this.peakFlexion = 180 - elbows.min;
      this.worstBodyLine = bodyLine;
      this.worstHipOffset = hipOffset;
      this.worstHandOffset = Math.abs(handOffset);
      this.worstHandRatioDeviation = targetDeviation;
    }
    if (step.active) {
      this.peakFlexion = Math.max(this.peakFlexion, 180 - elbows.min);
      this.worstBodyLine = Math.min(this.worstBodyLine, bodyLine);
      this.worstHipOffset = Math.max(Math.abs(hipOffset), Math.abs(this.worstHipOffset));
      this.worstHandOffset = Math.max(this.worstHandOffset, Math.abs(handOffset));
      this.worstHandRatioDeviation = Math.max(this.worstHandRatioDeviation, targetDeviation);
    }
    if (step.justCompleted) {
      this.scoreRep();
      this.reps += 1;
      repEvent = makeRepEvent(
        this.reps,
        this.issues.score,
        null,
        context.now - this.startedAt,
        this.issues.messages,
        context.now,
      );
    }

    const cues: TrackerResult['cues'] = [];
    if (step.active) {
      if (elbows.min > 125) {
        cues.push(cue('lower-chest', 'Lower your chest toward the floor.', 'warning'));
      }
      if (this.worstBodyLine < 155) {
        cues.push(cue('body-line', 'Keep your body in one straight line.', 'error'));
      }
      if (hipOffset > 0.08) {
        cues.push(cue('hips-sag', 'Lift your hips — brace your core.', 'warning'));
      } else if (hipOffset < -0.1) {
        cues.push(cue('hips-pike', 'Lower your hips — don’t pike up.', 'warning'));
      }
      if (this.worstHandOffset > 0.4) {
        cues.push(cue('hands-under', 'Stack your hands under your shoulders.', 'warning'));
      }
      if (targetDeviation > 0.35) {
        cues.push(cue('hand-variant', this.handWidthCue(), 'info'));
      }
      if (this.peakFlexion >= 80 && this.worstBodyLine >= 165 && this.worstHandOffset <= 0.3) {
        cues.push(cue('strong-pushup', 'Strong push-up — full range!', 'success'));
      }
    }

    const formScore = liveScore([
      Math.max(0, 158 - bodyLine) * 1.1,
      Math.max(0, Math.abs(hipOffset) - 0.05) * 200,
      Math.max(0, Math.abs(handOffset) - 0.3) * 50,
      step.active ? Math.max(0, 110 - elbows.min) * 0.3 : 0,
    ]);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: step.active
        ? elbows.min < 120
          ? 'Chest low'
          : 'Pressing up'
        : this.reps > 0
          ? 'Plank top'
          : `Ready for ${VARIANT_TITLES[this.variant].toLowerCase()}`,
      formScore,
      progress: clamp((180 - elbows.min - 15) / 75, 0, 1),
      cues,
      holdSeconds: 0,
      side: null,
      metrics: {
        elbowLeft: elbows.left,
        elbowRight: elbows.right,
        minElbow: elbows.min,
        peakFlexion: this.peakFlexion,
        bodyLine: this.worstBodyLine,
        hipOffset,
        handOffset,
        handWidthRatio,
        variantDeviation: this.worstHandRatioDeviation,
        reps: this.reps,
      },
      chips: [
        buildChip('Depth', clamp(((this.peakFlexion - 10) / 80) * 100, 0, 100), 80, 45),
        buildChip('Body line', clamp(((this.worstBodyLine - 130) / 45) * 100, 0, 100), 80, 55),
        buildChip('Hands', clamp(100 - this.worstHandRatioDeviation * 120, 0, 100), 80, 50),
      ],
    };
  }

  private scoreRep(): void {
    if (this.peakFlexion < 60) {
      this.issues.flag('shallow-pushup', 'Lower your chest further', 22);
    } else if (this.peakFlexion < 78) {
      this.issues.flag('depth-pushup', 'A little more depth next rep', 8);
    }
    if (this.worstBodyLine < 150) {
      this.issues.flag('sagging', 'Keep your body straight — no sagging', 18);
    } else if (this.worstBodyLine < 165) {
      this.issues.flag('body-line', 'Tighten your core and glutes', 8);
    }
    if (this.worstHipOffset > 0.12) {
      this.issues.flag('hips', 'Keep your hips level with your body', 12);
    }
    if (this.worstHandOffset > 0.45) {
      this.issues.flag('hand-position', 'Stack your hands under your shoulders', 8);
    }
    if (this.worstHandRatioDeviation > 0.4) {
      this.issues.flag('hand-width', this.handWidthCue(), 8);
    }
  }

  private handWidthDeviation(width: number): number {
    if (this.variant === 'wide') return Math.max(0, 1.28 - width);
    if (this.variant === 'diamond') return Math.max(0, width - 0.62);
    return Math.max(0, 0.65 - width, width - 1.55);
  }

  private handWidthCue(): string {
    if (this.variant === 'wide') return 'Set your hands a little wider.';
    if (this.variant === 'diamond') return 'Bring your hands closer together.';
    return 'Place your hands about shoulder-width apart.';
  }
}

