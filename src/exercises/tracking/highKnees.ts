import { clamp } from '@/core/geometry';
import { kneeAngle, kneeLift, torsoLean } from '@/core/pose';
import type { PoseFrame, Side } from '@/core/types';
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

interface SideState {
  peakLift: number;
  worstLean: number;
  worstSupportFlex: number;
  startedAt: number;
}

const freshSide = (): SideState => ({
  peakLift: 0,
  worstLean: 0,
  worstSupportFlex: 0,
  startedAt: 0,
});

export class HighKneesTracker implements ExerciseTracker {
  private counters: Record<Side, CycleCounter> = {
    left: this.makeCounter(),
    right: this.makeCounter(),
  };
  private sides: Record<Side, SideState> = { left: freshSide(), right: freshSide() };
  private reps = 0;
  private issues = new RepIssues();
  private lastSide: Side | null = null;
  private consecutive = 0;
  private firstRepAt = 0;
  private lastRepAt = 0;

  reset(): void {
    this.counters = { left: this.makeCounter(), right: this.makeCounter() };
    this.sides = { left: freshSide(), right: freshSide() };
    this.reps = 0;
    this.issues = new RepIssues();
    this.lastSide = null;
    this.consecutive = 0;
    this.firstRepAt = 0;
    this.lastRepAt = 0;
  }

  private makeCounter(): CycleCounter {
    return new CycleCounter({
      mode: 'high',
      enter: 0.56,
      exit: 0.22,
      countOn: 'exit',
      minActiveMs: 50,
      minCycleMs: 250,
      cooldownMs: 80,
    });
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, SQUAT_LANDMARKS, 0.35)) {
      return { ...bodyLost('Keep your legs in frame for high knees.'), reps: this.reps };
    }

    const liftLeft = clamp(kneeLift(frame, 'left', context.baseline.thighVertical), 0, 1.4);
    const liftRight = clamp(kneeLift(frame, 'right', context.baseline.thighVertical), 0, 1.4);
    const lean = torsoLean(frame);
    const supportFlexLeft = 180 - kneeAngle(frame, 'left');
    const supportFlexRight = 180 - kneeAngle(frame, 'right');
    let repEvent: RepEvent | undefined;

    for (const side of ['left', 'right'] as const) {
      const lift = side === 'left' ? liftLeft : liftRight;
      const otherLift = side === 'left' ? liftRight : liftLeft;
      const enabled = otherLift < 0.4;
      const step = this.counters[side].update(lift, context.now, enabled);

      if (step.justActivated) {
        this.issues.reset();
        this.sides[side] = { ...freshSide(), startedAt: context.now };
      }
      const state = this.sides[side];
      if (step.active) {
        state.peakLift = Math.max(state.peakLift, lift);
        state.worstLean = Math.max(state.worstLean, lean);
        state.worstSupportFlex = Math.max(
          state.worstSupportFlex,
          side === 'left' ? supportFlexRight : supportFlexLeft,
        );
      }
      if (step.justCompleted) {
        this.scoreRep(side);
        this.reps += 1;
        if (this.firstRepAt === 0) this.firstRepAt = context.now;
        this.lastRepAt = context.now;
        this.consecutive = this.lastSide === side ? this.consecutive + 1 : 1;
        this.lastSide = side;
        repEvent = makeRepEvent(
          this.reps,
          this.issues.score,
          side,
          context.now - state.startedAt,
          this.issues.messages,
          context.now,
        );
      }
    }

    const activeSide: Side = liftLeft >= liftRight ? 'left' : 'right';
    const activeLift = Math.max(liftLeft, liftRight);
    const cues: TrackerResult['cues'] = [];
    if (activeLift > 0.18 && activeLift < 0.55) {
      cues.push(cue('knees-higher', 'Drive your knees higher toward your chest.', 'warning'));
    }
    if (lean > 24) {
      cues.push(cue('tall-high-knees', 'Stay tall — don’t lean back.', 'error'));
    } else if (lean > 16) {
      cues.push(cue('upright-high-knees', 'Keep your torso upright.', 'warning'));
    }
    if (this.consecutive >= 3) {
      cues.push(cue('alternate-high-knees', 'Alternate legs to keep the rhythm.', 'info'));
    }
    if (activeLift > 0.8 && lean <= 16) {
      cues.push(cue('fast-knees', 'Light and fast — great rhythm!', 'success'));
    }
    if (repEvent && repEvent.score >= 85) {
      cues.push(cue('clean-knee', 'Crisp rep!', 'success'));
    }

    const formScore = liveScore([
      Math.max(0, lean - 15) * 1.8,
      Math.max(0, 0.55 - activeLift) * 35,
    ]);
    const cadence =
      this.reps > 1 && this.lastRepAt > this.firstRepAt
        ? Math.round((this.reps / (this.lastRepAt - this.firstRepAt)) * 60000)
        : 0;

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: activeLift > 0.5 ? `Knee drive · ${activeSide}` : 'Running in place',
      formScore,
      progress: clamp(activeLift / 0.9, 0, 1),
      cues,
      holdSeconds: 0,
      side: activeLift > 0.2 ? activeSide : this.lastSide,
      metrics: {
        liftLeft,
        liftRight,
        lean,
        cadence,
        reps: this.reps,
      },
      chips: [
        buildChip('Left knee', Math.max(liftLeft, this.sides.left.peakLift) * 100, 70, 40),
        buildChip('Right knee', Math.max(liftRight, this.sides.right.peakLift) * 100, 70, 40),
        { label: `${cadence} /min`, tone: cadence >= 60 ? 'good' : 'neutral' },
      ],
    };
  }

  private scoreRep(side: Side): void {
    const state = this.sides[side];
    if (state.peakLift < 0.66) {
      this.issues.flag('low-knee', 'Drive the knee higher', 24);
    } else if (state.peakLift < 0.82) {
      this.issues.flag('knee-height', 'A little more height next rep', 10);
    }
    if (state.worstLean > 25) {
      this.issues.flag('lean-back', 'Keep your torso tall', 12);
    } else if (state.worstLean > 17) {
      this.issues.flag('lean', 'Stay upright', 6);
    }
    if (state.worstSupportFlex > 35) {
      this.issues.flag('support-bend', 'Stay springy but keep the support leg stronger', 6);
    }
  }
}
