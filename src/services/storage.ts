import type { Difficulty, FocusArea, WorkoutMode } from '@/core/types';
import { EXERCISES_BY_ID } from '@/exercises/definitions';
import type { ExerciseId } from '@/exercises/types';
import type {
  AdventureProgress,
  AppData,
  AppSettings,
  ExerciseSetRecord,
  PlannerPreferences,
  PlayerState,
  WorkoutRecord,
} from '@/game/types';
import { toDateKey } from './StatisticsService';

export const STORAGE_KEY = 'ai-motion-trainer:v1';
const MAX_HISTORY = 400;

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

export const DEFAULT_SETTINGS: AppSettings = {
  sound: true,
  voice: true,
  volume: 0.7,
  mirror: true,
  showSkeleton: true,
  showMetrics: false,
  cameraDeviceId: null,
  weightKg: 70,
  dailyGoalXp: 150,
};

export const DEFAULT_PLANNER: PlannerPreferences = {
  difficulty: 'beginner',
  minutes: 10,
  focus: 'full-body',
  lowImpact: true,
  daysPerWeek: 3,
};

const MODES: WorkoutMode[] = ['free', 'daily', 'adventure', 'endurance', 'precision', 'planned'];
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const FOCUS_AREAS: FocusArea[] = ['full-body', 'upper-body', 'lower-body', 'core', 'mobility'];
const MINUTES: PlannerPreferences['minutes'][] = [5, 10, 15, 20, 30];

export function createDefaultPlayer(): PlayerState {
  return {
    xp: 0,
    points: 0,
    workoutDates: [],
    achievements: {},
    adventure: {},
  };
}

export function createDefaultData(): AppData {
  return {
    version: 1,
    player: createDefaultPlayer(),
    settings: { ...DEFAULT_SETTINGS },
    planner: { ...DEFAULT_PLANNER },
    history: [],
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNonNegative = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const boolOr = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

function sanitizeSet(raw: unknown): ExerciseSetRecord | null {
  if (!isObject(raw)) return null;
  const exerciseId = raw.exerciseId;
  if (typeof exerciseId !== 'string' || !(exerciseId in EXERCISES_BY_ID)) return null;
  const asExerciseId = exerciseId as ExerciseId;
  return {
    exerciseId: asExerciseId,
    reps: Math.round(finiteNonNegative(raw.reps)),
    targetReps:
      typeof raw.targetReps === 'number' ? Math.round(finiteNonNegative(raw.targetReps)) : undefined,
    cleanReps: Math.round(finiteNonNegative(raw.cleanReps)),
    holdSeconds: finiteNonNegative(raw.holdSeconds),
    targetSeconds:
      typeof raw.targetSeconds === 'number'
        ? Math.round(finiteNonNegative(raw.targetSeconds))
        : undefined,
    averageScore: Math.min(100, finiteNonNegative(raw.averageScore)),
    points: Math.round(finiteNonNegative(raw.points)),
    xp: Math.round(finiteNonNegative(raw.xp)),
    completed: boolOr(raw.completed, false),
    targetMet: boolOr(raw.targetMet, false),
    durationSec: Math.round(finiteNonNegative(raw.durationSec)),
    perSide: isObject(raw.perSide)
      ? {
          left: Math.round(finiteNonNegative(raw.perSide.left)),
          right: Math.round(finiteNonNegative(raw.perSide.right)),
        }
      : undefined,
    issues: Array.isArray(raw.issues)
      ? raw.issues.filter((issue): issue is string => typeof issue === 'string').slice(0, 5)
      : undefined,
  };
}

function sanitizeRecord(raw: unknown): WorkoutRecord | null {
  if (!isObject(raw)) return null;
  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises.map(sanitizeSet).filter((set): set is ExerciseSetRecord => set !== null)
    : [];
  if (exercises.length === 0) return null;
  const mode = MODES.includes(raw.mode as WorkoutMode) ? (raw.mode as WorkoutMode) : 'planned';
  const difficulty = DIFFICULTIES.includes(raw.difficulty as Difficulty)
    ? (raw.difficulty as Difficulty)
    : 'beginner';
  const focus = FOCUS_AREAS.includes(raw.focus as FocusArea)
    ? (raw.focus as FocusArea)
    : undefined;
  const completedAt =
    typeof raw.completedAt === 'string' && !Number.isNaN(Date.parse(raw.completedAt))
      ? raw.completedAt
      : new Date().toISOString();
  const dateKey = isDateKey(raw.dateKey) ? raw.dateKey : completedAt.slice(0, 10);
  return {
    id: stringOr(raw.id, `legacy-${completedAt}`),
    dateKey,
    completedAt,
    mode,
    title: stringOr(raw.title, 'Workout'),
    difficulty,
    focus,
    durationSec: Math.round(finiteNonNegative(raw.durationSec)),
    exercises,
    totalReps: Math.round(finiteNonNegative(raw.totalReps)),
    cleanReps: Math.round(finiteNonNegative(raw.cleanReps)),
    totalHoldSeconds: finiteNonNegative(raw.totalHoldSeconds),
    averageScore: Math.min(100, finiteNonNegative(raw.averageScore)),
    points: Math.round(finiteNonNegative(raw.points)),
    xp: Math.round(finiteNonNegative(raw.xp)),
    calories: Math.round(finiteNonNegative(raw.calories)),
    levelId: typeof raw.levelId === 'string' ? raw.levelId : undefined,
    dailyKey: typeof raw.dailyKey === 'string' ? raw.dailyKey : undefined,
    accuracyTarget:
      typeof raw.accuracyTarget === 'number'
        ? Math.min(100, finiteNonNegative(raw.accuracyTarget))
        : undefined,
    accuracyAchieved: boolOr(raw.accuracyAchieved, false),
    completionBonusXp: Math.round(finiteNonNegative(raw.completionBonusXp)),
    completionBonusPoints: Math.round(finiteNonNegative(raw.completionBonusPoints)),
  };
}

function sanitizeAdventure(raw: unknown): Record<string, AdventureProgress> {
  if (!isObject(raw)) return {};
  const result: Record<string, AdventureProgress> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isObject(value)) continue;
    result[id] = {
      stars: Math.round(Math.min(3, finiteNonNegative(value.stars))),
      bestScore: Math.min(100, finiteNonNegative(value.bestScore)),
      completedAt: stringOr(value.completedAt, new Date().toISOString()),
    };
  }
  return result;
}

