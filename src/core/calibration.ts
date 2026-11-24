import {
  angleAt,
  clamp,
  mean,
  median,
  midpoint,
  range,
} from './geometry';
import { torsoLean } from './pose';
import {
  FULL_BODY_LANDMARKS,
  LM,
  type PoseBaseline,
  type PoseFrame,
} from './types';

export interface CalibrationChecks {
  bodyVisible: boolean;
  distance: boolean;
  lighting: boolean;
  stable: boolean;
  posture: boolean;
}

export type CalibrationPhase = 'idle' | 'searching' | 'holding' | 'complete';

export interface CalibrationSnapshot {
  phase: CalibrationPhase;
  checks: CalibrationChecks;
  progress: number;
  holdMs: number;
  message: string;
  hints: string[];
  baseline: PoseBaseline | null;
  confidence: number;
}

export interface PoseCalibrationOptions {
  holdMs?: number;
  minVisibility?: number;
  stabilityWindowMs?: number;
}

interface Sample {
  hipAnkle: number;
  thighVertical: number;
  shoulderWidth: number;
  ankleWidth: number;
  torsoLean: number;
  groundY: number;
  headY: number;
}

const DEFAULT_HOLD_MS = 2400;
const DEFAULT_MIN_VISIBILITY = 0.5;
const STABILITY_WINDOW_MS = 800;

const EMPTY_CHECKS: CalibrationChecks = {
  bodyVisible: false,
  distance: false,
  lighting: false,
  stable: false,
  posture: false,
};

/**
 * Guides the user into a reliable, neutral standing pose and captures the
 * per-user baseline used by every exercise tracker.
 *
 * Rep counting never starts until this completes: that is the guard against
 * counting garbage from a user who is half out of frame or badly lit.
 */
export class PoseCalibration {
  private readonly holdMs: number;
  private readonly minVisibility: number;
  private readonly stabilityWindowMs: number;
  private active = false;
  private holdStartedAt: number | null = null;
  private holdAccumulated = 0;
  private lastNow = 0;
  private baseline: PoseBaseline | null = null;
  private samples: Sample[] = [];
  private history: { at: number; y: number }[] = [];
  private lastChecks: CalibrationChecks = { ...EMPTY_CHECKS };
  private lastConfidence = 0;
  private lastMessage = 'Camera ready. Stand back so your whole body is in frame.';
  private lastHints: string[] = [];

  constructor(options: PoseCalibrationOptions = {}) {
    this.holdMs = options.holdMs ?? DEFAULT_HOLD_MS;
    this.minVisibility = options.minVisibility ?? DEFAULT_MIN_VISIBILITY;
    this.stabilityWindowMs = options.stabilityWindowMs ?? STABILITY_WINDOW_MS;
  }

  start(now = 0): void {
    this.active = true;
    this.holdStartedAt = null;
    this.holdAccumulated = 0;
    this.lastNow = now;
    this.baseline = null;
    this.samples = [];
    this.history = [];
  }

  reset(): void {
    this.active = false;
    this.holdStartedAt = null;
    this.holdAccumulated = 0;
    this.lastNow = 0;
    this.baseline = null;
    this.samples = [];
    this.history = [];
    this.lastChecks = { ...EMPTY_CHECKS };
    this.lastConfidence = 0;
    this.lastMessage = 'Camera ready. Stand back so your whole body is in frame.';
    this.lastHints = [];
  }

  get result(): PoseBaseline | null {
    return this.baseline;
  }

