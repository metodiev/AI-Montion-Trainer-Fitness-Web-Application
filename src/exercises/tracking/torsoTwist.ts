import { clamp } from '@/core/geometry';
import { torsoLean } from '@/core/pose';
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
import { hasLandmarks } from './measure';

const REQUIRED = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip] as const;

export class TorsoTwistTracker implements ExerciseTracker {
  private cycle = new CycleCounter({
    mode: 'high',
    enter: 0.5,
    exit: 0.15,
    countOn: 'exit',
    minActiveMs: 180,
    minCycleMs: 600,
    cooldownMs: 300,
  });
  private reps = 0;
  private issues = new RepIssues();
  private startedAt = 0;
  private peakTwist = 0;
  private worstHipRatio = 1;
  private worstLean = 0;
  private direction: Side | null = null;

  reset(): void {
    this.cycle.reset();
    this.reps = 0;
    this.issues = new RepIssues();
    this.startedAt = 0;
    this.peakTwist = 0;
    this.worstHipRatio = 1;
    this.worstLean = 0;
    this.direction = null;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, REQUIRED, 0.4)) {
      return { ...bodyLost('Keep your shoulders and hips in frame.'), reps: this.reps };
    }
    if (context.baseline.shoulderWidth < 0.45) {
      return {
        ready: false,
        reps: this.reps,
        stateLabel: 'Face the camera',
        formScore: 0,
        progress: 0,
        cues: [cue('face-camera', 'Face the camera so I can measure your rotation.', 'info')],
        holdSeconds: 0,
        side: null,
        metrics: {},
        chips: [],
      };
    }

    const width = Math.abs(
      frame.points[LM.leftShoulder].x - frame.points[LM.rightShoulder].x,
    );
    const widthRatio = width / context.baseline.shoulderWidth;
    const twist = clamp((1 - widthRatio) / 0.3, 0, 1);
    const hipRatio =
      Math.abs(frame.points[LM.leftHip].x - frame.points[LM.rightHip].x) /
      context.baseline.shoulderWidth;
    const lean = torsoLean(frame);
    const zDiff =
      frame.points[LM.leftShoulder].z - frame.points[LM.rightShoulder].z;
    const direction: Side | null = Math.abs(zDiff) < 0.04 ? null : zDiff < 0 ? 'right' : 'left';

    const step = this.cycle.update(twist, context.now, true);
    let repEvent: RepEvent | undefined;

    if (step.justActivated) {
      this.issues.reset();
      this.startedAt = context.now;
      this.peakTwist = twist;
      this.worstHipRatio = hipRatio;
      this.worstLean = lean;
      this.direction = direction;
    }
    if (step.active) {
      this.peakTwist = Math.max(this.peakTwist, twist);
      this.worstHipRatio = Math.min(this.worstHipRatio, hipRatio);
      this.worstLean = Math.max(this.worstLean, lean);
      if (direction) this.direction = direction;
    }
    if (step.justCompleted) {
      this.scoreRep();
      this.reps += 1;
      repEvent = makeRepEvent(
        this.reps,
        this.issues.score,
        this.direction,
        context.now - this.startedAt,
        this.issues.messages,
        context.now,
      );
    }

    const cues: TrackerResult['cues'] = [];
    if (step.active) {
      if (this.peakTwist < 0.75) {
        cues.push(cue('twist-more', 'Rotate further — lead with your shoulders.', 'warning'));
      }
      if (this.worstHipRatio < 0.6) {
        cues.push(cue('hips-square', 'Keep your hips facing forward.', 'warning'));
      }
      if (lean > 22) {
        cues.push(cue('twist-upright', 'Stay tall through the twist.', 'warning'));
      }
      if (this.peakTwist >= 0.85 && this.worstHipRatio >= 0.65 && lean <= 20) {
        cues.push(cue('great-twist', 'Great rotation — hips stayed square!', 'success'));
      }
    }

    const score = liveScore([
      Math.max(0, this.worstHipRatio < 0.6 ? 20 : 0),
      Math.max(0, lean - 20) * 1.5,
      step.active ? Math.max(0, 0.7 - this.peakTwist) * 30 : 0,
    ]);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: step.active ? 'Twisting' : this.reps > 0 ? 'Facing forward' : 'Ready to twist',
      formScore: score,
      progress: clamp(Math.max(twist, this.peakTwist) / 0.85, 0, 1),
      cues,
      holdSeconds: 0,
      side: step.active ? this.direction : null,
      metrics: {
        shoulderWidth: width,
        widthRatio,
        twist,
        peakTwist: this.peakTwist,
        hipRatio: this.worstHipRatio,
        lean,
        reps: this.reps,
      },
      chips: [
        buildChip('Rotation', Math.max(this.peakTwist, twist) * 100, 80, 45),
        buildChip('Hips square', clamp(this.worstHipRatio * 160, 0, 100), 80, 55),
        buildChip('Torso', clamp(100 - Math.max(0, lean - 10) * 3, 0, 100), 80, 55),
      ],
    };
  }

  private scoreRep(): void {
    if (this.peakTwist < 0.7) {
      this.issues.flag('shallow-twist', 'Rotate further each rep', 18);
    } else if (this.peakTwist < 0.85) {
      this.issues.flag('twist', 'A little more rotation next time', 8);
    }
    if (this.worstHipRatio < 0.6) {
      this.issues.flag('hip-rotation', 'Keep your hips facing forward', 14);
    }
    if (this.worstLean > 25) {
      this.issues.flag('lean', 'Stay tall and centred', 10);
    }
  }
}
