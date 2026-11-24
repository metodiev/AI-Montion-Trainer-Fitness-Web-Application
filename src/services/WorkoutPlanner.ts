import { clamp } from '@/core/geometry';
import { EXERCISE_DEFINITIONS, getExercise } from '@/exercises/definitions';
import type { ExerciseDefinition, ExerciseId } from '@/exercises/types';
import type { Difficulty, FocusArea, WorkoutMode } from '@/core/types';
import { COOLDOWN_MOVES, WARMUP_MOVES, type GuidedMove } from '@/game/guidedMoves';
import { ADVENTURE_LEVELS, type AdventureLevel } from '@/game/adventure';
import type { PlannerPreferences } from '@/game/types';
import type {
  ExerciseBlock,
  GuidedBlock,
  RestBlock,
  SessionBlock,
  WorkoutSessionConfig,
} from './sessionTypes';

export const FOCUS_LABELS: Record<FocusArea, string> = {
  'full-body': 'Full body',
  'upper-body': 'Upper body',
  'lower-body': 'Lower body',
  core: 'Core',
  mobility: 'Mobility',
};

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const PLAN_SHAPE: Record<PlannerPreferences['minutes'], { rounds: number; exercises: number }> = {
  5: { rounds: 1, exercises: 3 },
  10: { rounds: 2, exercises: 4 },
  15: { rounds: 2, exercises: 5 },
  20: { rounds: 3, exercises: 5 },
  30: { rounds: 4, exercises: 6 },
};

