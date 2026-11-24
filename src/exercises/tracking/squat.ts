import { clamp } from '@/core/geometry';
import { ankleDistance, kneeAngle, shoulderDistance, squatDepth, torsoLean } from '@/core/pose';
import type { PoseFrame } from '@/core/types';
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
import { kneeValgus, SQUAT_LANDMARKS, hasLandmarks } from './measure';

const GOOD_DEPTH = 0.45;
const TARGET_DEPTH = 0.55;

export class SquatTracker implements ExerciseTracker {
  private cycle = new CycleCounter({
    mode: 'high',
    enter: 0.22,
    exit: 0.075,
    countOn: 'exit',
    minActiveMs: 180,
    minCycleMs: 520,
    cooldownMs: 280,
  });
  private reps = 0;
  private issues = new RepIssues();
  private repStartedAt = 0;
  private peakDepth = 0;
  private peakKneeFlexion = 0;
  private worstLean = 0;
  private worstValgus = 0;
  private worstSymmetry = 0;
  private unstableStance = false;

  reset(): void {
    this.cycle.reset();
    this.reps = 0;
    this.issues = new RepIssues();
    this.repStartedAt = 0;
    this.peakDepth = 0;
    this.peakKneeFlexion = 0;
    this.worstLean = 0;
    this.worstValgus = 0;
    this.worstSymmetry = 0;
    this.unstableStance = false;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, SQUAT_LANDMARKS, 0.4)) {
      return { ...bodyLost('Stay in frame — I lost your legs.'), reps: this.reps };
    }

    const depth = squatDepth(frame, context.baseline.hipAnkle);
    const kneeLeft = kneeAngle(frame, 'left');
    const kneeRight = kneeAngle(frame, 'right');
    const flexion = Math.max(180 - kneeLeft, 180 - kneeRight);
    const lean = torsoLean(frame);
    const valgusLeft = kneeValgus(frame, 'left');
    const valgusRight = kneeValgus(frame, 'right');
    const valgus = Math.max(valgusLeft, valgusRight);
    const symmetry = Math.abs(kneeLeft - kneeRight);
    const frontal = shoulderDistance(frame) > 0.5;
    const feetWereNarrow =
      frontal && ankleDistance(frame) < 0.5 * shoulderDistance(frame);

    const step = this.cycle.update(depth, context.now, true);
    let repEvent: RepEvent | undefined;

    if (step.justActivated) {
      this.repStartedAt = context.now;
      this.issues.reset();
      this.peakDepth = depth;
      this.peakKneeFlexion = flexion;
      this.worstLean = lean;
      this.worstValgus = valgus;
      this.worstSymmetry = symmetry;
      this.unstableStance = feetWereNarrow;
    }

    if (step.active) {
      this.peakDepth = Math.max(this.peakDepth, depth);
      this.peakKneeFlexion = Math.max(this.peakKneeFlexion, flexion);
      this.worstLean = Math.max(this.worstLean, lean);
      this.worstValgus = Math.max(this.worstValgus, valgus);
      this.worstSymmetry = Math.max(this.worstSymmetry, symmetry);
    }

    if (step.justCompleted) {
      if (this.peakKneeFlexion < 18 || this.peakDepth < 0.22) {
        this.issues.flag('no-knee-bend', 'Sit back and bend your knees', 25);
      } else {
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
    }

    const cues = this.buildCues(depth, lean, valgus, symmetry, step.active, repEvent?.score);
    const livePenalty =
      (step.active ? Math.max(0, GOOD_DEPTH - depth) * 55 : 0) +
      Math.max(0, lean - 20) * 1.2 +
      Math.max(0, valgus - 0.04) * 320;
    const formScore = liveScore([livePenalty]);

    const depthPercent = clamp((Math.max(this.peakDepth, depth) / TARGET_DEPTH) * 100, 0, 100);
    const kneeTrack = clamp(100 - Math.max(0, valgus) * 700, 0, 100);
    const torso = clamp(100 - Math.max(0, lean - 10) * 3, 0, 100);

    const stateLabel = step.active
      ? depth > GOOD_DEPTH
        ? 'Deep squat'
        : 'Squatting'
      : this.reps > 0
        ? 'Standing tall'
        : 'Ready to squat';

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel,
      formScore,
      progress: clamp(depth / TARGET_DEPTH, 0, 1),
      cues,
      holdSeconds: 0,
      side: null,
      metrics: {
        depth,
        peakDepth: this.peakDepth,
        kneeLeft,
        kneeRight,
        lean,
        valgus,
        symmetry,
        reps: this.reps,
      },
      chips: [
        buildChip('Depth', depthPercent, 80, 45),
        buildChip('Torso', torso, 80, 55),
        buildChip('Knee track', kneeTrack, 80, 55),
      ],
    };
  }

  private scoreRep(): void {
    if (this.peakDepth < 0.3) {
      this.issues.flag('shallow', 'Go deeper — hips below knee level', 32);
    } else if (this.peakDepth < GOOD_DEPTH) {
      this.issues.flag('almost-depth', 'Sink a little deeper next time', 14);
    }
    if (this.worstLean > 40) {
      this.issues.flag('back-collapse', 'Keep your chest up and back straight', 18);
    } else if (this.worstLean > 28) {
      this.issues.flag('torso-lean', 'Keep your torso more upright', 8);
    }
    if (this.worstValgus > 0.075) {
      this.issues.flag('knees-in', 'Push your knees out over your toes', 18);
    } else if (this.worstValgus > 0.045) {
      this.issues.flag('knees-soft', 'Track your knees over your toes', 8);
    }
    if (this.worstSymmetry > 22) {
      this.issues.flag('asymmetry', 'Keep your weight even on both legs', 10);
    }
    if (this.unstableStance) {
      this.issues.flag('stance', 'Set your feet shoulder-width apart', 6);
    }
  }

  private buildCues(
    depth: number,
    lean: number,
    valgus: number,
    symmetry: number,
    active: boolean,
    repScore?: number,
  ): TrackerResult['cues'] {
    const cues: TrackerResult['cues'] = [];
    if (lean > 34) {
      cues.push(cue('chest-up', 'Chest up — keep your back straight.', 'error'));
    } else if (lean > 24) {
      cues.push(cue('lean', 'Keep your torso tall.', 'warning'));
    }
    if (valgus > 0.07) {
      cues.push(cue('knees-out', 'Push your knees out over your toes.', 'error'));
    } else if (valgus > 0.045) {
      cues.push(cue('knees-track', 'Track your knees over your toes.', 'warning'));
    }
    if (symmetry > 25 && active) {
      cues.push(cue('even', 'Keep both legs working evenly.', 'warning'));
    }
    if (active && depth < 0.4) {
      cues.push(cue('deeper', 'Go a little deeper — sink your hips.', 'warning'));
    }
    if (active && depth >= GOOD_DEPTH && lean <= 20 && valgus <= 0.04) {
      cues.push(cue('great-depth', 'Beautiful depth — drive through your heels!', 'success'));
    }
    if (repScore !== undefined && repScore >= 85) {
      cues.push(cue('great-squat', 'Great squat!', 'success'));
    }
    return cues;
  }
}

