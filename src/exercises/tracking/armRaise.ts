import { clamp } from '@/core/geometry';
import { elbowAngle, shoulderDistance, torsoLean, wristAboveShoulder } from '@/core/pose';
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
] as const;

export class ArmRaiseTracker implements ExerciseTracker {
  private cycle = new CycleCounter({
    mode: 'high',
    enter: 0.4,
    exit: 0.06,
    countOn: 'exit',
    minActiveMs: 150,
    minCycleMs: 520,
    cooldownMs: 250,
  });
  private reps = 0;
  private issues = new RepIssues();
  private startedAt = 0;
  private peakElevation = 0;
  private worstElbowFlex = 0;
  private worstAsymmetry = 0;
  private worstLean = 0;

  reset(): void {
    this.cycle.reset();
    this.reps = 0;
    this.issues = new RepIssues();
    this.startedAt = 0;
    this.peakElevation = 0;
    this.worstElbowFlex = 0;
    this.worstAsymmetry = 0;
    this.worstLean = 0;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, REQUIRED, 0.35)) {
      return { ...bodyLost('Keep your arms in frame.'), reps: this.reps };
    }

    const elevationL = wristAboveShoulder(frame, 'left');
    const elevationR = wristAboveShoulder(frame, 'right');
    const minElevation = Math.min(elevationL, elevationR);
    const elbowFlex = Math.max(180 - elbowAngle(frame, 'left'), 180 - elbowAngle(frame, 'right'));
    const asymmetry = Math.abs(elevationL - elevationR);
    const lean = torsoLean(frame);
    const shoulderWidth = shoulderDistance(frame);

    const step = this.cycle.update(minElevation, context.now, true);
    let repEvent: RepEvent | undefined;

    if (step.justActivated) {
      this.issues.reset();
      this.startedAt = context.now;
      this.peakElevation = minElevation;
      this.worstElbowFlex = elbowFlex;
      this.worstAsymmetry = asymmetry;
      this.worstLean = lean;
    }
    if (step.active) {
      this.peakElevation = Math.max(this.peakElevation, minElevation);
      this.worstElbowFlex = Math.max(this.worstElbowFlex, elbowFlex);
      this.worstAsymmetry = Math.max(this.worstAsymmetry, asymmetry);
      this.worstLean = Math.max(this.worstLean, lean);
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
      if (this.peakElevation < 0.55) {
        cues.push(cue('raise-higher', 'Reach your arms higher overhead.', 'warning'));
      }
      if (this.worstElbowFlex > 30) {
        cues.push(cue('straighten-arms', 'Keep your arms straight.', 'warning'));
      }
      if (asymmetry > 0.22) {
        cues.push(cue('even-raise', 'Raise both arms evenly.', 'warning'));
      }
      if (lean > 22) {
        cues.push(cue('stand-tall-arms', 'Stand tall — don’t lean back.', 'warning'));
      }
      if (this.peakElevation >= 0.62 && this.worstElbowFlex <= 22 && asymmetry <= 0.15) {
        cues.push(cue('great-arms', 'Beautiful reach!', 'success'));
      }
    }

    const formScore = liveScore([
      Math.max(0, lean - 15) * 1.5,
      Math.max(0, this.worstElbowFlex - 20) * 0.6,
      Math.max(0, asymmetry - 0.15) * 60,
      step.active ? Math.max(0, 0.55 - this.peakElevation) * 40 : 0,
    ]);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: step.active ? 'Arms overhead' : this.reps > 0 ? 'Arms down' : 'Ready to raise',
      formScore,
      progress: clamp(Math.max(minElevation, this.peakElevation) / 0.7, 0, 1),
      cues,
      holdSeconds: 0,
      side: null,
      metrics: {
        elevationL,
        elevationR,
        minElevation,
        peakElevation: this.peakElevation,
        elbowFlex,
        asymmetry,
        lean,
        shoulderWidth,
        reps: this.reps,
      },
      chips: [
        buildChip('Reach', Math.max(this.peakElevation, minElevation) * 130, 80, 45),
        buildChip('Arms straight', clamp(100 - Math.max(0, this.worstElbowFlex - 10) * 3, 0, 100), 80, 55),
        buildChip('Even', clamp(100 - this.worstAsymmetry * 300, 0, 100), 80, 55),
      ],
    };
  }

  private scoreRep(): void {
    if (this.peakElevation < 0.45) {
      this.issues.flag('low-reach', 'Raise your arms higher overhead', 24);
    } else if (this.peakElevation < 0.58) {
      this.issues.flag('reach', 'Reach a little higher next time', 10);
    }
    if (this.worstElbowFlex > 30) {
      this.issues.flag('bent-arms', 'Keep your elbows straight', 12);
    }
    if (this.worstAsymmetry > 0.22) {
      this.issues.flag('uneven', 'Raise both arms evenly', 12);
    }
    if (this.worstLean > 22) {
      this.issues.flag('lean', 'Keep your torso upright', 8);
    }
  }
}
