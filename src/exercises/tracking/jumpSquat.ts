import { clamp } from '@/core/geometry';
import { squatDepth, torsoLean } from '@/core/pose';
import type { PoseFrame } from '@/core/types';
import type { ExerciseTracker, RepEvent, TrackerContext, TrackerResult } from '../types';
import {
  buildChip,
  bodyLost,
  cue,
  liveScore,
  makeRepEvent,
  RepIssues,
} from './core';
import {
  bothFeetAirborne,
  hasLandmarks,
  jumpHeight,
  kneeValgus,
  SQUAT_LANDMARKS,
} from './measure';

type Phase = 'ready' | 'squat' | 'awaitJump' | 'landing';

export class JumpSquatTracker implements ExerciseTracker {
  private phase: Phase = 'ready';
  private reps = 0;
  private issues = new RepIssues();
  private startedAt = 0;
  private peakDepth = 0;
  private worstLean = 0;
  private worstValgus = 0;
  private jumpPeak = 0;
  private awaitSince = 0;
  private lastRepAt = Number.NEGATIVE_INFINITY;
  private lastCueCode: string | null = null;

  reset(): void {
    this.phase = 'ready';
    this.reps = 0;
    this.issues = new RepIssues();
    this.startedAt = 0;
    this.peakDepth = 0;
    this.worstLean = 0;
    this.worstValgus = 0;
    this.jumpPeak = 0;
    this.awaitSince = 0;
    this.lastRepAt = Number.NEGATIVE_INFINITY;
    this.lastCueCode = null;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, SQUAT_LANDMARKS, 0.35)) {
      return { ...bodyLost('Step back so I can see your whole body.'), reps: this.reps };
    }

    const depth = squatDepth(frame, context.baseline.hipAnkle);
    const lean = torsoLean(frame);
    const valgus = Math.max(kneeValgus(frame, 'left'), kneeValgus(frame, 'right'));
    const airborne = bothFeetAirborne(frame, context.baseline);
    const jump = jumpHeight(frame, context.baseline);
    let repEvent: RepEvent | undefined;

    if (this.phase === 'ready' || this.phase === 'landing') {
      if (this.phase === 'landing' && !airborne && depth < 0.1) {
        this.phase = 'ready';
      }
      if (!airborne && depth > 0.22 && context.now - this.lastRepAt > 500) {
        this.phase = 'squat';
        this.startedAt = context.now;
        this.issues.reset();
        this.peakDepth = depth;
        this.worstLean = lean;
        this.worstValgus = valgus;
        this.jumpPeak = 0;
        this.lastCueCode = null;
      }
    } else if (this.phase === 'squat') {
      this.peakDepth = Math.max(this.peakDepth, depth);
      this.worstLean = Math.max(this.worstLean, lean);
      this.worstValgus = Math.max(this.worstValgus, valgus);
      if (airborne) {
        repEvent = this.completeRep(context.now, jump);
        this.phase = 'landing';
        this.lastRepAt = context.now;
      } else if (depth <= 0.075) {
        this.phase = 'awaitJump';
        this.awaitSince = context.now;
      }
    } else if (this.phase === 'awaitJump') {
      this.jumpPeak = Math.max(this.jumpPeak, jump);
      if (airborne) {
        repEvent = this.completeRep(context.now, jump);
        this.phase = 'landing';
        this.lastRepAt = context.now;
      } else if (context.now - this.awaitSince > 380) {
        this.phase = 'ready';
        this.lastCueCode = 'add-jump';
        this.issues.flag('no-jump', 'Explode into a jump at the top', 25);
      }
    }

    const cues: TrackerResult['cues'] = [];
    if (this.lastCueCode === 'add-jump') {
      cues.push(cue('add-jump', 'Add an explosive jump at the top.', 'warning'));
    }
    if (this.phase === 'squat') {
      if (this.peakDepth < 0.35) {
        cues.push(cue('deeper-jump-squat', 'Sit deeper before you jump.', 'warning'));
      }
      if (lean > 32) {
        cues.push(cue('chest-up-jump', 'Keep your chest up — sit back, not forward.', 'error'));
      }
      if (valgus > 0.07) {
        cues.push(cue('knees-out-jump', 'Push your knees out over your toes.', 'warning'));
      }
      cues.push(cue('jump-ready', 'Now explode up!', 'info'));
    } else if (this.phase === 'awaitJump') {
      cues.push(cue('jump-top', 'Jump! Drive through your legs.', 'warning'));
    } else if (this.phase === 'landing') {
      cues.push(cue('soft-landing', 'Land softly with bent knees.', 'info'));
    }
    if (repEvent && repEvent.score >= 85) {
      cues.push(cue('explosive', 'Explosive rep — great power!', 'success'));
    }

    const formScore = liveScore([
      Math.max(0, lean - 20) * 1.3,
      Math.max(0, valgus - 0.05) * 240,
      this.phase === 'squat' ? Math.max(0, 0.4 - this.peakDepth) * 30 : 0,
    ]);

    return {
      ready: true,
      reps: this.reps,
      repEvent,
      stateLabel:
        this.phase === 'squat'
          ? 'Loading the jump'
          : this.phase === 'awaitJump'
            ? 'Jump!'
            : this.phase === 'landing'
              ? 'Soft landing'
              : this.reps > 0
                ? 'Ready for the next jump'
                : 'Ready to jump',
      formScore,
      progress:
        this.phase === 'squat'
          ? clamp(this.peakDepth / 0.5, 0, 1)
          : this.phase === 'awaitJump'
            ? 1
            : 0,
      cues,
      holdSeconds: 0,
      side: null,
      metrics: {
        depth,
        peakDepth: this.peakDepth,
        jump,
        peakJump: this.jumpPeak,
        lean,
        valgus,
        phase: ['ready', 'squat', 'awaitJump', 'landing'].indexOf(this.phase),
        reps: this.reps,
        airborne: airborne ? 1 : 0,
      },
      chips: [
        buildChip('Depth', clamp((this.peakDepth / 0.5) * 100, 0, 100), 80, 45),
        buildChip('Jump', clamp((this.jumpPeak / 0.06) * 100, 0, 100), 70, 35),
        buildChip('Landing', this.phase === 'landing' ? 60 : 100, 80, 50),
      ],
    };
  }

  private completeRep(now: number, jump: number): RepEvent {
    this.reps += 1;
    this.jumpPeak = Math.max(this.jumpPeak, jump);
    if (this.peakDepth < 0.3) {
      this.issues.flag('shallow', 'Squat deeper before jumping', 20);
    } else if (this.peakDepth < 0.42) {
      this.issues.flag('depth', 'A little more depth for more power', 8);
    }
    if (this.jumpPeak < 0.02) {
      this.issues.flag('low-jump', 'Jump higher at the top', 16);
    } else if (this.jumpPeak < 0.035) {
      this.issues.flag('jump', 'Push for a bigger jump', 6);
    }
    if (this.worstLean > 35) {
      this.issues.flag('lean', 'Keep your chest up', 12);
    }
    if (this.worstValgus > 0.07) {
      this.issues.flag('knees-in', 'Push your knees out', 12);
    }
    return makeRepEvent(
      this.reps,
      this.issues.score,
      null,
      now - this.startedAt,
      this.issues.messages,
      now,
    );
  }
}