  update(frame: PoseFrame | null, now: number): CalibrationSnapshot {
    const dt = this.lastNow > 0 ? clamp(now - this.lastNow, 0, 250) : 0;
    this.lastNow = Math.max(this.lastNow, now);

    if (this.baseline) {
      return {
        phase: 'complete',
        checks: this.lastChecks,
        progress: 1,
        holdMs: this.holdMs,
        message: 'Calibrated — ready to train.',
        hints: [],
        baseline: this.baseline,
        confidence: this.lastConfidence,
      };
    }

    if (!this.active) {
      return {
        phase: 'idle',
        checks: { ...EMPTY_CHECKS },
        progress: 0,
        holdMs: this.holdMs,
        message: this.lastMessage,
        hints: this.lastHints,
        baseline: null,
        confidence: 0,
      };
    }

    const checks = frame ? this.checkFrame(frame, now, dt) : { ...EMPTY_CHECKS };
    this.lastChecks = checks;

    const allPassed = Object.values(checks).every(Boolean);
    if (!frame) {
      this.holdAccumulated = 0;
      this.holdStartedAt = null;
      this.samples = [];
      this.lastMessage = 'Step into the camera view so I can see you.';
      this.lastHints = ['Stand about 2–3 m from the camera, with your whole body in view.'];
      this.lastConfidence = 0;
    } else if (!checks.bodyVisible) {
      this.holdAccumulated = 0;
      this.holdStartedAt = null;
      this.samples = [];
      this.lastMessage = 'Show your whole body in the frame.';
      this.lastHints = [
        'Step back until your head and feet are both visible.',
        'Keep the laptop on a stable surface at roughly chest height.',
      ];
      this.lastConfidence = frame.quality;
    } else if (!checks.lighting) {
      this.holdAccumulated = 0;
      this.holdStartedAt = null;
      this.samples = [];
      this.lastMessage = 'I need a clearer view of your body.';
      this.lastHints = ['Add more light in front of you and avoid strong backlight.', 'Close other apps using the camera.'];
      this.lastConfidence = frame.quality;
    } else if (!checks.posture) {
      this.holdAccumulated = 0;
      this.holdStartedAt = null;
      this.samples = [];
      this.lastMessage = 'Stand tall and relaxed to set your baseline.';
      this.lastHints = ['Feet about hip-width apart, knees soft, arms by your sides.'];
      this.lastConfidence = frame.quality;
    } else if (!checks.distance) {
      this.holdAccumulated = 0;
      this.holdStartedAt = null;
      this.samples = [];
      this.lastMessage = 'Move a little closer — I need to see your body clearly.';
      this.lastHints = ['Aim to fill about two thirds of the frame from head to feet.'];
      this.lastConfidence = frame.quality;
    } else if (!checks.stable) {
      this.holdAccumulated = 0;
      this.holdStartedAt = null;
      this.samples = [];
      this.lastMessage = 'Hold still for a moment…';
      this.lastHints = ['Stand naturally and let me capture your neutral pose.'];
      this.lastConfidence = frame.quality;
    } else {
      if (this.holdStartedAt === null) this.holdStartedAt = now;
      this.holdAccumulated += dt;
      this.samples.push(this.sample(frame));
      this.lastMessage =
        this.holdAccumulated >= this.holdMs * 0.6 ? 'Almost there — keep holding still.' : 'Capturing your neutral position…';
      this.lastHints = ['Breathe normally. Counting starts after calibration.'];
      this.lastConfidence = frame.quality;
    }

    const progress = allPassed ? clamp(this.holdAccumulated / this.holdMs, 0, 1) : 0;

    if (allPassed && this.holdAccumulated >= this.holdMs && this.samples.length >= 10) {
      this.baseline = this.computeBaseline(this.samples, now);
      return {
        phase: 'complete',
        checks,
        progress: 1,
        holdMs: this.holdMs,
        message: 'Calibrated — ready to train.',
        hints: [],
        baseline: this.baseline,
        confidence: clamp(this.lastConfidence + 0.1, 0, 1),
      };
    }

    return {
      phase: this.holdAccumulated > 0 ? 'holding' : 'searching',
      checks,
      progress,
      holdMs: this.holdMs,
      message: this.lastMessage,
      hints: this.lastHints,
      baseline: null,
      confidence: clamp(this.lastConfidence, 0, 1),
    };
  }

