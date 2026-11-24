import { midpoint } from '@/core/geometry';
import { createPoseFrame, torsoLean } from '@/core/pose';
import {
  demoPoseToLandmarks,
  frontFigure,
  sideFigure,
  type DemoJoint,
  type DemoPose,
  type SideFigureOptions,
} from '@/core/skeleton';
import type { PoseBaseline, PoseFrame } from '@/core/types';
import type { ExerciseTracker, TrackerContext, TrackerResult } from '@/exercises/types';

const RAD = Math.PI / 180;

export const STANDING_ANKLE_Y = 0.965;
const THIGH = 0.215;
const SHIN = 0.2;

export function frameOf(
  pose: DemoPose,
  timestampMs = 0,
  visibility = 1,
  aspect = 1,
  zOverrides: Record<number, number> = {},
): PoseFrame {
  const landmarks = demoPoseToLandmarks(pose, visibility).map((landmark, index) =>
    index in zOverrides ? { ...landmark, z: zOverrides[index] } : landmark,
  );
  const frame = createPoseFrame(landmarks, aspect, timestampMs);
  if (!frame) throw new Error('Failed to create a test pose frame');
  return frame;
}

export function baselineFrom(pose: DemoPose): PoseBaseline {
  const frame = frameOf(pose);
  const landmarks = frame.imageLandmarks;
  const hip = midpoint(landmarks[23], landmarks[24]);
  const ankle = midpoint(landmarks[27], landmarks[28]);
  const knee = midpoint(landmarks[25], landmarks[26]);
  const scale = frame.torsoScale;
  return {
    hipAnkle: (ankle.y - hip.y) / scale,
    thighVertical: (knee.y - hip.y) / scale,
    shoulderWidth:
      Math.hypot(
        landmarks[11].x - landmarks[12].x,
        landmarks[11].y - landmarks[12].y,
      ) / scale,
    ankleWidth:
      Math.hypot(
        landmarks[27].x - landmarks[28].x,
        landmarks[27].y - landmarks[28].y,
      ) / scale,
    torsoLean: torsoLean(frame),
    groundY: ankle.y,
    headY: landmarks[0].y,
    capturedAt: 0,
    samples: 30,
  };
}

export function clonePose(pose: DemoPose): DemoPose {
  return {
    joints: Object.fromEntries(
      Object.entries(pose.joints).map(([key, point]) => [key, [...point] as [number, number]]),
    ) as Record<DemoJoint, [number, number]>,
  };
}

export function withJoint(pose: DemoPose, joint: DemoJoint, x: number, y: number): DemoPose {
  const clone = clonePose(pose);
  clone.joints[joint] = [x, y];
  return clone;
}

export function sideStanding(): DemoPose {
  return sideFigure({ rootY: 0.55 });
}

export function frontStanding(): DemoPose {
  return frontFigure({ rootY: 0.56 });
}

/** Squat pose with the feet pinned to the same ground line. */
export function squatPose(options: {
  hipFlex: number;
  kneeBend: number;
  lean?: number;
  armFlex?: number;
  armFlexL?: number;
  armFlexR?: number;
}): DemoPose {
  const ankleOffset =
    Math.cos(options.hipFlex * RAD) * THIGH +
    Math.cos((options.hipFlex - options.kneeBend) * RAD) * SHIN;
  const rootY = STANDING_ANKLE_Y - ankleOffset;
  return sideFigure({
    rootY,
    hipFlexL: options.hipFlex,
    hipFlexR: options.hipFlex,
    kneeBendL: options.kneeBend,
    kneeBendR: options.kneeBend,
    lean: options.lean,
    armFlexL: options.armFlexL ?? options.armFlex ?? 5,
    armFlexR: options.armFlexR ?? options.armFlex ?? 5,
  });
}

