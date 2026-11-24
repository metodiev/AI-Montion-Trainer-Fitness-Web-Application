import { describe, expect, it } from 'vitest';
import type { WorkoutRecord } from '@/game/types';
import {
  completeWorkout,
  dailyGoalProgress,
  levelFromXp,
  levelInfo,
  levelTitle,
  streakInfo,
  weeklyGoalProgress,
  xpForLevel,
} from '@/services/GameProgression';
import { starsForScore } from '@/game/adventure';
import { createDefaultData } from '@/services/storage';
import { shiftDateKey, toDateKey } from '@/services/StatisticsService';

const record = (overrides: Partial<WorkoutRecord> = {}): WorkoutRecord => ({
  id: 'record-1',
  dateKey: '2026-02-10',
  completedAt: '2026-02-10T18:00:00.000Z',
  mode: 'free',
  title: 'Test session',
  difficulty: 'beginner',
  durationSec: 600,
  exercises: [
    {
      exerciseId: 'squat',
      reps: 12,
      targetReps: 12,
      cleanReps: 10,
      holdSeconds: 0,
      averageScore: 90,
      points: 90,
      xp: 30,
      completed: true,
      targetMet: true,
      durationSec: 600,
    },
  ],
  totalReps: 12,
  cleanReps: 10,
  totalHoldSeconds: 0,
  averageScore: 90,
  points: 90,
  xp: 120,
  calories: 55,
  ...overrides,
});

describe('level curve', () => {
  it('grows quadratically and inverts cleanly', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(300);
    expect(xpForLevel(3)).toBe(700);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(299)).toBe(1);
    expect(levelFromXp(300)).toBe(2);
    expect(levelFromXp(699)).toBe(2);
    expect(levelFromXp(700)).toBe(3);
    expect(levelInfo(450).progress).toBeCloseTo(150 / 400, 4);
    expect(levelTitle(12)).toBe('Elite');
    expect(levelTitle(1)).toBe('Rookie');
  });
});

describe('streaks', () => {
  it('counts consecutive days ending today', () => {
    const today = toDateKey();
    const dates = [shiftDateKey(today, -2), shiftDateKey(today, -1), today];
    const info = streakInfo(dates, today);
    expect(info.current).toBe(3);
    expect(info.longest).toBe(3);
    expect(info.activeToday).toBe(true);
    expect(info.atRisk).toBe(false);
  });

  it('keeps yesterday alive but flags risk', () => {
    const today = toDateKey();
    const info = streakInfo([shiftDateKey(today, -1)], today);
    expect(info.current).toBe(1);
    expect(info.atRisk).toBe(true);
    expect(info.activeToday).toBe(false);
  });

  it('breaks a streak after a missed day and tracks the longest run', () => {
    const today = toDateKey();
    const dates = [
      shiftDateKey(today, -10),
      shiftDateKey(today, -9),
      shiftDateKey(today, -8),
      shiftDateKey(today, -5),
      shiftDateKey(today, -1),
    ];
    const info = streakInfo(dates, today);
    expect(info.current).toBe(1);
    expect(info.longest).toBe(3);
    expect(streakInfo([], today).current).toBe(0);
  });
});

describe('goal tracking', () => {
  it('computes today progress against the XP goal', () => {
    const data = createDefaultData();
    data.settings.dailyGoalXp = 100;
    const withHistory = {
      ...data,
      history: [record({ xp: 60, dateKey: toDateKey() })],
    };
    const progress = dailyGoalProgress(withHistory, toDateKey());
    expect(progress.xp).toBe(60);
    expect(progress.progress).toBeCloseTo(0.6, 5);
    expect(progress.met).toBe(false);
  });

  it('counts training days in the current week', () => {
    const data = createDefaultData();
    data.planner.daysPerWeek = 4;
    const today = toDateKey();
    const withHistory = {
      ...data,
      history: [record({ dateKey: today }), record({ id: 'r2', dateKey: shiftDateKey(today, -1) })],
    };
    expect(weeklyGoalProgress(withHistory, today).workouts).toBeGreaterThanOrEqual(1);
    expect(weeklyGoalProgress(withHistory, today).target).toBe(4);
  });
});

