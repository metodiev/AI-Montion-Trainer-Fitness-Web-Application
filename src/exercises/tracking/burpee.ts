import { clamp } from '@/core/geometry';
import { ankleMid, squatDepth, wristMid } from '@/core/pose';
import { LM, type PoseFrame } from '@/core/types';
import type { ExerciseTracker, RepEvent, TrackerContext, TrackerResult } from '../types';
import {
  buildChip,
  bodyLost,
  cue,
  liveScore,
  makeRepEvent,
  RepIssues,
} from './core';
import { bothFeetAirborne, hasLandmarks, jumpHeight, SQUAT_LANDMARKS } from './measure';
import { horizontalPosture } from './pushupHelpers';

type BurpeePhase = 'stand' | 'crouch' | 'plank' | 'return' | 'jump';

const REQUIRED = [
  ...SQUAT_LANDMARKS,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
] as const;

const PHASE_LABELS: Record<BurpeePhase, string> = {
  stand: 'Stand tall',
  crouch: 'Hands down',
  plank: 'Plank',
  return: 'Feet back in',
  jump: 'Jump!',
};

export class BurpeeTracker implements ExerciseTracker {
  private phase: BurpeePhase = 'stand';
  private phaseSince = 0;
  private reps = 0;
  private issues = new RepIssues();
  private startedAt = 0;
  private peakDepth = 0;
  private worstLine = 180;
  private worstHipOffset = 0;
  private peakJump = 0;
  private airborneMs = 0;
  private lastRepAt = Number.NEGATIVE_INFINITY;
  private lastCue: TrackerResult['cues'][number] | undefined;