export function lungePose(options: {
  frontFlex: number;
  frontKnee: number;
  backFlex?: number;
  backKnee?: number;
  lean?: number;
  stride?: number;
}): DemoPose {
  const frontOffset =
    Math.cos(options.frontFlex * RAD) * THIGH +
    Math.cos((options.frontFlex - options.frontKnee) * RAD) * SHIN;
  const backFlex = options.backFlex ?? -15;
  const backKnee = options.backKnee ?? 30;
  const backOffset =
    Math.cos(backFlex * RAD) * THIGH + Math.cos((backFlex - backKnee) * RAD) * SHIN;
  const rootY = STANDING_ANKLE_Y - Math.max(frontOffset, backOffset);
  return sideFigure({
    rootY,
    hipFlexL: options.frontFlex,
    hipFlexR: backFlex,
    kneeBendL: options.frontKnee,
    kneeBendR: backKnee,
    lean: options.lean ?? 5,
    stride: options.stride ?? 0.1,
    armFlexL: 20,
    armFlexR: 20,
  });
}

/** Raises one knee sideways so the 2D projection shows a bent knee. */
export function withRaisedKnee(pose: DemoPose, side: 'left' | 'right', lift = 0.02): DemoPose {
  const clone = clonePose(pose);
  const hip = clone.joints[side === 'left' ? 'hipL' : 'hipR'];
  const direction = side === 'left' ? -1 : 1;
  clone.joints[side === 'left' ? 'kneeL' : 'kneeR'] = [hip[0] + direction * 0.1, hip[1] - lift];
  clone.joints[side === 'left' ? 'ankleL' : 'ankleR'] = [
    hip[0] + direction * 0.1,
    hip[1] + 0.17,
  ];
  clone.joints[side === 'left' ? 'footL' : 'footR'] = [
    hip[0] + direction * 0.15,
    hip[1] + 0.18,
  ];
  return clone;
}

export function armsOverhead(): DemoPose {
  return frontFigure({ rootY: 0.56, armAbductL: 172, armAbductR: 172, legSpreadL: 7, legSpreadR: 7 });
}

export function jackOpen(): DemoPose {
  return frontFigure({
    rootY: 0.56,
    armAbductL: 172,
    armAbductR: 172,
    legSpreadL: 30,
    legSpreadR: 30,
  });
}

export function jackHalfOpen(): DemoPose {
  return frontFigure({
    rootY: 0.56,
    armAbductL: 172,
    armAbductR: 172,
    legSpreadL: 7,
    legSpreadR: 7,
  });
}

export function makeSidePose(options: SideFigureOptions): DemoPose {
  return sideFigure(options);
}

/** Push-up pose with a controllable elbow angle and optional hip sag. */
export function pushUpPose(options: {
  elbow: 'top' | 'bottom' | 'mid';
  hipSag?: number;
  handsOffset?: number;
} = { elbow: 'top' }): DemoPose {
  const base = frontStanding();
  const joints = clonePose(base).joints;
  const shoulderY = 0.58;
  const hipY = 0.6 + (options.hipSag ?? 0);
  const ankleY = 0.63;
  const shoulderX = 0.66;
  const hipX = 0.42;
  const ankleX = 0.18;
  const elbow = options.elbow;
  const handsOffset = options.handsOffset ?? 0;

  joints.head = [0.775, shoulderY - 0.01];
  joints.neck = [0.705, shoulderY];
  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? -1 : 1;
    joints[`shoulder${side}` as 'shoulderL'] = [shoulderX, shoulderY + sign * 0.012];
    joints[`hip${side}` as 'hipL'] = [hipX, hipY + sign * 0.012];
    joints[`knee${side}` as 'kneeL'] = [hipX - 0.14, hipY + 0.015];
    joints[`ankle${side}` as 'ankleL'] = [ankleX, ankleY + sign * 0.004];
    joints[`foot${side}` as 'footL'] = [ankleX - 0.06, ankleY + 0.008];
    if (elbow === 'bottom') {
      joints[`elbow${side}` as 'elbowL'] = [shoulderX - 0.12 + handsOffset, shoulderY + 0.1];
    } else if (elbow === 'mid') {
      joints[`elbow${side}` as 'elbowL'] = [shoulderX - 0.05 + handsOffset, shoulderY + 0.12];
    } else {
      joints[`elbow${side}` as 'elbowL'] = [shoulderX + handsOffset, shoulderY + 0.14];
    }
    joints[`wrist${side}` as 'wristL'] = [shoulderX + 0.02 + handsOffset, 0.865];
  }
  return { joints };
}

