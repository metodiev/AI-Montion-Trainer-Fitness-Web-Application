import type { DemoSpec } from '@/core/skeleton';
import type { Difficulty, FocusArea, WorkoutMode } from '@/core/types';
import type { ExerciseId } from '@/exercises/types';

export interface GuidedBlock {
  id: string;
  kind: 'guided';
  title: string;
  cue: string;
  durationSec: number;
  demo: DemoSpec;
  label?: string;
}

export interface ExerciseBlock {
  id: string;
  kind: 'exercise';
  exerciseId: ExerciseId;
  targetReps?: number;
  targetSeconds?: number;
  durationSec: number;
  label: string;
}

export interface RestBlock {
  id: string;
  kind: 'rest';
  durationSec: number;
  label: string;
  nextLabel?: string;
}

export type SessionBlock = GuidedBlock | ExerciseBlock | RestBlock;

export interface WorkoutSessionConfig {
  mode: WorkoutMode;
  title: string;
  subtitle?: string;
  difficulty: Difficulty;
  focus?: FocusArea;
  blocks: SessionBlock[];
  estimatedMinutes: number;
  levelId?: string;
  accuracyTarget?: number;
  timeLimitSec?: number;
  dailyKey?: string;
}