describe('completeWorkout', () => {
  it('awards XP, unlocks the first achievement and updates history', () => {
    const data = createDefaultData();
    const completion = completeWorkout(data, record());
    expect(completion.data.player.xp).toBe(120);
    expect(completion.data.player.points).toBe(90);
    expect(completion.data.history).toHaveLength(1);
    expect(completion.rewards.newAchievements).toContain('first-steps');
    expect(completion.data.player.achievements['first-steps']).toBeDefined();
    expect(completion.data.player.workoutDates).toContain('2026-02-10');
  });

  it('detects level ups', () => {
    const data = createDefaultData();
    data.player.xp = 290;
    const completion = completeWorkout(data, record({ xp: 30 }));
    expect(completion.rewards.levelBefore).toBe(1);
    expect(completion.rewards.levelAfter).toBe(2);
    expect(completion.rewards.leveledUp).toBe(true);
  });

  it('awards adventure stars only when targets are met', () => {
    const data = createDefaultData();
    const strong = completeWorkout(
      data,
      record({
        mode: 'adventure',
        levelId: 'sunrise-foothills',
        difficulty: 'beginner',
        averageScore: 93,
        exercises: [
          {
            ...record().exercises[0],
            reps: 12,
            targetReps: 10,
            targetMet: true,
          },
        ],
      }),
    );
    expect(strong.rewards.stars).toBe(3);
    expect(strong.data.player.adventure['sunrise-foothills']?.stars).toBe(3);

    const weak = completeWorkout(
      data,
      record({
        mode: 'adventure',
        levelId: 'sunrise-foothills',
        averageScore: 93,
        exercises: [{ ...record().exercises[0], reps: 4, targetReps: 10, targetMet: false }],
      }),
    );
    expect(weak.rewards.stars).toBeNull();
    expect(weak.data.player.adventure['sunrise-foothills']).toBeUndefined();
  });

  it('never downgrades existing adventure stars', () => {
    const data = createDefaultData();
    data.player.adventure['jacks-clearing'] = {
      stars: 3,
      bestScore: 95,
      completedAt: '2026-01-01T00:00:00.000Z',
    };
    const completion = completeWorkout(
      data,
      record({
        id: 'later',
        mode: 'adventure',
        levelId: 'jacks-clearing',
        averageScore: 30,
      }),
    );
    expect(completion.data.player.adventure['jacks-clearing']?.stars).toBe(3);
  });

  it('unlocks achievements across categories', () => {
    const data = createDefaultData();
    const squats = Array.from({ length: 8 }, () => ({
      ...record().exercises[0],
      exerciseId: 'squat' as const,
      reps: 15,
      averageScore: 92,
    }));
    const first = completeWorkout(
      data,
      record({ id: 'a', exercises: squats, totalReps: 120, averageScore: 92 }),
    );
    expect(first.rewards.newAchievements).toContain('century-club');
    expect(first.rewards.newAchievements).toContain('leg-day-legend');
    expect(first.rewards.newAchievements).toContain('form-first');
  });

  it('detects personal records on later workouts', () => {
    const data = createDefaultData();
    const first = completeWorkout(data, record({ id: 'first', totalReps: 8 }));
    expect(first.rewards.newRecords).toHaveLength(0);
    const second = completeWorkout(
      first.data,
      record({
        id: 'second',
        totalReps: 16,
        averageScore: 95,
        exercises: [
          {
            ...record().exercises[0],
            reps: 16,
            averageScore: 95,
          },
        ],
      }),
    );
    expect(second.rewards.newRecords.some((entry) => entry.kind === 'reps' && entry.value === 16)).toBe(true);
    expect(second.rewards.newRecords.some((entry) => entry.kind === 'score' && entry.value === 95)).toBe(true);
  });

  it('caps history growth and sorts newest first', () => {
    let data = createDefaultData();
    for (let index = 0; index < 3; index += 1) {
      data = completeWorkout(
        data,
        record({
          id: `r-${index}`,
          completedAt: `2026-02-1${index}T10:00:00.000Z`,
          dateKey: `2026-02-1${index}`,
        }),
      ).data;
    }
    expect(data.history[0].id).toBe('r-2');
    expect(data.history).toHaveLength(3);
  });
});

describe('star thresholds', () => {
  it('requires completion and rewards technique', () => {
    expect(starsForScore(99, false)).toBe(0);
    expect(starsForScore(60, true)).toBe(1);
    expect(starsForScore(80, true)).toBe(2);
    expect(starsForScore(92, true)).toBe(3);
  });
});