/** A wide, lowered stance for side-lunge tracking. */
export function sideLungePose(options: { low?: boolean; valgus?: boolean } = {}): DemoPose {
  const pose = frontFigure({ rootY: options.low === false ? 0.6 : 0.68 });
  const joints = pose.joints;
  joints.hipL = [0.425, options.low === false ? 0.606 : 0.686];
  joints.hipR = [0.575, options.low === false ? 0.606 : 0.686];
  joints.kneeL = [options.valgus ? 0.44 : 0.3, options.low === false ? 0.72 : 0.79];
  joints.ankleL = [0.27, 0.955];
  joints.footL = [0.21, 0.96];
  joints.kneeR = [0.575, options.low === false ? 0.72 : 0.8];
  joints.ankleR = [0.62, 0.965];
  joints.footR = [0.68, 0.97];
  return pose;
}

/** A shoulder-width twist used by the torso-twist tracker tests. */
export function twistedPose(ratio = 0.4): DemoPose {
  const pose = frontStanding();
  const center = 0.5;
  const half = (0.21 * ratio) / 2;
  pose.joints.shoulderL = [center - half, pose.joints.shoulderL[1]];
  pose.joints.shoulderR = [center + half, pose.joints.shoulderR[1]];
  return pose;
}

export function jumpPose(lift = 0.06): DemoPose {
  return sideFigure({ rootY: 0.55, lift, armFlexL: 160, armFlexR: 160 });
}

export function wallSitPose(options: { hipFlex?: number; kneeBend?: number; lean?: number } = {}): DemoPose {
  return squatPose({
    hipFlex: options.hipFlex ?? 75,
    kneeBend: options.kneeBend ?? 85,
    lean: options.lean ?? 0,
    armFlex: 5,
  });
}

export interface PoseStep {
  pose: DemoPose;
  ms: number;
  visibility?: number;
  zOverrides?: Record<number, number>;
}

export interface DriveOptions {
  startNow?: number;
  stepMs?: number;
  baseline: PoseBaseline;
  visibility?: number;
}

export interface DriveRun {
  results: TrackerResult[];
  lastResult: TrackerResult;
  endNow: number;
}

/**
 * Feeds a timed sequence of synthetic poses through a real tracker, at a
 * realistic 30 fps, so tracking logic is tested end-to-end rather than mocked.
 */
export function drive(
  tracker: ExerciseTracker,
  steps: PoseStep[],
  options: DriveOptions,
): DriveRun {
  let now = options.startNow ?? 1000;
  let previous = now;
  const stepMs = options.stepMs ?? 33;
  const results: TrackerResult[] = [];

  for (const step of steps) {
    const frames = Math.max(1, Math.round(step.ms / stepMs));
    for (let i = 0; i < frames; i += 1) {
      now += step.ms / frames;
      const visibility = step.visibility ?? options.visibility ?? 1;
      const frame = frameOf(step.pose, now, visibility, 1, step.zOverrides);
      const context: TrackerContext = { baseline: options.baseline, now, dtMs: now - previous };
      results.push(tracker.update(frame, context));
      previous = now;
    }
  }

  return {
    results,
    lastResult: results[results.length - 1],
    endNow: now,
  };
}

export function currentReps(results: TrackerResult[]): number {
  return results[results.length - 1]?.reps ?? 0;
}

export function findRepEvent(results: TrackerResult[]) {
  return results.map((result) => result.repEvent).filter((event) => event !== undefined);
}
