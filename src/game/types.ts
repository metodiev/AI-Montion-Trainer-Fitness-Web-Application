import type { Difficulty, FocusArea, WorkoutMode } from '@/core/types';
import type { ExerciseId } from '@/exercises/types';

export interface AppSettings {
  sound: boolean;
  voice: boolean;
  volume: number;
  mirror: boolean;
  showSkeleton: boolean;
  showMetrics: boolean;
  cameraDeviceId: string | null;
  weightKg: number;
  dailyGoalXp: number;
}

export interface AdventureProgress {
  stars: number;
  bestScore: number;
  completedAt: string;
}

export interface PlayerState {
  xp: number;
  points: number;
  workoutDates: string[];
  achievements: Record<string, string>;
  adventure: Record<string, AdventureProgress>;
}

export interface ExerciseSetRecord {
  exerciseId: ExerciseId;
  reps: number;
  targetReps?: number;
  cleanReps: number;
  holdSeconds: number;
  targetSeconds?: number;
  averageScore: number;
  points: number;
  xp: number;
  completed: boolean;
  durationSec: number;
  targetMet: boolean;
  perSide?: Record<'left' | 'right', number>;
  issues?: string[];
}

export interface WorkoutRecord {
  id: string;
  /** Local date key `YYYY-MM-DD` used for streaks and charts. */
  dateKey: string;
  completedAt: string;
  mode: WorkoutMode;
  title: string;
  difficulty: Difficulty;
  focus?: FocusArea;
  durationSec: number;
  exercises: ExerciseSetRecord[];
  totalReps: number;
  cleanReps: number;
  totalHoldSeconds: number;
  averageScore: number;
  points: number;
  xp: number;
  calories: number;
  levelId?: string;
  dailyKey?: string;
  accuracyTarget?: number;
  accuracyAchieved?: boolean;
  completionBonusXp?: number;
  completionBonusPoints?: number;
}

export interface PlannerPreferences {
  difficulty: Difficulty;
  minutes: 5 | 10 | 15 | 20 | 30;
  focus: FocusArea;
  lowImpact: boolean;
  daysPerWeek: number;
}

export interface PersonalRecord {
  bestReps: number;
  bestScore: number;
  bestHoldSeconds: number;
  lastPerformed?: string;
}

export type PersonalRecords = Partial<Record<ExerciseId, PersonalRecord>>;

export interface AppData {
  version: 1;
  player: PlayerState;
  settings: AppSettings;
  planner: PlannerPreferences;
  history: WorkoutRecord[];
}

export interface NewRecord {
  exerciseId: ExerciseId;
  kind: 'reps' | 'score' | 'hold';
  value: number;
}

export interface WorkoutRewards {
  xpGained: number;
  pointsGained: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
  newAchievements: string[];
  newRecords: NewRecord[];
  stars: number | null;
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastWorkoutDate: string | null;
  activeToday: boolean;
  atRisk: boolean;
}

export interface LevelInfo {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  progress: number;
}

export interface SessionCompletion {
  data: AppData;
  rewards: WorkoutRewards;
  record: WorkoutRecord;
}
