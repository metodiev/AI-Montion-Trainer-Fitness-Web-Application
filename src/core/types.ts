/**
 * Stable MediaPipe Pose landmark indices used across the app.
 * https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export const LM = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export type Side = 'left' | 'right';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Landmark extends Vec3 {
  visibility?: number;
  presence?: number;
}

/**
 * A pose prepared for tracking.
 *
 * `points` are aspect-corrected, hip-centred and scaled so the torso length
 * (mid-shoulder -> mid-hip) equals 1. This makes every measurement independent
 * of camera distance and body size, which is what allows the same thresholds
 * to work for different people and setups.
 */
export interface PoseFrame {
  points: Vec3[];
  visibility: number[];
  imageLandmarks: Landmark[];
  aspect: number;
  timestampMs: number;
  /** Torso length in the raw (aspect-corrected) image space. */
  torsoScale: number;
  /** False when the torso is too small or core landmarks are unreliable. */
  reliable: boolean;
  quality: number;
}

/** Measurement reference captured while the user stands neutrally. */
export interface PoseBaseline {
  /** Vertical hip-to-ankle distance, in torso units. */
  hipAnkle: number;
  /** Vertical hip-to-knee distance, in torso units. */
  thighVertical: number;
  shoulderWidth: number;
  ankleWidth: number;
  /** Torso lean from vertical in degrees (usually a few degrees). */
  torsoLean: number;
  /** Median raw-image y of the ankles while standing (0 = top of frame). */
  groundY: number;
  /** Median raw-image y of the nose while standing. */
  headY: number;
  capturedAt: number;
  samples: number;
}

export const CORE_LANDMARKS = [
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
] as const;

export const FULL_BODY_LANDMARKS = [
  LM.nose,
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
] as const;

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type FocusArea = 'full-body' | 'upper-body' | 'lower-body' | 'core' | 'mobility';
export type MetricType = 'reps' | 'time';
export type WorkoutMode =
  | 'free'
  | 'daily'
  | 'adventure'
  | 'endurance'
  | 'precision'
  | 'planned';
