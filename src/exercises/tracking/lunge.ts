import { clamp } from '@/core/geometry';
import { ankleDistance, torsoLean } from '@/core/pose';
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
import { hasLandmarks, kneeOverToe, perSideKneeAngles, SQUAT_LANDMARKS } from './measure';

interface RepState {
  side: Side;
  startedAt: number;
  peakFlexion: number;
  worstLean: number;
  worstKneeOverToe: number;
  stance: number;
  otherLegFlexion: number;
}

export class LungeTracker implements ExerciseTracker {
  private cycle = new CycleCounter({
    mode: 'low',
    enter: 112,
    exit: 155,
    countOn: 'exit',
    minActiveMs: 200,
    minCycleMs: 620,
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
      return { ...bodyLost('Turn slightly side-on and keep both legs in frame.'), reps: this.reps };
    }

    const knees = perSideKneeAngles(frame);
    const lean = torsoLean(frame);
    const stance = ankleDistance(frame);
    const otherSide: Side = knees.active === 'left' ? 'right' : 'left';
    const otherFlexion = 180 - (otherSide === 'left' ? knees.left : knees.right);
    const overToe = kneeOverToe(frame, knees.active);

    const step = this.cycle.update(knees.min, context.now, true);
    let repEvent: RepEvent | undefined;

    if (step.justActivated) {
      this.issues.reset();
      this.state = {
        side: knees.active,
        startedAt: context.now,
        peakFlexion: 180 - knees.min,
        worstLean: lean,
        worstKneeOverToe: overToe,
        stance,
        otherLegFlexion: otherFlexion,
      };
    }

    if (step.active && this.state) {
      this.state.peakFlexion = Math.max(this.state.peakFlexion, 180 - knees.min);
      this.state.worstLean = Math.max(this.state.worstLean, lean);
      this.state.worstKneeOverToe = Math.max(this.state.worstKneeOverToe, overToe);
      this.state.stance = Math.min(this.state.stance, stance);
      this.state.otherLegFlexion = Math.max(this.state.otherLegFlexion, otherFlexion);
    }

    if (step.justCompleted && this.state) {
      if (this.state.peakFlexion < 40) {
        this.issues.flag('shallow', 'Bend both knees and lower your hips', 22);
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
    if (step.active && this.state) {
      if (this.state.peakFlexion < 80) {
        cues.push(cue('deeper-lunge', 'Lower deeper — bend both knees toward 90°.', 'warning'));
      }
      if (lean > 32) {
        cues.push(cue('torso-lunge', 'Keep your torso upright and core braced.', 'error'));
      }
      if (this.state.worstKneeOverToe > 0.45) {
        cues.push(cue('knee-over-toe', 'Keep your knee tracking over your ankle.', 'warning'));
      }
      if (this.state.stance < 0.75) {
        cues.push(cue('short-stance', 'Take a longer step into the lunge.', 'warning'));
      }
      if (this.state.otherLegFlexion < 30) {
        cues.push(cue('back-leg', 'Lower the back knee toward the floor.', 'info'));
      }
      if (
        this.state.peakFlexion >= 82 &&
        lean <= 22 &&
        this.state.worstKneeOverToe <= 0.35
      ) {
        cues.push(cue('strong-lunge', 'Strong lunge — hold that alignment.', 'success'));
      }
    }
    if (repEvent && repEvent.score >= 85) {
      cues.push(cue('clean-lunge', 'Excellent lunge!', 'success'));
    }
    if (
      this.lastSide !== null &&
      this.state?.side === this.lastSide &&
      step.justActivated &&
      this.reps > 0
    ) {
      cues.push(cue('switch-legs', 'Switch legs when you’re ready.', 'info'));
    }

    const flexion = 180 - knees.min;
    const depth = clamp((flexion - 30) / 60, 0, 1);
    const kneeTrack = clamp(100 - Math.max(0, this.state?.worstKneeOverToe ?? overToe) * 180, 0, 100);
    const formScore = liveScore([
      Math.max(0, lean - 20) * 1.4,
      Math.max(0, (this.state?.worstKneeOverToe ?? 0) - 0.35) * 120,
      Math.max(0, 0.75 - stance) * 40,
    ]);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel: step.active ? `Lunge · ${knees.active}` : this.reps > 0 ? 'Standing tall' : 'Ready to lunge',
      formScore,
      progress: clamp(depth, 0, 1),
      cues,
      holdSeconds: 0,
      side: step.active ? knees.active : this.lastSide,
      metrics: {
        kneeLeft: knees.left,
        kneeRight: knees.right,
        peakFlexion: this.state?.peakFlexion ?? 0,
        lean,
        stance,
        kneeOverToe: this.state?.worstKneeOverToe ?? overToe,
        reps: this.reps,
      },
      chips: [
        buildChip('Depth', depth * 100, 75, 40),
        buildChip('Knee track', kneeTrack, 80, 50),
        buildChip('Torso', clamp(100 - Math.max(0, lean - 10) * 3.2, 0, 100), 80, 55),
      ],
    };
  }

  private scoreRep(state: RepState): void {
    if (state.peakFlexion < 70) {
      this.issues.flag('shallow', 'Go deeper — aim for a 90° front knee', 18);
    } else if (state.peakFlexion < 82) {
      this.issues.flag('depth', 'A little more depth next rep', 8);
    }
    if (state.worstLean > 35) {
      this.issues.flag('torso', 'Keep your torso upright', 15);
    } else if (state.worstLean > 25) {
      this.issues.flag('torso-soft', 'Brace your core and stay tall', 7);
    }
    if (state.worstKneeOverToe > 0.5) {
      this.issues.flag('knee-over-toe', 'Keep your knee over your ankle', 12);
    } else if (state.worstKneeOverToe > 0.38) {
      this.issues.flag('knee-travel', 'Shorten your front stride slightly', 6);
    }
    if (state.stance < 0.8) {
      this.issues.flag('short-stance', 'Take a longer step', 8);
    }
    if (state.otherLegFlexion < 25) {
      this.issues.flag('back-leg', 'Bend the back knee too', 8);
    }
  }
}

