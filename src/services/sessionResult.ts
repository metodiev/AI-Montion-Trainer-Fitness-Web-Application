import { getExercise } from '@/exercises/definitions';
import { ADVENTURE_BY_ID } from '@/game/adventure';
import type { ExerciseSetRecord, WorkoutRecord } from '@/game/types';
import type { WorkoutSessionConfig, ExerciseBlock } from './sessionTypes';
import type { EngineSetResult } from './ExerciseEngine';
import { toDateKey } from './StatisticsService';

export interface SessionSetPerformance {
  block: ExerciseBlock;
  result: EngineSetResult;
  targetMet: boolean;
  /** Active seconds spent in this block, excluding pauses. */
  durationSec: number;
}

export interface BuildRecordOptions {
  startedAt: number;
  endedAt: number;
  activeSeconds: number;
  now?: Date;
  completed: boolean;
}

const randomId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export function buildWorkoutRecord(
  config: WorkoutSessionConfig,
  performances: SessionSetPerformance[],
  options: BuildRecordOptions,
): WorkoutRecord {
  const now = options.now ?? new Date();
  const exercises: ExerciseSetRecord[] = performances.map((performance) => ({
    exerciseId: performance.result.exerciseId,
    reps: performance.result.reps,
    targetReps: performance.block.targetReps,
    cleanReps: performance.result.cleanReps,
    holdSeconds: performance.result.holdSeconds,
    targetSeconds: performance.block.targetSeconds,
    averageScore: performance.result.averageScore,
    points: performance.result.points,
    xp: performance.result.xp,
    completed: options.completed,
    targetMet: performance.targetMet,
    durationSec: Math.round(performance.durationSec),
    perSide: performance.result.perSide,
    issues: performance.result.issues,
  }));

  const totalReps = exercises.reduce((sum, set) => sum + set.reps, 0);
  const cleanReps = exercises.reduce((sum, set) => sum + set.cleanReps, 0);
  const totalHoldSeconds = Math.round(
    exercises.reduce((sum, set) => sum + set.holdSeconds, 0) * 10,
  ) / 10;

  const weights = exercises.map((set) => Math.max(1, set.reps + set.holdSeconds / 3));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const averageScore =
    weightTotal > 0
      ? Math.round(
          exercises.reduce((sum, set, index) => sum + set.averageScore * weights[index], 0) /
            weightTotal,
        )
      : 0;

  const basePoints = exercises.reduce((sum, set) => sum + set.points, 0);
  const baseXp = exercises.reduce((sum, set) => sum + set.xp, 0);
  let bonusXp = 0;
  let bonusPoints = 0;

  if (options.completed) {
    bonusXp += 25;
    bonusPoints += 15;
    if (config.mode === 'daily') {
      bonusXp += 30;
      bonusPoints += 20;
    }
    if (config.mode === 'precision' && averageScore >= (config.accuracyTarget ?? 80)) {
      bonusXp += 40;
      bonusPoints += 20;
    }
  }

  if (config.levelId) {
    const level = ADVENTURE_BY_ID[config.levelId];
    const allTargetsMet = performances.every((performance) => performance.targetMet);
    if (level && allTargetsMet && options.completed) {
      bonusXp += level.clearBonusXp;
      bonusPoints += Math.round(level.clearBonusXp / 2);
    }
  }

  const calories = Math.round(
    performances.reduce((sum, performance) => {
      const exercise = getExercise(performance.result.exerciseId);
      return sum + exercise.caloriesPerMinute * (performance.durationSec / 60);
    }, 0),
  );

  const accuracyAchieved =
    config.mode === 'precision'
      ? averageScore >= (config.accuracyTarget ?? 80)
      : undefined;

  return {
    id: randomId(),
    dateKey: toDateKey(now),
    completedAt: now.toISOString(),
    mode: config.mode,
    title: config.title,
    difficulty: config.difficulty,
    focus: config.focus,
    durationSec: Math.max(0, Math.round(options.activeSeconds)),
    exercises,
    totalReps,
    cleanReps,
    totalHoldSeconds,
    averageScore,
    points: basePoints + bonusPoints,
    xp: baseXp + bonusXp,
    calories,
    levelId: config.levelId,
    dailyKey: config.dailyKey,
    accuracyTarget: config.accuracyTarget,
    accuracyAchieved,
    completionBonusXp: bonusXp,
    completionBonusPoints: bonusPoints,
  };
}

export function allTargetsMet(record: WorkoutRecord): boolean {
  return record.exercises.every((set) => set.targetMet);
}

export function sessionDurationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (minutes <= 0) return `${remainder}s`;
  return `${minutes}m ${`${remainder}`.padStart(2, '0')}s`;
}
