import { clamp, range } from '@/core/geometry';
import { hipMid, kneeAngle, rawAnkleY, shoulderMid } from '@/core/pose';
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
import { hasLandmarks, kneeDrive, SQUAT_LANDMARKS } from './measure';
import { horizontalPosture } from './pushupHelpers';

const REQUIRED = [
  ...SQUAT_LANDMARKS,
  ...([13, 14, 15, 16] as const),
] as const;

interface SideState {
  peakDrive: number;
  worstLine: number;
  worstHipRange: number;
  startedAt: number;
}

const freshSide = (): SideState => ({
  peakDrive: 0,
  worstLine: 180,
  worstHipRange: 0,
  startedAt: 0,
});

export class MountainClimbersTracker implements ExerciseTracker {
  private counters: Record<Side, CycleCounter> = {
    left: this.makeCounter(),
    right: this.makeCounter(),
  };
  private sides: Record<Side, SideState> = { left: freshSide(), right: freshSide() };
  private reps = 0;
  private issues = new RepIssues();
  private hipHistory: { at: number; y: number }[] = [];
  private lastSide: Side | null = null;

  reset(): void {
    this.counters = { left: this.makeCounter(), right: this.makeCounter() };
    this.sides = { left: freshSide(), right: freshSide() };
    this.reps = 0;
    this.issues = new RepIssues();
    this.hipHistory = [];
    this.lastSide = null;
  }

  private makeCounter(): CycleCounter {
    return new CycleCounter({
      mode: 'high',
      enter: 0.15,
      exit: -0.15,
      countOn: 'enter',
      minCycleMs: 300,
      cooldownMs: 100,
    });
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, REQUIRED, 0.35)) {
      return { ...bodyLost('Keep your body in frame.'), reps: this.reps };
    }

    const posture = horizontalPosture(frame);
    const shoulder = shoulderMid(frame);
    const hipLevel = Math.abs(shoulder.y - hipMid(frame).y);
    const inPlank = posture.horizontal && hipLevel < 0.4;
    if (!inPlank) {
      return {
        ready: false,
        reps: this.reps,
        stateLabel: 'Find your plank',
        formScore: 0,
        progress: 0,
        cues: [cue('start-plank', 'Start in a high plank, shoulders over your hands.', 'info')],
        holdSeconds: 0,
        side: null,
        metrics: { bodyLine: posture.bodyLine },
        chips: [],
      };
    }

    const hip = hipMid(frame);
    this.hipHistory.push({ at: context.now, y: hip.y });
    while (this.hipHistory.length > 0 && this.hipHistory[0].at < context.now - 900) {
      this.hipHistory.shift();
    }
    const hipRange = range(this.hipHistory.map((entry) => entry.y));
    const driveLeft = kneeDrive(frame, 'left');
    const driveRight = kneeDrive(frame, 'right');
    const kneeLeft = kneeAngle(frame, 'left');
    const kneeRight = kneeAngle(frame, 'right');
    const ankleY = rawAnkleY(frame);
    const bodyLine = posture.bodyLine;
    let repEvent: RepEvent | undefined;

    for (const side of ['left', 'right'] as const) {
      const drive = side === 'left' ? driveLeft : driveRight;
      const otherDrive = side === 'left' ? driveRight : driveLeft;
      const enabled = otherDrive < 0.4;
      const step = this.counters[side].update(drive, context.now, enabled);
      if (step.justActivated) {
        this.issues.reset();
        this.sides[side] = {
          peakDrive: drive,
          worstLine: Math.min(bodyLine, 180 - hipLevel * 200),
          worstHipRange: hipRange,
          startedAt: context.now,
        };
      }
      const state = this.sides[side];
      if (step.active) {
        state.peakDrive = Math.max(state.peakDrive, drive);
        state.worstLine = Math.min(state.worstLine, Math.min(bodyLine, 180 - hipLevel * 200));
        state.worstHipRange = Math.max(state.worstHipRange, hipRange);
      }
      if (step.justCompleted) {
        this.scoreRep(side);
        this.reps += 1;
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

    const activeSide: Side = driveLeft >= driveRight ? 'left' : 'right';
    const activeDrive = Math.max(driveLeft, driveRight);
    const cues: TrackerResult['cues'] = [];
    if (hipRange > 0.12) {
      cues.push(cue('hips-quiet', 'Keep your hips low and steady — no bouncing.', 'warning'));
    }
    if (hipLevel > 0.3) {
      cues.push(cue('climber-line', 'Keep your torso level — don’t let your hips sag.', 'warning'));
    }
    if (activeDrive > 0.15) {
      cues.push(cue('drive-knee', 'Drive your knee toward your chest.', 'info'));
    }
    if (this.reps >= 4 && hipRange < 0.1 && bodyLine >= 160) {
      cues.push(cue('climber-rhythm', 'Great rhythm — stay quiet through the hips!', 'success'));
    }

    const formScore = liveScore([
      Math.max(0, hipLevel - 0.15) * 120,
      Math.max(0, hipRange - 0.05) * 260,
    ]);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: activeDrive > 0.1 ? `Knee drive · ${activeSide}` : 'Mountain climber pace',
      formScore,
      progress: clamp((activeDrive + 0.3) / 0.8, 0, 1),
      cues,
      holdSeconds: 0,
      side: activeDrive > 0.05 ? activeSide : this.lastSide,
      metrics: {
        driveLeft,
        driveRight,
        bodyLine,
        hipOffset: posture.hipOffset,
        hipRange,
        kneeLeft,
        kneeRight,
        ankleY,
        reps: this.reps,
      },
      chips: [
        { label: `${this.reps} drives`, tone: this.reps > 0 ? 'good' : 'neutral' },
        buildChip('Torso level', clamp(100 - hipLevel * 260, 0, 100), 80, 55),
        buildChip('Hips steady', clamp(100 - hipRange * 400, 0, 100), 80, 55),
      ],
    };
  }

  private scoreRep(side: Side): void {
    const state = this.sides[side];
    if (state.worstLine < 150) {
      this.issues.flag('plank-collapse', 'Keep your body in a straight line', 18);
    } else if (state.worstLine < 165) {
      this.issues.flag('plank-line', 'Brace your core — hips in line', 8);
    }
    if (state.worstHipRange > 0.12) {
      this.issues.flag('hip-bounce', 'Keep your hips quiet and low', 12);
    }
    if (state.peakDrive < 0.25) {
      this.issues.flag('short-drive', 'Drive the knee closer to your chest', 10);
    }
  }
}