function sanitizeAchievements(raw: unknown): Record<string, string> {
  if (!isObject(raw)) return {};
  const result: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'string') result[id] = value;
  }
  return result;
}

export function sanitizeAppData(raw: unknown): AppData {
  const defaults = createDefaultData();
  if (!isObject(raw)) return defaults;
  if (raw.version !== undefined && raw.version !== 1) return defaults;

  const playerRaw = isObject(raw.player) ? raw.player : {};
  const settingsRaw = isObject(raw.settings) ? raw.settings : {};
  const plannerRaw = isObject(raw.planner) ? raw.planner : {};

  const workoutDates = Array.isArray(playerRaw.workoutDates)
    ? [...new Set(playerRaw.workoutDates.filter(isDateKey))].sort()
    : [];

  const settings: AppSettings = {
    sound: boolOr(settingsRaw.sound, defaults.settings.sound),
    voice: boolOr(settingsRaw.voice, defaults.settings.voice),
    volume: Math.min(1, finiteNonNegative(settingsRaw.volume, defaults.settings.volume)),
    mirror: boolOr(settingsRaw.mirror, defaults.settings.mirror),
    showSkeleton: boolOr(settingsRaw.showSkeleton, defaults.settings.showSkeleton),
    showMetrics: boolOr(settingsRaw.showMetrics, defaults.settings.showMetrics),
    cameraDeviceId:
      typeof settingsRaw.cameraDeviceId === 'string' ? settingsRaw.cameraDeviceId : null,
    weightKg: Math.min(300, Math.max(25, finiteNonNegative(settingsRaw.weightKg, 70))),
    dailyGoalXp: Math.min(2000, Math.max(20, finiteNonNegative(settingsRaw.dailyGoalXp, 150))),
  };

  const planner: PlannerPreferences = {
    difficulty: DIFFICULTIES.includes(plannerRaw.difficulty as Difficulty)
      ? (plannerRaw.difficulty as Difficulty)
      : defaults.planner.difficulty,
    minutes: MINUTES.includes(plannerRaw.minutes as PlannerPreferences['minutes'])
      ? (plannerRaw.minutes as PlannerPreferences['minutes'])
      : defaults.planner.minutes,
    focus: FOCUS_AREAS.includes(plannerRaw.focus as FocusArea)
      ? (plannerRaw.focus as FocusArea)
      : defaults.planner.focus,
    lowImpact: boolOr(plannerRaw.lowImpact, defaults.planner.lowImpact),
    daysPerWeek: [3, 4, 5, 6].includes(plannerRaw.daysPerWeek as number)
      ? (plannerRaw.daysPerWeek as number)
      : defaults.planner.daysPerWeek,
  };

  const player: PlayerState = {
    xp: finiteNonNegative(playerRaw.xp),
    points: finiteNonNegative(playerRaw.points),
    workoutDates,
    achievements: sanitizeAchievements(playerRaw.achievements),
    adventure: sanitizeAdventure(playerRaw.adventure),
  };

  const history = Array.isArray(raw.history)
    ? raw.history
        .map(sanitizeRecord)
        .filter((record): record is WorkoutRecord => record !== null)
        .slice(0, MAX_HISTORY)
    : [];

  return { version: 1, player, settings, planner, history };
}

export function loadAppData(storage: StorageLike | null): AppData {
  if (!storage) return createDefaultData();
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return createDefaultData();
    return sanitizeAppData(JSON.parse(stored));
  } catch {
    return createDefaultData();
  }
}

export function saveAppData(storage: StorageLike | null, data: AppData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = window.localStorage;
    const probe = '__amt_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function defaultRecordDate(timestamp = Date.now()): string {
  return toDateKey(new Date(timestamp));
}
