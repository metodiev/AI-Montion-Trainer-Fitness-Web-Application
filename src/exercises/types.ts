import type { DemoSpec } from '@/core/skeleton';
import type {
  Difficulty,
  FocusArea,
  MetricType,
  PoseBaseline,
  PoseFrame,
  Side,
} from '@/core/types';

export type CueSeverity = 'error' | 'warning' | 'success' | 'info';

export interface CoachingCue {
  code: string;
  message: string;
  severity: CueSeverity;
}

export type ChipTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface TrackerChip {
  label: string;
  tone: ChipTone;
}

export interface RepEvent {
  /** 1-based repetition number. */
  index: number;
  side: Side | null;
  /** 0..100 technique score for this repetition. */
  score: number;
  clean: boolean;
  durationMs: number;
  issues: string[];
  at: number;
}

export interface TrackerContext {
  baseline: PoseBaseline;
  now: number;
  dtMs: number;
}

export interface TrackerResult {
  /** False while the required joints are not reliably visible. */
  ready: boolean;
  reps: number;
  repEvent?: RepEvent;
  stateLabel: string;
  formScore: number;
  progress: number;
  cues: CoachingCue[];
  holdSeconds: number;
  side: Side | null;
  metrics: Record<string, number>;
  chips: TrackerChip[];
}

export interface ExerciseTracker {
  reset(): void;
  update(frame: PoseFrame, context: TrackerContext): TrackerResult;
}

export type ExerciseId =
  | 'squat'
  | 'knee-raise'
  | 'arm-raise'
  | 'jumping-jack'
  | 'wall-sit'
  | 'torso-twist'
  | 'lunge'
  | 'push-up'
  | 'wide-push-up'
  | 'diamond-push-up'
  | 'plank'
  | 'high-knees'
  | 'mountain-climbers'
  | 'burpee'
  | 'jump-squat'
  | 'side-lunge'
  | 'single-leg-balance'
  | 'plank-shoulder-tap';

export type CameraView = 'front' | 'side' | 'angled';

export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  difficulty: Difficulty;
  focus: FocusArea[];
  metric: MetricType;
  targetReps: number;
  targetSeconds: number;
  lowImpact: boolean;
  caloriesPerMinute: number;
  cameraView: CameraView;
  cameraHint: string;
  summary: string;
  instructions: string[];
  posture: string[];
  mistakes: string[];
  safety: string[];
  /** MediaPipe landmark indices that must be visible for tracking. */
  requiredLandmarks: number[];
  trackingNotes: string;
  demo: DemoSpec;
  createTracker: () => ExerciseTracker;
}

export const CLEAN_REP_SCORE = 70;

export const emptyResult = (overrides: Partial<TrackerResult> = {}): TrackerResult => ({
  ready: false,
  reps: 0,
  stateLabel: 'Waiting',
  formScore: 0,
  progress: 0,
  cues: [],
  holdSeconds: 0,
  side: null,
  metrics: {},
  chips: [],
  ...overrides,
});
