import { describe, expect, it } from 'vitest';
import { buildWorkoutRecord, type SessionSetPerformance } from '@/services/sessionResult';
import type { WorkoutSessionConfig } from '@/services/sessionTypes';
import type { ExerciseBlock } from '@/services/sessionTypes';
import type { EngineSetResult } from '@/services/ExerciseEngine';

function performance(
  overrides: Partial<EngineSetResult> = {},
  targetReps = 10,
  targetSeconds?: number,
): SessionSetPerformance {
  const block: ExerciseBlock = {
    id: 'block',
    kind: 'exercise',
    exerciseId: 'squat',
    targetReps,
    targetSeconds,
    durationSec: 60,
    label: 'Squat',
  };
  return {
    block,
    durationSec: 60,
    targetMet: true,
    result: {
      exerciseId: 'squat',
      reps: 12,
      cleanReps: 10,
      holdSeconds: 0,
      averageScore: 90,
      bestRepScore: 95,
      points: 80,
      xp: 30,
      perSide: { left: 0, right: 0 },
      issues: [],
      durationSec: 60,
      ...overrides,
    },
  };
}

const config: WorkoutSessionConfig = {
  mode: 'free',
  title: 'Free training',
  difficulty: 'beginner',
  blocks: [],
  estimatedMinutes: 2,
};

describe('buildWorkoutRecord', () => {
  it('aggregates sets, scores and calories', () => {
    const record = buildWorkoutRecord(
      config,
      [
        performance(),
        performance(
          {
            exerciseId: 'plank',
            reps: 0,
            cleanReps: 0,
            holdSeconds: 30,
            averageScore: 70,
            points: 40,
            xp: 20,
          },
          0,
          30,
        ),
      ],
      { startedAt: 0, endedAt: 120000, activeSeconds: 120, completed: true },
    );
    expect(record.totalReps).toBe(12);
    expect(record.cleanReps).toBe(10);
    expect(record.totalHoldSeconds).toBe(30);
    expect(record.averageScore).toBeGreaterThan(70);
    expect(record.averageScore).toBeLessThan(95);
    expect(record.points).toBe(120 + 15);
    expect(record.xp).toBe(50 + 25);
    expect(record.durationSec).toBe(120);
    expect(record.calories).toBeGreaterThan(0);
    expect(record.completedAt).toMatch(/T/);
    expect(record.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not award completion bonuses when the session was ended early', () => {
    const record = buildWorkoutRecord(config, [performance()], {
      startedAt: 0,
      endedAt: 60000,
      activeSeconds: 60,
      completed: false,
    });
    expect(record.xp).toBe(30);
    expect(record.points).toBe(80);
    expect(record.exercises[0].targetMet).toBe(true);
  });

  it('adds a daily challenge bonus and tracks the daily key', () => {
    const record = buildWorkoutRecord(
      { ...config, mode: 'daily', dailyKey: '2026-03-01' },
      [performance()],
      { startedAt: 0, endedAt: 60000, activeSeconds: 60, completed: true },
    );
    expect(record.dailyKey).toBe('2026-03-01');
    expect(record.xp).toBe(30 + 55);
    expect(record.points).toBe(80 + 35);
  });

  it('flags precision accuracy only when the target is met', () => {
    const passed = buildWorkoutRecord(
      { ...config, mode: 'precision', accuracyTarget: 85 },
      [performance({ averageScore: 90 })],
      { startedAt: 0, endedAt: 60000, activeSeconds: 60, completed: true },
    );
    expect(passed.accuracyAchieved).toBe(true);
    expect(passed.xp).toBe(30 + 25 + 40);

    const failed = buildWorkoutRecord(
      { ...config, mode: 'precision', accuracyTarget: 95 },
      [performance({ averageScore: 90 })],
      { startedAt: 0, endedAt: 60000, activeSeconds: 60, completed: true },
    );
    expect(failed.accuracyAchieved).toBe(false);
  });

  it('adds the adventure clear bonus only when all targets are met', () => {
    const met = buildWorkoutRecord(
      { ...config, mode: 'adventure', levelId: 'sunrise-foothills' },
      [performance()],
      { startedAt: 0, endedAt: 60000, activeSeconds: 60, completed: true },
    );
    expect(met.xp).toBe(30 + 25 + 60);

    const missed = buildWorkoutRecord(
      { ...config, mode: 'adventure', levelId: 'sunrise-foothills' },
      [{ ...performance(), targetMet: false }],
      { startedAt: 0, endedAt: 60000, activeSeconds: 60, completed: true },
    );
    expect(missed.xp).toBe(30 + 25);
  });

  it('preserves target metadata for later analysis', () => {
    const record = buildWorkoutRecord(config, [performance()], {
      startedAt: 0,
      endedAt: 60000,
      activeSeconds: 60,
      completed: true,
    });
    expect(record.exercises[0]).toMatchObject({
      targetReps: 10,
      completed: true,
      targetMet: true,
      durationSec: 60,
    });
  });
});
