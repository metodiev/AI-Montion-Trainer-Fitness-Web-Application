import {
  angleAt,
  angleFromVertical,
  clamp,
  distance,
  mean,
  midpoint,
} from './geometry';
import {
  CORE_LANDMARKS,
  LM,
  type Landmark,
  type PoseFrame,
  type Side,
  type Vec3,
} from './types';

const MIN_TORSO_SCALE = 1e-3;
const DEFAULT_VISIBILITY = 0.9;

/**
 * Converts raw MediaPipe landmarks into the normalised tracking space.
 * Returns null when the landmark list is unusable.
 */
export function createPoseFrame(
  landmarks: Landmark[] | null | undefined,
  aspect: number,
  timestampMs: number,
): PoseFrame | null {
  if (!landmarks || landmarks.length < 33) return null;
  const safeAspect = clamp(Number.isFinite(aspect) && aspect > 0 ? aspect : 1, 0.25, 5);

  const visibility = landmarks.map((landmark) => clamp(landmark.visibility ?? DEFAULT_VISIBILITY, 0, 1));
  const corrected = landmarks.map((landmark) => ({
    x: landmark.x * safeAspect,
    y: landmark.y,
    z: landmark.z * safeAspect,
  }));

  const shoulderMid = midpoint(corrected[LM.leftShoulder], corrected[LM.rightShoulder]);
  const hipMid = midpoint(corrected[LM.leftHip], corrected[LM.rightHip]);
  const torsoScale = distance(shoulderMid, hipMid);
  const coreVisibility = mean(CORE_LANDMARKS.map((index) => visibility[index]));
  const reliable = torsoScale > MIN_TORSO_SCALE && coreVisibility >= 0.35;

  const points = corrected.map((point) => ({
    x: (point.x - hipMid.x) / Math.max(torsoScale, MIN_TORSO_SCALE),
    y: (point.y - hipMid.y) / Math.max(torsoScale, MIN_TORSO_SCALE),
    z: (point.z - hipMid.z) / Math.max(torsoScale, MIN_TORSO_SCALE),
  }));

  return {
    points,
    visibility,
    imageLandmarks: landmarks,
    aspect: safeAspect,
    timestampMs,
    torsoScale,
    reliable,
    quality: reliable ? coreVisibility : coreVisibility * 0.25,
  };
}

export const point = (frame: PoseFrame, index: number): Vec3 => frame.points[index];
export const visibilityOf = (frame: PoseFrame, index: number): number =>
  frame.visibility[index] ?? 0;

export function minVisibility(frame: PoseFrame, indices: readonly number[]): number {
  let min = 1;
  for (const index of indices) min = Math.min(min, visibilityOf(frame, index));
  return min;
}

export function allVisible(
  frame: PoseFrame,
  indices: readonly number[],
  threshold = 0.4,
): boolean {
  return indices.every((index) => visibilityOf(frame, index) >= threshold);
}

export function jointAngle(
  frame: PoseFrame,
  a: number,
  b: number,
  c: number,
): number {
  return angleAt(frame.points[a], frame.points[b], frame.points[c]);
}

export const shoulderMid = (frame: PoseFrame): Vec3 =>
  midpoint(frame.points[LM.leftShoulder], frame.points[LM.rightShoulder]);

export const hipMid = (frame: PoseFrame): Vec3 =>
  midpoint(frame.points[LM.leftHip], frame.points[LM.rightHip]);

export const ankleMid = (frame: PoseFrame): Vec3 =>
  midpoint(frame.points[LM.leftAnkle], frame.points[LM.rightAnkle]);

export const kneeMid = (frame: PoseFrame): Vec3 =>
  midpoint(frame.points[LM.leftKnee], frame.points[LM.rightKnee]);

export const wristMid = (frame: PoseFrame): Vec3 =>
  midpoint(frame.points[LM.leftWrist], frame.points[LM.rightWrist]);

export const elbowMid = (frame: PoseFrame): Vec3 =>
  midpoint(frame.points[LM.leftElbow], frame.points[LM.rightElbow]);

/** Torso lean away from vertical in degrees (0 = perfect upright). */
export function torsoLean(frame: PoseFrame): number {
  const shoulder = shoulderMid(frame);
  const hip = hipMid(frame);
  return angleFromVertical({ x: shoulder.x - hip.x, y: shoulder.y - hip.y, z: shoulder.z - hip.z });
}

/** Signed lateral torso lean in degrees (positive = leaning to image-right). */
export function lateralTorsoLean(frame: PoseFrame): number {
  const shoulder = shoulderMid(frame);
  const hip = hipMid(frame);
  return (Math.atan2(shoulder.x - hip.x, Math.abs(shoulder.y - hip.y)) * 180) / Math.PI;
}

