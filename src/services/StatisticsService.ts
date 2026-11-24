import type { ExerciseId } from '@/exercises/types';
import type {
  PersonalRecord,
  PersonalRecords,
  WorkoutRecord,
} from '@/game/types';

export interface DayStat {
  dateKey: string;
  label: string;
  xp: number;
  minutes: number;
  reps: number;
  workouts: number;
  averageScore: number;
}

export interface WeekStat {
  weekStart: string;
  label: string;
  xp: number;
  minutes: number;
  reps: number;
  workouts: number;
  averageScore: number;
}

export interface TotalStats {
  workouts: number;
  minutes: number;
  xp: number;
  points: number;
  reps: number;
  cleanReps: number;
  holdSeconds: number;
  calories: number;
  averageScore: number;
}

export interface TodayStats {
  workouts: number;
  xp: number;
  minutes: number;
  reps: number;
  cleanReps: number;
  holdSeconds: number;
}

export interface ExerciseStat {
  exerciseId: ExerciseId;
  sets: number;
  reps: number;
  holdSeconds: number;
  bestReps: number;
  bestScore: number;
  bestHoldSeconds: number;
  lastPerformed: string | null;
  totalXp: number;
}

export function toDateKey(input: Date | number = new Date()): string {
  const date = typeof input === 'number' ? new Date(input) : input;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

export function shiftDateKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function startOfWeekKey(key: string): string {
  const date = parseDateKey(key);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return toDateKey(date);
}

export function dayLabel(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'short' });
}

export function weekLabel(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function recordDateKey(record: WorkoutRecord): string {
  return record.dateKey || record.completedAt.slice(0, 10);
}

export function recordsOnDate(history: WorkoutRecord[], dateKey: string): WorkoutRecord[] {
  return history.filter((record) => recordDateKey(record) === dateKey);
}

export function dailySeries(
  history: WorkoutRecord[],
  days: number,
  endKey: string = toDateKey(),
): DayStat[] {
  return Array.from({ length: days }, (_, index) => {
    const dateKey = shiftDateKey(endKey, index - (days - 1));
    const records = recordsOnDate(history, dateKey);
    return {
      dateKey,
      label: dayLabel(dateKey),
      xp: records.reduce((sum, record) => sum + record.xp, 0),
      minutes: round1(records.reduce((sum, record) => sum + record.durationSec / 60, 0)),
      reps: records.reduce((sum, record) => sum + record.totalReps, 0),
      workouts: records.length,
      averageScore: average(records.map((record) => record.averageScore)),
    };
  });
}

export function weeklySeries(
  history: WorkoutRecord[],
  weeks: number,
  endKey: string = toDateKey(),
): WeekStat[] {
  const currentWeek = startOfWeekKey(endKey);
  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = shiftDateKey(currentWeek, -7 * (weeks - 1 - index));
    const weekEnd = shiftDateKey(weekStart, 6);
    const records = history.filter((record) => {
      const key = recordDateKey(record);
      return key >= weekStart && key <= weekEnd;
    });
    return {
      weekStart,
      label: weekLabel(weekStart),
      xp: records.reduce((sum, record) => sum + record.xp, 0),
      minutes: round1(records.reduce((sum, record) => sum + record.durationSec / 60, 0)),
      reps: records.reduce((sum, record) => sum + record.totalReps, 0),
      workouts: records.length,
      averageScore: average(records.map((record) => record.averageScore)),
    };
  });
}

export function totalStats(history: WorkoutRecord[]): TotalStats {
  return {
    workouts: history.length,
    minutes: round1(history.reduce((sum, record) => sum + record.durationSec / 60, 0)),
    xp: history.reduce((sum, record) => sum + record.xp, 0),
    points: history.reduce((sum, record) => sum + record.points, 0),
    reps: history.reduce((sum, record) => sum + record.totalReps, 0),
    cleanReps: history.reduce((sum, record) => sum + record.cleanReps, 0),
    holdSeconds: round1(history.reduce((sum, record) => sum + record.totalHoldSeconds, 0)),
    calories: Math.round(history.reduce((sum, record) => sum + record.calories, 0)),
    averageScore: average(history.map((record) => record.averageScore)),
  };
}

export function todayStats(
  history: WorkoutRecord[],
  dateKey: string = toDateKey(),
): TodayStats {
  const records = recordsOnDate(history, dateKey);
  return {
    workouts: records.length,
    xp: records.reduce((sum, record) => sum + record.xp, 0),
    minutes: round1(records.reduce((sum, record) => sum + record.durationSec / 60, 0)),
    reps: records.reduce((sum, record) => sum + record.totalReps, 0),
    cleanReps: records.reduce((sum, record) => sum + record.cleanReps, 0),
    holdSeconds: round1(records.reduce((sum, record) => sum + record.totalHoldSeconds, 0)),
  };
}

export function exerciseStats(history: WorkoutRecord[]): Record<string, ExerciseStat> {
  const stats: Record<string, ExerciseStat> = {};
  for (const record of history) {
    for (const set of record.exercises) {
      if (!stats[set.exerciseId]) {
        stats[set.exerciseId] = {
          exerciseId: set.exerciseId,
          sets: 0,
          reps: 0,
          holdSeconds: 0,
          bestReps: 0,
          bestScore: 0,
          bestHoldSeconds: 0,
          lastPerformed: null,
          totalXp: 0,
        };
      }
      const entry = stats[set.exerciseId];
      entry.sets += 1;
      entry.reps += set.reps;
      entry.holdSeconds = round1(entry.holdSeconds + set.holdSeconds);
      entry.totalXp += set.xp;
      if (set.reps > 0 || set.holdSeconds > 0) {
        entry.bestReps = Math.max(entry.bestReps, set.reps);
        entry.bestHoldSeconds = Math.max(entry.bestHoldSeconds, set.holdSeconds);
        entry.bestScore = Math.max(entry.bestScore, set.averageScore);
      }
      const date = recordDateKey(record);
      if (!entry.lastPerformed || date > entry.lastPerformed) entry.lastPerformed = date;
    }
  }
  return stats;
}

export function personalRecords(history: WorkoutRecord[]): PersonalRecords {
  const records: PersonalRecords = {};
  for (const record of history) {
    for (const set of record.exercises) {
      if (set.reps === 0 && set.holdSeconds === 0) continue;
      const current: PersonalRecord =
        records[set.exerciseId] ?? {
          bestReps: 0,
          bestScore: 0,
          bestHoldSeconds: 0,
        };
      records[set.exerciseId] = {
        bestReps: Math.max(current.bestReps, set.reps),
        bestScore: Math.max(current.bestScore, set.averageScore),
        bestHoldSeconds: Math.max(current.bestHoldSeconds, set.holdSeconds),
        lastPerformed: recordDateKey(record),
      };
    }
  }
  return records;
}

export function average(values: number[]): number {
  const filtered = values.filter((value) => Number.isFinite(value) && value > 0);
  if (filtered.length === 0) return 0;
  return Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${`${remainder}`.padStart(2, '0')}`;
}

export function formatMinutes(durationSec: number): string {
  const minutes = Math.round((durationSec / 60) * 10) / 10;
  return `${minutes} min`;
}

