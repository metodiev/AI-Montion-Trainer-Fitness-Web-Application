import { clamp } from '@/core/geometry';
import { kneeAngle, kneeLift, shoulderDistance, torsoLean } from '@/core/pose';
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
  kneeFlexAtTop: number;
  startedAt: number;
}

const freshSide = (): SideState => ({
  peakLift: 0,
  worstLean: 0,
  worstSupportFlex: 0,
  kneeFlexAtTop: 0,
  startedAt: 0,
});

export class KneeRaiseTracker implements ExerciseTracker {
  private counters: Record<Side, CycleCounter> = {
    left: this.makeCounter(),
    right: this.makeCounter(),
  };
  private sides: Record<Side, SideState> = { left: freshSide(), right: freshSide() };
  private reps = 0;
  private issues = new RepIssues();
  private lastSide: Side | null = null;
  private consecutiveSide = 0;

  reset(): void {
    this.counters = { left: this.makeCounter(), right: this.makeCounter() };
    this.sides = { left: freshSide(), right: freshSide() };
    this.reps = 0;
    this.issues = new RepIssues();
    this.lastSide = null;
    this.consecutiveSide = 0;
  }

  private makeCounter(): CycleCounter {
    return new CycleCounter({
      mode: 'high',
      enter: 0.52,
      exit: 0.2,
      countOn: 'exit',
      minActiveMs: 100,
      minCycleMs: 420,
      cooldownMs: 170,
    });
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, SQUAT_LANDMARKS, 0.35)) {
      return { ...bodyLost('Stay in frame so I can track your legs.'), reps: this.reps };
    }

    const liftLeft = clamp(kneeLift(frame, 'left', context.baseline.thighVertical), 0, 1.4);
    const liftRight = clamp(kneeLift(frame, 'right', context.baseline.thighVertical), 0, 1.4);
    const kneeFlexLeft = 180 - kneeAngle(frame, 'left');
    const kneeFlexRight = 180 - kneeAngle(frame, 'right');
    const lean = torsoLean(frame);
    const supportKneeAngleLeft = kneeAngle(frame, 'left');
    const supportKneeAngleRight = kneeAngle(frame, 'right');

    let repEvent: RepEvent | undefined;

    for (const side of ['left', 'right'] as const) {
      const lift = side === 'left' ? liftLeft : liftRight;
      const otherLift = side === 'left' ? liftRight : liftLeft;
      const kneeFlex = side === 'left' ? kneeFlexLeft : kneeFlexRight;
      const supportFlex = 180 - (side === 'left' ? supportKneeAngleRight : supportKneeAngleLeft);
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
        state.worstSupportFlex = Math.max(state.worstSupportFlex, supportFlex);
        state.kneeFlexAtTop = Math.max(state.kneeFlexAtTop, kneeFlex);
      }

      if (step.justCompleted) {
        this.scoreRep(side);
        this.reps += 1;
        this.consecutiveSide = this.lastSide === side ? this.consecutiveSide + 1 : 1;
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

    const activeLift = Math.max(liftLeft, liftRight);
    const activeSide: Side = liftLeft >= liftRight ? 'left' : 'right';
    const cues: TrackerResult['cues'] = [];
    if (activeLift > 0.18 && activeLift < 0.55) {
      cues.push(cue('lift-higher', 'Lift your knee higher toward hip height.', 'warning'));
    }
    if (lean > 22) {
      cues.push(cue('stand-tall', 'Stand tall — don’t lean back.', 'error'));
    } else if (lean > 15) {
      cues.push(cue('upright', 'Keep your torso upright.', 'warning'));
    }
    const supportFlex = activeSide === 'left' ? 180 - supportKneeAngleRight : 180 - supportKneeAngleLeft;
    if (supportFlex > 28) {
      cues.push(cue('straight-support', 'Keep your standing leg straight and strong.', 'warning'));
    }
    if (this.consecutiveSide >= 2) {
      cues.push(cue('alternate', 'Alternate legs for an even workout.', 'info'));
    }
    if (activeLift > 0.82 && lean <= 15 && supportFlex <= 20) {
      cues.push(cue('great-knee-raise', 'Great knee lift!', 'success'));
    }
    if (repEvent && repEvent.score >= 85) {
      cues.push(cue('clean-knee-raise', 'Clean rep — excellent control.', 'success'));
    }

    const formScore = liveScore([
      Math.max(0, lean - 15) * 1.8,
      Math.max(0, supportFlex - 20) * 0.9,
      Math.max(0, 0.55 - activeLift) * 40,
    ]);
    const sideLift = (side: Side) => (side === 'left' ? liftLeft : liftRight);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: activeLift > 0.5 ? `Knee up · ${activeSide}` : this.reps > 0 ? 'Standing tall' : 'Ready',
      formScore,
      progress: clamp(activeLift / 0.9, 0, 1),
      cues,
      holdSeconds: 0,
      side: activeLift > 0.2 ? activeSide : this.lastSide,
      metrics: {
        liftLeft,
        liftRight,
        kneeFlexLeft,
        kneeFlexRight,
        lean,
        reps: this.reps,
        shoulderWidth: shoulderDistance(frame),
      },
      chips: [
        buildChip('Left lift', sideLift('left') * 100, 70, 40),
        buildChip('Right lift', sideLift('right') * 100, 70, 40),
        buildChip('Torso', clamp(100 - Math.max(0, lean - 8) * 3.5, 0, 100), 80, 55),
      ],
    };
  }

  private scoreRep(side: Side): void {
    const state = this.sides[side];
    if (state.peakLift < 0.62) {
      this.issues.flag('shallow', 'Lift the knee to hip height', 24);
    } else if (state.peakLift < 0.8) {
      this.issues.flag('almost', 'Try to lift a little higher', 10);
    }
    if (state.kneeFlexAtTop < 25) {
      this.issues.flag('straight-leg', 'Bend the knee as you lift it', 14);
    }
    if (state.worstLean > 25) {
      this.issues.flag('lean-back', 'Don’t lean back — stay tall', 14);
    } else if (state.worstLean > 16) {
      this.issues.flag('lean', 'Keep your torso upright', 6);
    }
    if (state.worstSupportFlex > 30) {
      this.issues.flag('support-bend', 'Keep the standing leg straighter', 10);
    }
  }
}