  private checkFrame(frame: PoseFrame, now: number, dt: number): CalibrationChecks {
    const landmarks = frame.imageLandmarks;
    const inFrame = FULL_BODY_LANDMARKS.every((index) => {
      const landmark = landmarks[index];
      return (
        landmark.x > 0.015 &&
        landmark.x < 0.985 &&
        landmark.y > 0.015 &&
        landmark.y < 0.985
      );
    });
    const visible = FULL_BODY_LANDMARKS.every(
      (index) => (landmarks[index].visibility ?? 1) >= this.minVisibility,
    );
    const bodyVisible = inFrame && visible;

    const nose = landmarks[LM.nose];
    const ankleY = (landmarks[LM.leftAnkle].y + landmarks[LM.rightAnkle].y) / 2;
    const bodySpan = ankleY - nose.y;
    const distance = bodySpan >= 0.3 && bodySpan <= 0.98;

    const confidence = mean(
      FULL_BODY_LANDMARKS.map((index) => landmarks[index].visibility ?? 1),
    );
    const lighting = confidence >= 0.62;

    const kneeLeft = angleAt(
      landmarks[LM.leftHip],
      landmarks[LM.leftKnee],
      landmarks[LM.leftAnkle],
    );
    const kneeRight = angleAt(
      landmarks[LM.rightHip],
      landmarks[LM.rightKnee],
      landmarks[LM.rightAnkle],
    );
    const ankleWidth = Math.hypot(
      landmarks[LM.leftAnkle].x - landmarks[LM.rightAnkle].x,
      landmarks[LM.leftAnkle].y - landmarks[LM.rightAnkle].y,
    );
    const shoulderWidth = Math.hypot(
      landmarks[LM.leftShoulder].x - landmarks[LM.rightShoulder].x,
      landmarks[LM.leftShoulder].y - landmarks[LM.rightShoulder].y,
    );
    const upright = frame.reliable && torsoLean(frame) <= 22;
    const posture =
      upright &&
      kneeLeft > 150 &&
      kneeRight > 150 &&
      shoulderWidth > 1e-4 &&
      ankleWidth < shoulderWidth * 1.8;

    const hipY = midpoint(landmarks[LM.leftHip], landmarks[LM.rightHip]).y;
    const rawAnkleY = ankleY;
    if (dt > 0) {
      this.history.push({ at: now, y: hipY });
      const cutoff = now - this.stabilityWindowMs;
      while (this.history.length > 0 && this.history[0].at < cutoff) this.history.shift();
    }
    const recentAnkles = this.history.length;
    const hipRange = range(this.history.map((entry) => entry.y));
    const stable = frame.reliable && recentAnkles >= 8 && hipRange < 0.02 && rawAnkleY > 0;

    return { bodyVisible, distance, lighting, stable, posture };
  }

  private sample(frame: PoseFrame): Sample {
    const landmarks = frame.imageLandmarks;
    const rawHip = midpoint(landmarks[LM.leftHip], landmarks[LM.rightHip]);
    const rawAnkle = midpoint(landmarks[LM.leftAnkle], landmarks[LM.rightAnkle]);
    const rawKnee = midpoint(landmarks[LM.leftKnee], landmarks[LM.rightKnee]);
    const scale = Math.max(frame.torsoScale, 1e-6);
    return {
      hipAnkle: (rawAnkle.y - rawHip.y) / scale,
      thighVertical: (rawKnee.y - rawHip.y) / scale,
      shoulderWidth: Math.hypot(
        landmarks[LM.leftShoulder].x - landmarks[LM.rightShoulder].x,
        landmarks[LM.leftShoulder].y - landmarks[LM.rightShoulder].y,
      ) / frame.torsoScale,
      ankleWidth: Math.hypot(
        landmarks[LM.leftAnkle].x - landmarks[LM.rightAnkle].x,
        landmarks[LM.leftAnkle].y - landmarks[LM.rightAnkle].y,
      ) / frame.torsoScale,
      torsoLean: torsoLean(frame),
      groundY: rawAnkle.y,
      headY: landmarks[LM.nose].y,
    };
  }

  private computeBaseline(samples: Sample[], now: number): PoseBaseline {
    return {
      hipAnkle: median(samples.map((sample) => sample.hipAnkle)),
      thighVertical: median(samples.map((sample) => sample.thighVertical)),
      shoulderWidth: median(samples.map((sample) => sample.shoulderWidth)),
      ankleWidth: median(samples.map((sample) => sample.ankleWidth)),
      torsoLean: median(samples.map((sample) => sample.torsoLean)),
      groundY: median(samples.map((sample) => sample.groundY)),
      headY: median(samples.map((sample) => sample.headY)),
      capturedAt: now,
      samples: samples.length,
    };
  }
}