/** Angle at the hip formed by shoulder-hip-ankle. 180 = a straight body line. */
export function bodyLineAngle(frame: PoseFrame, side: Side = 'left'): number {
  const shoulder = side === 'left' ? LM.leftShoulder : LM.rightShoulder;
  const hip = side === 'left' ? LM.leftHip : LM.rightHip;
  const ankle = side === 'left' ? LM.leftAnkle : LM.rightAnkle;
  return jointAngle(frame, shoulder, hip, ankle);
}

/** Knee angle in degrees. 180 = fully extended, 90 = right angle. */
export function kneeAngle(frame: PoseFrame, side: Side): number {
  const hip = side === 'left' ? LM.leftHip : LM.rightHip;
  const knee = side === 'left' ? LM.leftKnee : LM.rightKnee;
  const ankle = side === 'left' ? LM.leftAnkle : LM.rightAnkle;
  return jointAngle(frame, hip, knee, ankle);
}

/** Elbow angle in degrees. 180 = fully extended, 90 = right angle. */
export function elbowAngle(frame: PoseFrame, side: Side): number {
  const shoulder = side === 'left' ? LM.leftShoulder : LM.rightShoulder;
  const elbow = side === 'left' ? LM.leftElbow : LM.rightElbow;
  const wrist = side === 'left' ? LM.leftWrist : LM.rightWrist;
  return jointAngle(frame, shoulder, elbow, wrist);
}

export function ankleDistance(frame: PoseFrame): number {
  return distance(frame.points[LM.leftAnkle], frame.points[LM.rightAnkle]);
}

export function shoulderDistance(frame: PoseFrame): number {
  return distance(frame.points[LM.leftShoulder], frame.points[LM.rightShoulder]);
}

/** Height of the wrists above the shoulders, in torso units (negative = below). */
export function wristAboveShoulder(frame: PoseFrame, side: Side): number {
  const shoulderIndex = side === 'left' ? LM.leftShoulder : LM.rightShoulder;
  const wristIndex = side === 'left' ? LM.leftWrist : LM.rightWrist;
  return frame.points[shoulderIndex].y - frame.points[wristIndex].y;
}

/** How far the knee is lifted relative to standing, 0..1+ (1 = at hip height). */
export function kneeLift(frame: PoseFrame, side: Side, baselineThigh: number): number {
  const hip = side === 'left' ? LM.leftHip : LM.rightHip;
  const knee = side === 'left' ? LM.leftKnee : LM.rightKnee;
  const vertical = frame.points[knee].y - frame.points[hip].y;
  return 1 - vertical / Math.max(baselineThigh, 0.2);
}

/**
 * Hip height relative to standing, normalised to 1 at neutral and 0 at a very
 * deep squat. This is the most reliable squat signal for a front-facing camera
 * where the 2D knee angle barely changes.
 */
export function squatDepth(frame: PoseFrame, baselineHipAnkle: number): number {
  const hip = hipMid(frame);
  const ankles = ankleMid(frame);
  const hipAnkle = ankles.y - hip.y;
  return clamp(1 - hipAnkle / Math.max(baselineHipAnkle, 0.5), 0, 1.25);
}

/** Raw-image ankle height; used only for jump detection (camera is fixed). */
export function rawAnkleY(frame: PoseFrame): number {
  return (frame.imageLandmarks[LM.leftAnkle].y + frame.imageLandmarks[LM.rightAnkle].y) / 2;
}

export function rawNoseY(frame: PoseFrame): number {
  return frame.imageLandmarks[LM.nose].y;
}

/** Picks the side with the more reliable landmark visibility. */
export function bestSide(frame: PoseFrame): Side {
  const leftVis = minVisibility(frame, [LM.leftShoulder, LM.leftHip, LM.leftAnkle]);
  const rightVis = minVisibility(frame, [LM.rightShoulder, LM.rightHip, LM.rightAnkle]);
  return rightVis > leftVis ? 'right' : 'left';
}

/** High-value knee flexion (0 = straight, 90 = right angle). */
export function kneeFlexion(frame: PoseFrame, side: Side): number {
  return 180 - kneeAngle(frame, side);
}

export function elbowFlexion(frame: PoseFrame, side: Side): number {
  return 180 - elbowAngle(frame, side);
}

/** Mean visibility of all core joints. */
export function coreVisibility(frame: PoseFrame): number {
  return mean(CORE_LANDMARKS.map((index) => visibilityOf(frame, index)));
}