const SECONDS_PER_REP: Partial<Record<ExerciseId, number>> = {
  squat: 2.5,
  'knee-raise': 2.2,
  'arm-raise': 2.2,
  'jumping-jack': 1.35,
  'torso-twist': 2.2,
  lunge: 3.1,
  'push-up': 3,
  'wide-push-up': 3.2,
  'diamond-push-up': 3.2,
  'high-knees': 1.1,
  'mountain-climbers': 1.9,
  burpee: 4.5,
  'jump-squat': 3,
  'side-lunge': 3.2,
  'plank-shoulder-tap': 2.4,
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqueById(exercises: ExerciseDefinition[]): ExerciseDefinition[] {
  const seen = new Set<ExerciseId>();
  return exercises.filter((exercise) => {
    if (seen.has(exercise.id)) return false;
    seen.add(exercise.id);
    return true;
  });
}

export function difficultyForLevel(level: number): Difficulty {
  if (level >= 6) return 'advanced';
  if (level >= 3) return 'intermediate';
  return 'beginner';
}

export function pickExercises(
  preferences: PlannerPreferences,
  count: number,
  seed: number,
): ExerciseDefinition[] {
  const maxRank = DIFFICULTY_RANK[preferences.difficulty];
  let pool = EXERCISE_DEFINITIONS.filter(
    (exercise) =>
      DIFFICULTY_RANK[exercise.difficulty] <= maxRank &&
      (!preferences.lowImpact || exercise.lowImpact),
  );
  if (pool.length < 3) {
    pool = EXERCISE_DEFINITIONS.filter(
      (exercise) => DIFFICULTY_RANK[exercise.difficulty] <= 1,
    );
  }
  const random = mulberry32(seed);
  const scored = shuffle(pool, random)
    .map((exercise) => {
      const focusMatch = exercise.focus.includes(preferences.focus) ? 2 : 0;
      const difficultyMatch = exercise.difficulty === preferences.difficulty ? 1 : 0;
      const mobilityMatch = preferences.focus === 'mobility' && exercise.lowImpact ? 0.5 : 0;
      return { exercise, score: focusMatch + difficultyMatch + mobilityMatch };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.exercise);
  const unique = uniqueById(scored);
  if (unique.length === 0) {
    return [getExercise('squat')];
  }
  const result: ExerciseDefinition[] = [];
  while (result.length < count) {
    result.push(unique[result.length % unique.length]);
  }
  return result;
}

function guidedBlocks(
  moves: GuidedMove[],
  totalSeconds: number,
  prefix: string,
  seed: number,
): GuidedBlock[] {
  const random = mulberry32(seed);
  const chosen = shuffle(moves, random).slice(0, 3);
  const each = Math.max(12, Math.floor(totalSeconds / chosen.length));
  return chosen.map((move, index) => {
    const isLast = index === chosen.length - 1;
    const durationSec = isLast ? Math.max(12, totalSeconds - each * (chosen.length - 1)) : each;
    return {
      id: `${prefix}-${index}`,
      kind: 'guided',
      title: move.name,
      cue: move.cue,
      durationSec,
      demo: move.demo,
      label: prefix === 'warmup' ? 'Warm-up' : 'Cool-down',
    };
  });
}

function makeExerciseBlock(
  exercise: ExerciseDefinition,
  workSeconds: number,
  round: number,
  rounds: number,
  idPrefix: string,
): ExerciseBlock {
  if (exercise.metric === 'time') {
    const targetSeconds = clamp(Math.round(workSeconds - 5), 15, 60);
    return {
      id: `${idPrefix}-${exercise.id}`,
      kind: 'exercise',
      exerciseId: exercise.id,
      targetSeconds,
      durationSec: Math.max(20, Math.round(workSeconds)),
      label: rounds > 1 ? `${exercise.name} · Round ${round + 1}` : exercise.name,
    };
  }
  const perRep = SECONDS_PER_REP[exercise.id] ?? 2.5;
  const targetReps = clamp(Math.round((workSeconds - 6) / perRep), 4, 30);
  return {
    id: `${idPrefix}-${exercise.id}`,
    kind: 'exercise',
    exerciseId: exercise.id,
    targetReps,
    durationSec: Math.max(20, Math.round(workSeconds)),
    label: rounds > 1 ? `${exercise.name} · Round ${round + 1}` : exercise.name,
  };
}

function restBlock(seconds: number, nextLabel: string, idPrefix: string): RestBlock {
  return {
    id: `${idPrefix}-rest`,
    kind: 'rest',
    durationSec: seconds,
    label: 'Recover',
    nextLabel,
  };
}

export interface GenerateOptions {
  seed?: number;
  mode?: WorkoutMode;
  title?: string;
  subtitle?: string;
  focus?: FocusArea;
}

export function generateWorkout(
  preferences: PlannerPreferences,
  options: GenerateOptions = {},
): WorkoutSessionConfig {
  const focus = options.focus ?? preferences.focus;
  const totalSeconds = preferences.minutes * 60;
  const warmupSeconds = Math.round(clamp(totalSeconds * 0.12, 60, 120));
  const cooldownSeconds = Math.round(clamp(totalSeconds * 0.1, 45, 100));
  const mainSeconds = totalSeconds - warmupSeconds - cooldownSeconds;
  const shape = PLAN_SHAPE[preferences.minutes];
  const blockCount = shape.rounds * shape.exercises;
  const restSeconds = preferences.minutes <= 5 ? 10 : preferences.minutes >= 25 ? 20 : 15;
  const workSeconds = (mainSeconds - restSeconds * Math.max(0, blockCount - 1)) / blockCount;
  const seed = options.seed ?? hashString(`${preferences.difficulty}-${preferences.minutes}-${focus}-${preferences.lowImpact}`);
  const exercises = pickExercises({ ...preferences, focus }, shape.exercises, seed);

  const blocks: SessionBlock[] = [];
  blocks.push(
    ...guidedBlocks(WARMUP_MOVES, warmupSeconds, 'warmup', seed ^ 0x9e3779b9),
  );

  let blockIndex = 0;
  for (let round = 0; round < shape.rounds; round += 1) {
    for (let index = 0; index < exercises.length; index += 1) {
      const exercise = exercises[index];
      const isLast = blockIndex === blockCount - 1;
      blocks.push(
        makeExerciseBlock(exercise, workSeconds, round, shape.rounds, `ex-${round}-${index}`),
      );
      blockIndex += 1;
      if (!isLast) {
        const nextExercise = exercises[(index + 1) % exercises.length];
        blocks.push(
          restBlock(
            restSeconds,
            round === shape.rounds - 1 && index === exercises.length - 1
              ? 'Cool-down'
              : nextExercise.name,
            `rest-${round}-${index}`,
          ),
        );
      }
    }
  }

  blocks.push(...guidedBlocks(COOLDOWN_MOVES, cooldownSeconds, 'cooldown', seed ^ 0x85ebca6b));

  const estimatedSeconds = blocks.reduce((total, block) => total + block.durationSec, 0);
  return {
    mode: options.mode ?? 'planned',
    title: options.title ?? `${FOCUS_LABELS[focus]} · ${preferences.minutes} min`,
    subtitle:
      options.subtitle ??
      `${preferences.difficulty[0].toUpperCase()}${preferences.difficulty.slice(1)} · ${
        preferences.lowImpact ? 'Low impact' : 'Normal intensity'
      }`,
    difficulty: preferences.difficulty,
    focus,
    blocks,
    estimatedMinutes: Math.round((estimatedSeconds / 60) * 10) / 10,
  };
}

export interface DailyChallenge {
  dateKey: string;
  config: WorkoutSessionConfig;
}

export function generateDailyChallenge(
  dateKey: string,
  playerLevel = 1,
  seedOverride?: number,
): DailyChallenge {
  const difficulty = difficultyForLevel(playerLevel);
  const preferences: PlannerPreferences = {
    difficulty,
    minutes: 10,
    focus: 'full-body',
    lowImpact: difficulty === 'beginner',
    daysPerWeek: 3,
  };
  const seed = seedOverride ?? hashString(`${dateKey}-daily-${difficulty}`);
  const workout = generateWorkout(preferences, {
    seed,
    mode: 'daily',
    title: 'Daily Challenge',
    subtitle: `${difficulty[0].toUpperCase()}${difficulty.slice(1)} · 10 min · Fresh today`,
  });
  return { dateKey, config: { ...workout, dailyKey: dateKey } };
}

export function generateFreeSession(exerciseId: ExerciseId): WorkoutSessionConfig {
  const exercise = getExercise(exerciseId);
  const perRep = SECONDS_PER_REP[exerciseId] ?? 2.5;
  const targetReps = exercise.metric === 'reps' ? exercise.targetReps : undefined;
  const targetSeconds = exercise.metric === 'time' ? exercise.targetSeconds : undefined;
  const durationSec =
    exercise.metric === 'time'
      ? (targetSeconds ?? 30) + 20
      : Math.max(45, Math.round((targetReps ?? 10) * perRep * 1.8));
  return {
    mode: 'free',
    title: `Free Training · ${exercise.name}`,
    subtitle: 'Practise at your own pace',
    difficulty: exercise.difficulty,
    focus: exercise.focus[0],
    blocks: [
      {
        id: 'free-ex',
        kind: 'exercise',
        exerciseId,
        targetReps,
        targetSeconds,
        durationSec,
        label: exercise.name,
      },
    ],
    estimatedMinutes: Math.round((durationSec / 60) * 10) / 10,
  };
}

export function generateEnduranceSession(
  exerciseId: ExerciseId,
  seconds = 60,
): WorkoutSessionConfig {
  const exercise = getExercise(exerciseId);
  return {
    mode: 'endurance',
    title: `Endurance · ${exercise.name}`,
    subtitle: `${seconds}s · as many clean reps as you can`,
    difficulty: exercise.difficulty,
    focus: exercise.focus[0],
    blocks: [
      {
        id: 'endurance-ex',
        kind: 'exercise',
        exerciseId,
        durationSec: seconds,
        label: exercise.name,
      },
    ],
    estimatedMinutes: Math.round((seconds / 60) * 10) / 10,
    timeLimitSec: seconds,
  };
}

export function generatePrecisionSession(
  exerciseId: ExerciseId,
  reps = 10,
  accuracyTarget = 80,
): WorkoutSessionConfig {
  const exercise = getExercise(exerciseId);
  const perRep = SECONDS_PER_REP[exerciseId] ?? 2.5;
  const targetReps = exercise.metric === 'reps' ? reps : undefined;
  const targetSeconds = exercise.metric === 'time' ? exercise.targetSeconds : undefined;
  return {
    mode: 'precision',
    title: `Precision · ${exercise.name}`,
    subtitle: `Aim for ${accuracyTarget}% technique`,
    difficulty: exercise.difficulty,
    focus: exercise.focus[0],
    blocks: [
      {
        id: 'precision-ex',
        kind: 'exercise',
        exerciseId,
        targetReps,
        targetSeconds,
        durationSec: targetReps
          ? Math.max(45, Math.round(targetReps * perRep * 2))
          : (targetSeconds ?? 30) + 25,
        label: exercise.name,
      },
    ],
    estimatedMinutes: 2,
    accuracyTarget,
  };
}

export function generateAdventureSession(level: AdventureLevel): WorkoutSessionConfig {
  const blocks: SessionBlock[] = [
    ...guidedBlocks(WARMUP_MOVES, 55, 'warmup', hashString(`${level.id}-warmup`)),
  ];
  let index = 0;
  for (let round = 0; round < level.rounds; round += 1) {
    for (const entry of level.exercises) {
      const exercise = getExercise(entry.id);
      const perRep = SECONDS_PER_REP[entry.id] ?? 2.5;
      const targetReps = entry.reps;
      const targetSeconds = entry.seconds;
      const durationSec = targetReps
        ? Math.max(30, Math.round(targetReps * perRep) + 15)
        : Math.max(25, (targetSeconds ?? 30) + 12);
      blocks.push({
        id: `adv-${index}`,
        kind: 'exercise',
        exerciseId: entry.id,
        targetReps,
        targetSeconds,
        durationSec,
        label:
          level.rounds > 1
            ? `${exercise.name} · Round ${round + 1}/${level.rounds}`
            : exercise.name,
      });
      index += 1;
      const isFinal = round === level.rounds - 1 && entry === level.exercises[level.exercises.length - 1];
      if (!isFinal) {
        blocks.push(restBlock(level.restSec, 'Next movement', `adv-rest-${index}`));
      }
    }
  }
  blocks.push(...guidedBlocks(COOLDOWN_MOVES, 50, 'cooldown', hashString(`${level.id}-cool`)));
  const estimatedSeconds = blocks.reduce((total, block) => total + block.durationSec, 0);
  return {
    mode: 'adventure',
    title: `${level.index}. ${level.name}`,
    subtitle: level.tagline,
    difficulty: level.difficulty,
    focus: 'full-body',
    blocks,
    estimatedMinutes: Math.round((estimatedSeconds / 60) * 10) / 10,
    levelId: level.id,
  };
}

export interface WeeklyPlanDay {
  dayIndex: number;
  dayLabel: string;
  focus: FocusArea | null;
  rest: boolean;
  session: WorkoutSessionConfig | null;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TRAINING_DAYS: Record<number, number[]> = {
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

export function generateWeeklyPlan(preferences: PlannerPreferences): WeeklyPlanDay[] {
  const days = TRAINING_DAYS[preferences.daysPerWeek] ?? TRAINING_DAYS[3];
  return DAY_LABELS.map((dayLabel, dayIndex) => {
    if (!days.includes(dayIndex)) {
      return { dayIndex, dayLabel, focus: null, rest: true, session: null };
    }
    const focus = preferences.focus;
    const session = generateWorkout(preferences, {
      focus,
      seed: hashString(`${preferences.difficulty}-${preferences.minutes}-${focus}-${dayIndex}`),
      title: `${FOCUS_LABELS[focus]} · ${preferences.minutes} min`,
      subtitle: `${dayLabel} session`,
    });
    return { dayIndex, dayLabel, focus, rest: false, session };
  });
}

export function getAdventureLevelById(id: string): AdventureLevel | undefined {
  return ADVENTURE_LEVELS.find((level) => level.id === id);
}