  reset(): void {
    this.phase = 'stand';
    this.phaseSince = 0;
    this.reps = 0;
    this.issues = new RepIssues();
    this.startedAt = 0;
    this.peakDepth = 0;
    this.worstLine = 180;
    this.worstHipOffset = 0;
    this.peakJump = 0;
    this.airborneMs = 0;
    this.lastRepAt = Number.NEGATIVE_INFINITY;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, REQUIRED, 0.3)) {
      return { ...bodyLost('Keep your whole body in frame.'), reps: this.reps };
    }

    const posture = horizontalPosture(frame);
    const depth = squatDepth(frame, context.baseline.hipAnkle);
    const handsLow = wristMid(frame).y > ankleMid(frame).y - 0.5;
    const airborne = bothFeetAirborne(frame, context.baseline);
    const jump = jumpHeight(frame, context.baseline);
    const dt = clamp(context.dtMs, 0, 200);

    if (this.phase === 'stand' && context.now - this.lastRepAt > 600) {
      if (!posture.horizontal && depth > 0.24 && handsLow) {
        this.phase = 'crouch';
        this.phaseSince = context.now;
        this.startedAt = context.now;
        this.issues.reset();
        this.peakDepth = depth;
        this.worstLine = 180;
        this.worstHipOffset = 0;
        this.peakJump = 0;
      }
    } else if (this.phase === 'crouch') {
      this.peakDepth = Math.max(this.peakDepth, depth);
      if (posture.horizontal && posture.bodyLine > 140) {
        this.phase = 'plank';
        this.phaseSince = context.now;
        this.worstLine = posture.bodyLine;
        this.worstHipOffset = posture.hipOffset;
      } else if (context.now - this.phaseSince > 3000) {
        this.resetRep('Squat down and plant your hands, then kick back.');
      }
    } else if (this.phase === 'plank') {
      if (!posture.horizontal && depth > 0.2) {
        this.phase = 'return';
        this.phaseSince = context.now;
      } else {
        this.worstLine = Math.min(this.worstLine, posture.bodyLine);
        this.worstHipOffset = Math.max(Math.abs(posture.hipOffset), this.worstHipOffset);
      }
      if (context.now - this.phaseSince > 5000) {
        this.resetRep('Bring your feet back under you.');
      }
    } else if (this.phase === 'return') {
      this.peakDepth = Math.max(this.peakDepth, depth);
      this.peakJump = Math.max(this.peakJump, jump);
      if (airborne && context.now - this.phaseSince > 120) {
        this.phase = 'jump';
        this.phaseSince = context.now;
        this.airborneMs = dt;
        this.peakJump = Math.max(this.peakJump, jump);
      } else if (context.now - this.phaseSince > 2200) {
        this.issues.flag('no-jump', 'Jump explosively at the top', 20);
        this.resetRep('Add a jump at the top of every burpee.');
      }
    } else if (this.phase === 'jump') {
      this.peakJump = Math.max(this.peakJump, jump);
      this.airborneMs += dt;
      if (!airborne && this.airborneMs > 80) {
        const repEvent = this.finishRep(context.now);
        this.resetRep();
        this.lastRepAt = context.now;
        return this.result(frame, context, airborne, {
          repEvent,
          extraCue: repEvent.score >= 80 ? cue('burpee-clean', 'Burpee complete — strong work!', 'success') : undefined,
        });
      }
      if (context.now - this.phaseSince > 2500) {
        this.resetRep('Land softly and stand tall.');
      }
    }

    return this.result(frame, context, airborne, {});
  }

  private finishRep(now: number): RepEvent {
    this.reps += 1;
    if (this.peakDepth < 0.3) {
      this.issues.flag('shallow-crouch', 'Sit deeper into the crouch', 14);
    }
    if (this.worstLine < 150) {
      this.issues.flag('plank-line', 'Keep your body straight in the plank', 18);
    } else if (this.worstLine < 165) {
      this.issues.flag('plank-soft', 'Brace your core in the plank', 8);
    }
    if (this.worstHipOffset > 0.12) {
      this.issues.flag('hips', 'Keep your hips in line in the plank', 10);
    }
    if (this.peakJump < 0.025) {
      this.issues.flag('low-jump', 'Jump higher at the top', 12);
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

  private resetRep(message?: string): void {
    this.phase = 'stand';
    this.phaseSince = 0;
    this.airborneMs = 0;
    if (message) {
      this.lastCue = cue('burpee-reset', message, 'info');
    }
  }

  private result(
    frame: PoseFrame,
    context: TrackerContext,
    airborne: boolean,
    options: { repEvent?: RepEvent; extraCue?: TrackerResult['cues'][number] },
  ): TrackerResult {
    const posture = horizontalPosture(frame);
    const depth = squatDepth(frame, context.baseline.hipAnkle);
    const jump = jumpHeight(frame, context.baseline);
    const cues: TrackerResult['cues'] = [];
    if (options.extraCue) cues.push(options.extraCue);
    if (this.lastCue) {
      cues.push(this.lastCue);
      this.lastCue = undefined;
    }

    switch (this.phase) {
      case 'stand':
        if (this.reps === 0) {
          cues.push(cue('burpee-start', 'Squat, hands down, kick back, jump up.', 'info'));
        }
        break;
      case 'crouch':
        cues.push(cue('kick-back', 'Kick your feet back into a plank.', 'info'));
        break;
      case 'plank':
        cues.push(cue('burpee-plank', 'Chest down if you like, then jump your feet in.', 'info'));
        if (posture.bodyLine < 155) {
          cues.push(cue('burpee-line', 'Keep your body straight in the plank.', 'warning'));
        }
        break;
      case 'return':
        cues.push(cue('jump-now', 'Explode up and jump!', 'info'));
        break;
      case 'jump':
        cues.push(cue('land-soft', 'Land softly and stand tall.', 'success'));
        break;
    }

    const formScore = liveScore([
      Math.max(0, 158 - this.worstLine) * 1.2,
      Math.max(0, this.worstHipOffset - 0.08) * 150,
      this.phase === 'return' ? 10 : 0,
    ]);

    return {
      ready: true,
      reps: this.reps,
      repEvent: options.repEvent,
      stateLabel: this.phase === 'jump' && airborne ? 'Airborne' : PHASE_LABELS[this.phase],
      formScore,
      progress: this.phaseProgress(),
      cues,
      holdSeconds: 0,
      side: null,
      metrics: {
        phase: ['stand', 'crouch', 'plank', 'return', 'jump'].indexOf(this.phase),
        depth,
        bodyLine: posture.bodyLine,
        hipOffset: posture.hipOffset,
        jump,
        peakJump: this.peakJump,
        peakDepth: this.peakDepth,
        worstLine: this.worstLine,
        worstHipOffset: this.worstHipOffset,
        reps: this.reps,
      },
      chips: [
        buildChip('Plank line', clamp(((this.worstLine - 130) / 50) * 100, 0, 100), 80, 55),
        buildChip('Jump', clamp((this.peakJump / 0.06) * 100, 0, 100), 70, 35),
        { label: PHASE_LABELS[this.phase], tone: this.phase === 'jump' ? 'good' : 'neutral' },
      ],
    };
  }

  private phaseProgress(): number {
    const order: BurpeePhase[] = ['stand', 'crouch', 'plank', 'return', 'jump'];
    return order.indexOf(this.phase) / (order.length - 1);
  }
}

