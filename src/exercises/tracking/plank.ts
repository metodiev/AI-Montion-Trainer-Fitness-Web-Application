import { clamp } from '@/core/geometry';
import { shoulderMid, wristMid } from '@/core/pose';
import { LM, type PoseFrame } from '@/core/types';
import type { ExerciseTracker, TrackerContext, TrackerResult } from '../types';
import {
  buildChip,
  bodyLost,
  cue,
  HoldAccumulator,
  liveScore,
} from './core';
import { hasLandmarks, SQUAT_LANDMARKS } from './measure';
import { horizontalPosture } from './pushupHelpers';

const REQUIRED = [
  ...SQUAT_LANDMARKS,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
] as const;

export class PlankTracker implements ExerciseTracker {
  private hold = new HoldAccumulator();
  private bestScore = 0;

  reset(): void {
    this.hold.reset();
    this.bestScore = 0;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, REQUIRED, 0.35)) {
      return { ...bodyLost('Keep your whole body in frame.'), holdSeconds: this.hold.seconds };
    }

    const posture = horizontalPosture(frame);
    const shoulder = shoulderMid(frame);
    const wrist = wristMid(frame);
    const wristOffset = Math.abs(wrist.x - shoulder.x);
    const aligned =
      posture.bodyLine >= 160 &&
      Math.abs(posture.hipOffset) <= 0.1 &&
      wristOffset <= 0.45;

    if (!posture.horizontal) {
      return {
        ready: false,
        reps: 0,
        stateLabel: 'Set up your plank',
        formScore: 0,
        progress: clamp(this.hold.seconds / 30, 0, 1),
        cues: [
          cue(
            'get-into-plank',
            'Set up a high plank — hands under shoulders, body in one line.',
            'info',
          ),
        ],
        holdSeconds: this.hold.seconds,
        side: null,
        metrics: { bodyLine: posture.bodyLine, holdSeconds: this.hold.seconds },
        chips: [{ label: `Hold ${this.hold.seconds.toFixed(1)}s`, tone: 'neutral' }],
      };
    }

    const holdState = this.hold.update(context.dtMs, aligned, 450);
    const formScore = liveScore([
      Math.max(0, 162 - posture.bodyLine) * 1.4,
      Math.max(0, Math.abs(posture.hipOffset) - 0.04) * 320,
      Math.max(0, wristOffset - 0.3) * 80,
    ]);
    this.bestScore = Math.max(this.bestScore, aligned ? formScore : 0);

    const cues: TrackerResult['cues'] = [];
    if (posture.hipOffset > 0.06) {
      cues.push(cue('hips-down', 'Lift your hips — don’t let them sag.', 'error'));
    } else if (posture.hipOffset < -0.08) {
      cues.push(cue('hips-high', 'Lower your hips — you’re piking up.', 'warning'));
    }
    if (posture.bodyLine < 155) {
      cues.push(cue('plank-line', 'Keep your shoulders, hips and heels in one line.', 'warning'));
    }
    if (wristOffset > 0.42) {
      cues.push(cue('stack-shoulders', 'Stack your shoulders over your hands.', 'warning'));
    }
    if (aligned && this.hold.seconds >= 2) {
      cues.push(cue('solid-plank', 'Rock-solid plank — stay with it.', 'success'));
    }
    if (holdState.broke) {
      cues.push(cue('plank-broke', 'Reset your alignment and hold again.', 'warning'));
    }

    return {
      ready: true,
      reps: 0,
      stateLabel: aligned ? 'Holding strong' : 'Adjust your plank',
      formScore,
      progress: clamp(this.hold.seconds / 30, 0, 1),
      cues,
      holdSeconds: this.hold.seconds,
      side: null,
      metrics: {
        bodyLine: posture.bodyLine,
        hipOffset: posture.hipOffset,
        wristOffset,
        aligned: aligned ? 1 : 0,
        holdSeconds: this.hold.seconds,
        bestScore: this.bestScore,
      },
      chips: [
        {
          label: `Hold ${this.hold.seconds.toFixed(1)}s`,
          tone: aligned ? 'good' : 'warn',
        },
        buildChip('Alignment', clamp(((posture.bodyLine - 130) / 45) * 100, 0, 100), 80, 55),
        buildChip('Hips', clamp(100 - Math.abs(posture.hipOffset) * 500, 0, 100), 80, 55),
      ],
    };
  }
}

