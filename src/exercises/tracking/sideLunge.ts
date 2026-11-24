import { clamp } from '@/core/geometry';
import { kneeAngle, squatDepth, torsoLean } from '@/core/pose';
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
import { hasLandmarks, kneeValgus, SQUAT_LANDMARKS, torsoShiftTowardLeg } from './measure';

interface RepState {
  side: Side;
  peakDepth: number;
  peakStep: number;
  worstLeanShift: number;
  worstOtherKnee: number;
  worstValgus: number;
  startedAt: number;
}

export class SideLungeTracker implements ExerciseTracker {
  private cycle = new CycleCounter({
    mode: 'high',
    enter: 0.2,
    exit: 0.06,
    countOn: 'exit',
    minActiveMs: 200,
    minCycleMs: 550,
    cooldownMs: 250,
  });
  private reps = 0;
  private issues = new RepIssues();
  private state: RepState | null = null;
  private lastSide: Side | null = null;

  reset(): void {
    this.cycle.reset();
    this.reps = 0;
    this.issues = new RepIssues();
    this.state = null;
    this.lastSide = null;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, SQUAT_LANDMARKS, 0.35)) {
      return { ...bodyLost('Face the camera and keep both legs in frame.'), reps: this.reps };
    }

    const depth = squatDepth(frame, context.baseline.hipAnkle);
    const stepWidth = Math.abs(frame.points[27].x - frame.points[28].x);
    const kneeLeft = kneeAngle(frame, 'left');
    const kneeRight = kneeAngle(frame, 'right');
    const workingSide: Side = kneeLeft <= kneeRight ? 'left' : 'right';
    const otherSide: Side = workingSide === 'left' ? 'right' : 'left';
    const lean = torsoLean(frame);
    const shift = torsoShiftTowardLeg(frame, workingSide);
    const otherKnee = otherSide === 'left' ? kneeLeft : kneeRight;
    const valgus = kneeValgus(frame, workingSide);

    const cycleStep = this.cycle.update(depth, context.now, true);
    let repEvent: RepEvent | undefined;

    if (cycleStep.justActivated) {
      this.issues.reset();
      this.state = {
        side: workingSide,
        peakDepth: depth,
        peakStep: stepWidth,
        worstLeanShift: shift,
        worstOtherKnee: otherKnee,
        worstValgus: valgus,
        startedAt: context.now,
      };
    }
    if (cycleStep.active && this.state) {
      this.state.peakDepth = Math.max(this.state.peakDepth, depth);
      this.state.peakStep = Math.max(this.state.peakStep, stepWidth);
      this.state.worstLeanShift = Math.max(this.state.worstLeanShift, shift);
      this.state.worstOtherKnee = Math.min(this.state.worstOtherKnee, otherKnee);
      this.state.worstValgus = Math.max(this.state.worstValgus, valgus);
    }
    if (cycleStep.justCompleted && this.state) {
      if (this.state.peakStep < 0.7) {
        this.issues.flag('narrow-step', 'Take a wider step to the side', 20);
      } else if (this.state.peakDepth < 0.18) {
        this.issues.flag('shallow', 'Sit deeper into the working leg', 18);
      } else {
        this.scoreRep(this.state);
        this.reps += 1;
        repEvent = makeRepEvent(
          this.reps,
          this.issues.score,
          this.state.side,
          context.now - this.state.startedAt,
          this.issues.messages,
          context.now,
        );
        this.lastSide = this.state.side;
        this.state = null;
      }
    }

    const cues: TrackerResult['cues'] = [];
    if (cycleStep.active && this.state) {
      if (this.state.peakStep < 0.75) {
        cues.push(cue('step-wider', 'Step wider to the side.', 'warning'));
      }
      if (this.state.peakDepth < 0.2) {
        cues.push(cue('sit-deeper-side', 'Sit back into your working leg.', 'warning'));
      }
      if (this.state.worstOtherKnee < 155) {
        cues.push(cue('straight-other-leg', 'Keep the other leg straight.', 'warning'));
      }
      if (this.state.worstValgus > 0.06) {
        cues.push(cue('knee-in', 'Keep your knee over your toes — don’t collapse inward.', 'error'));
      }
      if (this.state.worstLeanShift > 0.45 || this.state.worstLeanShift < -0.15) {
        cues.push(cue('torso-side', 'Keep your chest lifted and centred.', 'warning'));
      }
      if (
        this.state.peakStep >= 0.9 &&
        this.state.peakDepth >= 0.25 &&
        this.state.worstValgus <= 0.05
      ) {
        cues.push(cue('strong-side-lunge', 'Strong side lunge — nice control.', 'success'));
      }
    }
    if (repEvent && repEvent.score >= 85) {
      cues.push(cue('clean-side', 'Clean rep!', 'success'));
    }
    if (this.lastSide && this.state?.side === this.lastSide && cycleStep.justActivated && this.reps > 0) {
      cues.push(cue('switch-sides', 'Switch sides when you’re ready.', 'info'));
    }

    const formScore = liveScore([
      Math.max(0, 155 - otherKnee) * 0.5,
      Math.max(0, valgus - 0.04) * 250,
      Math.max(0, 0.8 - stepWidth) * 40,
    ]);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: cycleStep.active ? `Side lunge · ${workingSide}` : this.reps > 0 ? 'Standing tall' : 'Ready to step',
      formScore,
      progress: clamp(depth / 0.4, 0, 1),
      cues,
      holdSeconds: 0,
      side: cycleStep.active ? workingSide : this.lastSide,
      metrics: {
        depth,
        step: stepWidth,
        kneeLeft,
        kneeRight,
        valgus,
        lean,
        shift,
        reps: this.reps,
      },
      chips: [
        buildChip('Step', clamp((stepWidth / 1.4) * 100, 0, 100), 80, 45),
        buildChip('Depth', clamp((depth / 0.35) * 100, 0, 100), 80, 45),
        buildChip('Knee track', clamp(100 - Math.max(0, valgus) * 650, 0, 100), 80, 55),
      ],
    };
  }

  private scoreRep(state: RepState): void {
    if (state.peakDepth < 0.3) {
      this.issues.flag('depth', 'Sit deeper into the lunge', 12);
    }
    if (state.peakStep < 0.95) {
      this.issues.flag('step', 'Take a slightly wider step', 8);
    }
    if (state.worstOtherKnee < 150) {
      this.issues.flag('bent-other', 'Keep the other leg straight', 12);
    }
    if (state.worstValgus > 0.07) {
      this.issues.flag('knee-valgus', 'Keep the knee tracking over the foot', 15);
    }
    if (state.worstLeanShift > 0.45) {
      this.issues.flag('lean', 'Stay tall through the torso', 10);
    } else if (state.worstLeanShift < -0.15) {
      this.issues.flag('lean-away', 'Lean slightly into the working leg', 8);
    }
  }
}

