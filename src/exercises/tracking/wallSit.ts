import { clamp } from '@/core/geometry';
import { kneeAngle, rawAnkleY, torsoLean } from '@/core/pose';
import type { PoseFrame } from '@/core/types';
import type { ExerciseTracker, TrackerContext, TrackerResult } from '../types';
import {
  buildChip,
  bodyLost,
  cue,
  HoldAccumulator,
  liveScore,
} from './core';
import { hasLandmarks, kneeOverToe, SQUAT_LANDMARKS } from './measure';

export class WallSitTracker implements ExerciseTracker {
  private hold = new HoldAccumulator();
  private bestScore = 0;

  reset(): void {
    this.hold.reset();
    this.bestScore = 0;
  }

  update(frame: PoseFrame, context: TrackerContext): TrackerResult {
    if (!hasLandmarks(frame, SQUAT_LANDMARKS, 0.35)) {
      return {
        ...bodyLost('Keep your whole body in frame for the wall sit.'),
        holdSeconds: this.hold.seconds,
      };
    }

    const kneeLeft = kneeAngle(frame, 'left');
    const kneeRight = kneeAngle(frame, 'right');
    const lean = torsoLean(frame);
    const feetDown =
      Math.abs(rawAnkleY(frame) - context.baseline.groundY) < 0.05;
    const squatting = kneeLeft < 140 && kneeRight < 140;
    const overToe = Math.max(kneeOverToe(frame, 'left'), kneeOverToe(frame, 'right'));
    const kneesEven = Math.abs(kneeLeft - kneeRight) < 20;
    const valid =
      feetDown &&
      kneeLeft >= 68 &&
      kneeLeft <= 112 &&
      kneeRight >= 68 &&
      kneeRight <= 112 &&
      kneesEven &&
      lean <= 32;

    const holdState = this.hold.update(context.dtMs, valid, 550);
    const kneeAverage = (kneeLeft + kneeRight) / 2;
    const formScore = liveScore([
      Math.abs(kneeAverage - 90) * 1.2,
      Math.max(0, lean - 15) * 1.2,
      Math.max(0, overToe - 0.35) * 80,
      feetDown ? 0 : 20,
    ]);
    this.bestScore = Math.max(this.bestScore, holdState.holding ? formScore : 0);

    const cues: TrackerResult['cues'] = [];
    if (!squatting) {
      cues.push(cue('slide-down', 'Slide down the wall until your thighs are parallel.', 'info'));
    } else if (kneeAverage > 112) {
      cues.push(cue('lower-hips', 'Lower your hips a little more.', 'warning'));
    } else if (kneeAverage < 68) {
      cues.push(cue('come-up', 'Come up slightly — don’t over-bend your knees.', 'warning'));
    }
    if (squatting && lean > 32) {
      cues.push(cue('back-wall', 'Keep your back supported against the wall.', 'error'));
    } else if (squatting && lean > 22) {
      cues.push(cue('chest-up-wall', 'Chest up and shoulders back.', 'warning'));
    }
    if (squatting && overToe > 0.4) {
      cues.push(cue('knees-over-ankles', 'Keep your knees stacked over your ankles.', 'warning'));
    }
    if (squatting && !kneesEven) {
      cues.push(cue('even-knees', 'Keep both knees at the same height.', 'warning'));
    }
    if (!feetDown && squatting) {
      cues.push(cue('feet-flat', 'Keep your feet flat on the floor.', 'warning'));
    }
    if (holdState.holding && this.hold.seconds >= 3) {
      cues.push(cue('strong-hold', 'Strong hold — breathe steadily.', 'success'));
    }
    if (holdState.broke && this.hold.seconds > 1) {
      cues.push(cue('hold-broke', 'Resume the hold — thighs parallel.', 'warning'));
    }

    return {
      ready: true,
      reps: 0,
      stateLabel: valid
        ? 'Holding strong'
        : squatting
          ? 'Adjust your wall sit'
          : 'Find the wall position',
      formScore,
      progress: clamp(this.hold.seconds / 30, 0, 1),
      cues,
      holdSeconds: this.hold.seconds,
      side: null,
      metrics: {
        kneeLeft,
        kneeRight,
        lean,
        overToe,
        feetDown: feetDown ? 1 : 0,
        holding: valid ? 1 : 0,
        holdSeconds: this.hold.seconds,
        bestScore: this.bestScore,
      },
      chips: [
        { label: `Hold ${this.hold.seconds.toFixed(1)}s`, tone: valid ? 'good' : 'neutral' },
        buildChip('Knee angle', clamp(100 - Math.abs(kneeAverage - 90) * 2.2, 0, 100), 80, 55),
        buildChip('Back', clamp(100 - Math.max(0, lean - 10) * 3.5, 0, 100), 80, 55),
      ],
    };
  }
}
