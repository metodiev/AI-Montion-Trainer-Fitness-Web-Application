import { clamp, distance, hipAnkleHeight, midpoint } from '@/core/geometry';
import {
  ankleDistance,
  hipMid,
  kneeAngle,
  rawAnkleY,
  shoulderDistance,
  shoulderMid,
  torsoLean,
  allVisible,
} from '@/core/pose';
import {
  LM,
  type PoseBaseline,
  type PoseFrame,
  type Side,
  type Vec3,
} from '@/core/types';

export const SQUAT_LANDMARKS = [
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
] as const;

export const ARM_LANDMARKS = [
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
] as const;

export const BODY_LANDMARKS = [...SQUAT_LANDMARKS, ...ARM_LANDMARKS] as const;

export function hasLandmarks(frame: PoseFrame, indices: readonly number[], threshold = 0.4): boolean {
  return frame.reliable && allVisible(frame, indices, threshold);
}

export function perSideKneeAngles(frame: PoseFrame): { left: number; right: number; min: number; max: number; active: Side } {
  const left = kneeAngle(frame, 'left');
  const right = kneeAngle(frame, 'right');
  return {
    left,
    right,
    min: Math.min(left, right),
    max: Math.max(left, right),
    active: left <= right ? 'left' : 'right',
  };
}

/** Positive when the ankle is lifted off the calibration ground line. */
export function ankleLift(frame: PoseFrame, side: Side, baseline: PoseBaseline): number {
  const index = side === 'left' ? LM.leftAnkle : LM.rightAnkle;
  return baseline.groundY - frame.imageLandmarks[index].y;
}

export function bothFeetAirborne(frame: PoseFrame, baseline: PoseBaseline): boolean {
  return (
    ankleLift(frame, 'left', baseline) > 0.012 &&
    ankleLift(frame, 'right', baseline) > 0.012
  );
}

export function jumpHeight(frame: PoseFrame, baseline: PoseBaseline): number {
  return baseline.groundY - rawAnkleY(frame);
}

/** Knee deviation toward the body midline, in torso units (> 0 = valgus). */
export function kneeValgus(frame: PoseFrame, side: Side): number {
  // Knee-in tracking is only measurable when the user faces the camera. In a
  // side view the knees move along the camera axis and the signal is noise.
  if (shoulderDistance(frame) < 0.5) return 0;
  const hipIndex = side === 'left' ? LM.leftHip : LM.rightHip;
  const kneeIndex = side === 'left' ? LM.leftKnee : LM.rightKnee;
  const ankleIndex = side === 'left' ? LM.leftAnkle : LM.rightAnkle;
  const hip = frame.points[hipIndex];
  const knee = frame.points[kneeIndex];
  const ankle = frame.points[ankleIndex];
  const hipCenterX = (frame.points[LM.leftHip].x + frame.points[LM.rightHip].x) / 2;
  const t = clamp((knee.y - hip.y) / Math.max(1e-5, ankle.y - hip.y), 0, 1);
  const expectedX = hip.x + (ankle.x - hip.x) * t;
  const inwardDir = Math.sign(hipCenterX - hip.x) || 1;
  return (knee.x - expectedX) * inwardDir;
}

/** Knee travel past the toe, in torso units. Positive = knee ahead of ankle. */
export function kneeOverToe(frame: PoseFrame, side: Side): number {
  const nose = frame.imageLandmarks[LM.nose];
  const rawHipX =
    (frame.imageLandmarks[LM.leftHip].x + frame.imageLandmarks[LM.rightHip].x) / 2;
  const forward = Math.sign(nose.x - rawHipX) || 1;
  const kneeIndex = side === 'left' ? LM.leftKnee : LM.rightKnee;
  const ankleIndex = side === 'left' ? LM.leftAnkle : LM.rightAnkle;
  return (frame.points[kneeIndex].x - frame.points[ankleIndex].x) * forward;
}

export function stanceWidth(frame: PoseFrame): number {
  return ankleDistance(frame) / Math.max(shoulderDistance(frame), 0.15);
}

export function torsoUprightScore(lean: number): number {
  return clamp(100 - Math.max(0, lean - 8) * 3.2, 0, 100);
}

export function centerOfMass(frame: PoseFrame): Vec3 {
  return midpoint(shoulderMid(frame), hipMid(frame));
}

export function hipVerticalRange(history: Vec3[]): number {
  if (history.length === 0) return 0;
  const ys = history.map((point) => point.y);
  return Math.max(...ys) - Math.min(...ys);
}

export function verticalDistance(a: Vec3, b: Vec3): number {
  return Math.abs(a.y - b.y);
}

export function hipToAnkle(frame: PoseFrame): number {
  return hipAnkleHeight(
    [frame.points[LM.leftHip], frame.points[LM.rightHip]],
    [frame.points[LM.leftAnkle], frame.points[LM.rightAnkle]],
  );
}

export function hipToKnee(frame: PoseFrame, side: Side): number {
  const hipIndex = side === 'left' ? LM.leftHip : LM.rightHip;
  const kneeIndex = side === 'left' ? LM.leftKnee : LM.rightKnee;
  return frame.points[kneeIndex].y - frame.points[hipIndex].y;
}

export function torsoLeanTone(lean: number): 'good' | 'warn' | 'bad' {
  return lean <= 15 ? 'good' : lean <= 30 ? 'warn' : 'bad';
}

export function feetDistanceRatio(frame: PoseFrame): number {
  return distance(frame.points[LM.leftAnkle], frame.points[LM.rightAnkle]) /
    Math.max(distance(frame.points[LM.leftShoulder], frame.points[LM.rightShoulder]), 0.15);
}

export { torsoLean };

/** Direction the torso is facing along the image x-axis (+1 = image-right). */
export function forwardDirection(frame: PoseFrame): number {
  const nose = frame.imageLandmarks[LM.nose];
  const rawHipX =
    (frame.imageLandmarks[LM.leftHip].x + frame.imageLandmarks[LM.rightHip].x) / 2;
  const fromNose = Math.sign(nose.x - rawHipX);
  if (fromNose !== 0) return fromNose;
  const shoulder = shoulderMid(frame);
  const hip = hipMid(frame);
  return Math.sign(shoulder.x - hip.x) || 1;
}

/** Knee drive toward the chest, in torso units (positive = toward the head). */
export function kneeDrive(frame: PoseFrame, side: Side): number {
  const kneeIndex = side === 'left' ? LM.leftKnee : LM.rightKnee;
  const hip = hipMid(frame);
  return (frame.points[kneeIndex].x - hip.x) * forwardDirection(frame);
}

/** Lateral shoulder tilt normalised by the body unit. */
export function shoulderTilt(frame: PoseFrame): number {
  return Math.abs(frame.points[LM.leftShoulder].y - frame.points[LM.rightShoulder].y);
}

export function hipWidth(frame: PoseFrame): number {
  return distance(frame.points[LM.leftHip], frame.points[LM.rightHip]);
}

/** Signed torso shift toward the working leg, in torso units. */
export function torsoShiftTowardLeg(frame: PoseFrame, side: Side): number {
  const shoulder = shoulderMid(frame);
  const hip = hipMid(frame);
  const kneeX = frame.points[side === 'left' ? LM.leftKnee : LM.rightKnee].x;
  const direction = Math.sign(kneeX - hip.x) || 1;
  return (shoulder.x - hip.x) * direction;
}
