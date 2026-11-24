import { clamp } from '@/core/geometry';
import type { ExerciseId } from '@/exercises/types';
import { ACHIEVEMENTS, evaluateAchievements } from '@/game/achievements';
import { ADVENTURE_BY_ID, starsForScore } from '@/game/adventure';
import type {
  AppData,
  LevelInfo,
  NewRecord,
  PersonalRecords,
  SessionCompletion,
  StreakInfo,
  WorkoutRecord,
  WorkoutRewards,
} from '@/game/types';
import { personalRecords, startOfWeekKey, shiftDateKey, toDateKey } from './StatisticsService';

export const LEVEL_TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 15, title: 'Legend' },
  { minLevel: 11, title: 'Elite' },
  { minLevel: 9, title: 'Warrior' },
  { minLevel: 7, title: 'Contender' },
  { minLevel: 5, title: 'Athlete' },
  { minLevel: 3, title: 'Mover' },
  { minLevel: 1, title: 'Rookie' },
];

/** Cumulative XP needed to reach a level. Level 1 starts at 0. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 250 * n + 50 * n * n;
}

export function levelTitle(level: number): string {
  return LEVEL_TITLES.find((entry) => level >= entry.minLevel)?.title ?? 'Rookie';
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < 99 && xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function levelInfo(xp: number): LevelInfo {
  const level = levelFromXp(Math.max(0, xp));
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  return {
    level,
    title: levelTitle(level),
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel: Math.max(0, xp - currentLevelXp),
    progress: clamp((xp - currentLevelXp) / span, 0, 1),
  };
}

export function streakInfo(workoutDates: string[], today = toDateKey()): StreakInfo {
  const unique = [...new Set(workoutDates)].sort();
  if (unique.length === 0) {
    return { current: 0, longest: 0, lastWorkoutDate: null, activeToday: false, atRisk: false };
  }
  const set = new Set(unique);
  const last = unique[unique.length - 1];
  const yesterday = shiftDateKey(today, -1);
  const activeToday = last === today;

  let current = 0;
  if (last === today || last === yesterday) {
    current = 1;
    let cursor = last;
    while (set.has(shiftDateKey(cursor, -1))) {
      current += 1;
      cursor = shiftDateKey(cursor, -1);
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    if (set.has(shiftDateKey(unique[i - 1], 1))) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  longest = Math.max(longest, current);

  return {
    current,
    longest,
    lastWorkoutDate: last,
    activeToday,
    atRisk: !activeToday && last === yesterday,
  };
}

export function dailyGoalProgress(data: AppData, today = toDateKey()) {
  const records = data.history.filter((record) => record.dateKey === today);
  const xp = records.reduce((sum, record) => sum + record.xp, 0);
  const minutes = records.reduce((sum, record) => sum + record.durationSec / 60, 0);
  const goal = Math.max(20, data.settings.dailyGoalXp);
  return {
    xp,
    minutes: Math.round(minutes * 10) / 10,
    goal,
    progress: clamp(xp / goal, 0, 1),
    met: xp >= goal,
  };
}

export function weeklyGoalProgress(data: AppData, today = toDateKey()) {
  const weekStart = startOfWeekKey(today);
  const weekEnd = shiftDateKey(weekStart, 6);
  const records = data.history.filter(
    (record) => record.dateKey >= weekStart && record.dateKey <= weekEnd,
  );
  const target = Math.max(1, data.planner.daysPerWeek);
  return {
    workouts: records.length,
    target,
    progress: clamp(records.length / target, 0, 1),
  };
}

function collectNewRecords(
  before: PersonalRecords,
  after: PersonalRecords,
): NewRecord[] {
  const records: NewRecord[] = [];
  for (const [exerciseId, afterRecord] of Object.entries(after) as [
    ExerciseId,
    PersonalRecords[ExerciseId],
  ][]) {
    if (!afterRecord) continue;
    const previous = before[exerciseId];
    if (!previous) continue;
    if (afterRecord.bestReps > previous.bestReps && afterRecord.bestReps > 0) {
      records.push({ exerciseId, kind: 'reps', value: afterRecord.bestReps });
    }
    if (afterRecord.bestScore > previous.bestScore && afterRecord.bestScore > 0) {
      records.push({ exerciseId, kind: 'score', value: afterRecord.bestScore });
    }
    if (
      afterRecord.bestHoldSeconds > previous.bestHoldSeconds &&
      afterRecord.bestHoldSeconds > 0
    ) {
      records.push({ exerciseId, kind: 'hold', value: afterRecord.bestHoldSeconds });
    }
  }
  return records
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

/**
 * Applies a completed workout to the save file. Pure: the caller receives a new
 * `AppData` and a reward summary for the celebration screen.
 */
export function completeWorkout(data: AppData, record: WorkoutRecord): SessionCompletion {
  const levelBefore = levelInfo(data.player.xp);
  const beforeRecords = personalRecords(data.history);
  const history = [record, ...data.history]
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .slice(0, 400);

  const workoutDates = [...new Set([...data.player.workoutDates, record.dateKey])].sort();
  const nextPlayer = {
    ...data.player,
    xp: Math.max(0, data.player.xp) + record.xp,
    points: Math.max(0, data.player.points) + record.points,
    workoutDates,
    achievements: { ...data.player.achievements },
    adventure: { ...data.player.adventure },
  };

  let stars: number | null = null;
  if (record.levelId) {
    const level = ADVENTURE_BY_ID[record.levelId];
    const targetsMet = record.exercises.every((set) => set.targetMet);
    if (level && targetsMet) {
      stars = starsForScore(record.averageScore, true);
      const existing = nextPlayer.adventure[level.id];
      nextPlayer.adventure[level.id] = {
        stars: Math.max(existing?.stars ?? 0, stars),
        bestScore: Math.max(existing?.bestScore ?? 0, record.averageScore),
        completedAt: existing?.completedAt ?? record.completedAt,
      };
    }
  }

  const nextData: AppData = {
    ...data,
    player: nextPlayer,
    history,
  };

  const levelAfter = levelInfo(nextPlayer.xp);
  const streak = streakInfo(workoutDates, record.dateKey);
  const newAchievements = evaluateAchievements({
    data: nextData,
    history,
    record,
    records: personalRecords(history),
    level: levelAfter.level,
    streak,
  }).filter((id) => ACHIEVEMENTS.some((achievement) => achievement.id === id));

  for (const id of newAchievements) {
    nextPlayer.achievements[id] = record.completedAt;
  }

  const rewards: WorkoutRewards = {
    xpGained: record.xp,
    pointsGained: record.points,
    levelBefore: levelBefore.level,
    levelAfter: levelAfter.level,
    leveledUp: levelAfter.level > levelBefore.level,
    newAchievements,
    newRecords: collectNewRecords(beforeRecords, personalRecords(history)),
    stars,
  };

  return { data: nextData, rewards, record };
}

export function skillSummary(data: AppData): {
  totalXp: number;
  level: LevelInfo;
  streak: StreakInfo;
  workouts: number;
  achievements: number;
  adventureStars: number;
} {
  const level = levelInfo(data.player.xp);
  const streak = streakInfo(data.player.workoutDates);
  return {
    totalXp: data.player.xp,
    level,
    streak,
    workouts: data.history.length,
    achievements: Object.keys(data.player.achievements).length,
    adventureStars: Object.values(data.player.adventure).reduce(
      (sum, progress) => sum + progress.stars,
      0,
    ),
  };
}

