import { clamp } from '@/core/geometry';
import {
  ankleDistance,
  elbowAngle,
  kneeAngle,
  shoulderDistance,
  wristAboveShoulder,
} from '@/core/pose';
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
import { hasLandmarks } from './measure';

const REQUIRED = [
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
] as const;

export class JumpingJackTracker implements ExerciseTracker {
  private cycle = new CycleCounter({
    mode: 'high',
    enter: 0.8,
    exit: 0.32,
    countOn: 'exit',
    minActiveMs: 90,
    minCycleMs: 380,
    cooldownMs: 200,
  });
  private reps = 0;
  private issues = new RepIssues();
  private repStartedAt = 0;
  private peakOpenness = 0;
  private peakArm = 0;
  private peakLeg = 0;
  private worstElbowFlex = 0;
  private worstKneeFlex = 0;
  private worstArmAsymmetry = 0;
  private partialSince: number | null = null;

  reset(): void {
    this.cycle.reset();
    this.reps = 0;
    this.issues = new RepIssues();
    this.repStartedAt = 0;
    this.peakOpenness = 0;
    this.peakArm = 0;
    this.peakLeg = 0;
    this.worstElbowFlex = 0;
    this.worstKneeFlex = 0;
    this.worstArmAsymmetry = 0;
    this.partialSince = null;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, REQUIRED, 0.35)) {
      return { ...bodyLost('Keep your arms and legs in frame.'), reps: this.reps };
    }

    const armL = wristAboveShoulder(frame, 'left');
    const armR = wristAboveShoulder(frame, 'right');
    const minArm = Math.min(armL, armR);
    const elbowFlexL = 180 - elbowAngle(frame, 'left');
    const elbowFlexR = 180 - elbowAngle(frame, 'right');
    const legRatio = ankleDistance(frame) / Math.max(shoulderDistance(frame), 0.2);

    const armNorm = clamp((minArm - 0.05) / 0.5, 0, 1);
    const legNorm = clamp((legRatio - 1.1) / 0.75, 0, 1);
    const openness = Math.min(armNorm, legNorm);
    const elbowFlex = Math.max(elbowFlexL, elbowFlexR);
    const armAsymmetry = Math.abs(armL - armR);
    const kneeBend = Math.max(180 - kneeAngle(frame, 'left'), 180 - kneeAngle(frame, 'right'));

    const step = this.cycle.update(openness, context.now, true);
    let repEvent: RepEvent | undefined;

    if (step.justActivated) {
      this.repStartedAt = context.now;
      this.issues.reset();
      this.peakOpenness = openness;
      this.peakArm = armNorm;
      this.peakLeg = legNorm;
      this.worstElbowFlex = armNorm > 0.6 ? elbowFlex : 0;
      this.worstKneeFlex = 0;
      this.worstArmAsymmetry = armAsymmetry;
    }

    if (step.active) {
      this.peakOpenness = Math.max(this.peakOpenness, openness);
      this.peakArm = Math.max(this.peakArm, armNorm);
      this.peakLeg = Math.max(this.peakLeg, legNorm);
      if (armNorm > 0.7) this.worstElbowFlex = Math.max(this.worstElbowFlex, elbowFlex);
      if (legNorm > 0.7) this.worstKneeFlex = Math.max(this.worstKneeFlex, kneeBend);
      this.worstArmAsymmetry = Math.max(this.worstArmAsymmetry, armAsymmetry);
    }

    if (step.justCompleted) {
      this.scoreRep();
      this.reps += 1;
      repEvent = makeRepEvent(
        this.reps,
        this.issues.score,
        null,
        context.now - this.repStartedAt,
        this.issues.messages,
        context.now,
      );
    }

    if (!step.active && openness > 0.32 && openness < 0.8) {
      this.partialSince ??= context.now;
    } else {
      this.partialSince = null;
    }

    const cues: TrackerResult['cues'] = [];
    if (step.active) {
      if (this.peakLeg < 0.88) cues.push(cue('wider', 'Open your legs a little wider.', 'warning'));
      if (this.peakArm < 0.88) cues.push(cue('higher', 'Swing your arms higher overhead.', 'warning'));
      if (elbowFlex > 32) cues.push(cue('straight-arms', 'Keep your arms straight.', 'warning'));
      if (armAsymmetry > 0.25) cues.push(cue('even-arms', 'Raise both arms evenly.', 'warning'));
      if (this.peakOpenness > 0.95 && elbowFlex <= 25 && kneeBend <= 20) {
        cues.push(cue('perfect-jack', 'Perfect jumping jack!', 'success'));
      }
    } else if (this.partialSince !== null && context.now - this.partialSince > 400) {
      cues.push(cue('open-all-the-way', 'Open all the way — arms up, feet wide.', 'warning'));
    }

    const livePenalties = [
      Math.max(0, 1 - Math.max(armNorm, 0.4)) * 20,
      Math.max(0, 1 - legNorm) * 10,
      Math.max(0, elbowFlex - 30) * 0.4,
      Math.max(0, armAsymmetry - 0.2) * 40,
    ];
    const formScore = liveScore(livePenalties);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: step.active ? 'Arms overhead' : this.reps > 0 ? 'Back to start' : 'Feet together',
      formScore,
      progress: clamp(Math.max(openness, step.active ? this.peakOpenness : openness), 0, 1),
      cues,
      holdSeconds: 0,
      side: null,
      metrics: {
        armNorm,
        legNorm,
        openness,
        legRatio,
        elbowFlex,
        armAsymmetry,
        kneeBend,
        reps: this.reps,
      },
      chips: [
        buildChip('Arms up', Math.max(this.peakArm, armNorm) * 100, 80, 45),
        buildChip('Feet wide', Math.max(this.peakLeg, legNorm) * 100, 80, 45),
        buildChip('Arms straight', clamp(100 - Math.max(0, this.worstElbowFlex - 10) * 3, 0, 100), 80, 55),
      ],
    };
  }

  private scoreRep(): void {
    if (this.peakOpenness < 0.86) {
      this.issues.flag('incomplete', 'Complete the full opening every rep', 12);
    }
    if (this.peakLeg < 0.88) {
      this.issues.flag('feet-narrow', 'Open your feet wider', 12);
    }
    if (this.peakArm < 0.88) {
      this.issues.flag('arms-low', 'Reach your arms higher', 12);
    }
    if (this.worstElbowFlex > 32) {
      this.issues.flag('bent-arms', 'Keep your arms straight', 10);
    }
    if (this.worstArmAsymmetry > 0.25) {
      this.issues.flag('unlevel-arms', 'Keep both arms level', 10);
    }
    if (this.worstKneeFlex > 30) {
      this.issues.flag('bent-knees', 'Keep a soft but straight leg', 6);
    }
  }
}

