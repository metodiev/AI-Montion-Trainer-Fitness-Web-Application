import { angleAt, offsetFromLine } from '@/core/geometry';
import { ankleMid, hipMid, shoulderDistance, shoulderMid, wristMid } from '@/core/pose';
import { LM, type PoseFrame } from '@/core/types';

/** Angle at the hip using the side with the best landmark confidence. */
export function bodyLineAngleSafe(frame: PoseFrame): number {
  const left = angleAt(
    frame.points[LM.leftShoulder],
    frame.points[LM.leftHip],
    frame.points[LM.leftAnkle],
  );
  const right = angleAt(
    frame.points[LM.rightShoulder],
    frame.points[LM.rightHip],
    frame.points[LM.rightAnkle],
  );
  const leftVis =
    (frame.visibility[LM.leftShoulder] ?? 0) +
    (frame.visibility[LM.leftHip] ?? 0) +
    (frame.visibility[LM.leftAnkle] ?? 0);
  const rightVis =
    (frame.visibility[LM.rightShoulder] ?? 0) +
    (frame.visibility[LM.rightHip] ?? 0) +
    (frame.visibility[LM.rightAnkle] ?? 0);
  return rightVis > leftVis ? right : left;
}

export function shoulderWidthSafe(frame: PoseFrame): number {
  return Math.max(shoulderDistance(frame), 0.2);
}

export function horizontalPosture(frame: PoseFrame): {
  horizontal: boolean;
  bodyLine: number;
  hipOffset: number;
  shoulderAnkleDy: number;
  handsBelowShoulders: boolean;
} {
  const shoulder = shoulderMid(frame);
  const ankle = ankleMid(frame);
  const hip = hipMid(frame);
  const shoulderAnkleDy = Math.abs(ankle.y - shoulder.y);
  const handsBelowShoulders = wristMid(frame).y > shoulder.y + 0.25;
  const hipOffset = offsetFromLine(shoulder, ankle, hip);
  return {
    horizontal: shoulderAnkleDy < 0.95 && handsBelowShoulders,
    bodyLine: bodyLineAngleSafe(frame),
    hipOffset,
    shoulderAnkleDy,
    handsBelowShoulders,
  };
}

function angle2D(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag < 1e-6) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / mag))) * 180) / Math.PI;
}

/**
 * Elbow angles in the image plane. For a side-on push-up the sagittal bend is
 * what matters; including MediaPipe's z would read lateral hand spacing as an
 * elbow bend and hide a full-range rep.
 */
export function elbowAngles(frame: PoseFrame): {
  left: number;
  right: number;
  min: number;
  max: number;
} {
  const left = angle2D(
    frame.points[LM.leftShoulder],
    frame.points[LM.leftElbow],
    frame.points[LM.leftWrist],
  );
  const right = angle2D(
    frame.points[LM.rightShoulder],
    frame.points[LM.rightElbow],
    frame.points[LM.rightWrist],
  );
  return { left, right, min: Math.min(left, right), max: Math.max(left, right) };
}

