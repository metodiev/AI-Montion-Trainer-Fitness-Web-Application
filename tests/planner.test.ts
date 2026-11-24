import { describe, expect, it } from 'vitest';
import { getExercise } from '@/exercises/definitions';
import type { PlannerPreferences } from '@/game/types';
import {
  generateAdventureSession,
  generateDailyChallenge,
  generateEnduranceSession,
  generateFreeSession,
  generatePrecisionSession,
  generateWeeklyPlan,
  generateWorkout,
} from '@/services/WorkoutPlanner';
import { ADVENTURE_LEVELS } from '@/game/adventure';

const base: PlannerPreferences = {
  difficulty: 'beginner',
  minutes: 10,
  focus: 'full-body',
  lowImpact: true,
  daysPerWeek: 3,
};

describe('WorkoutPlanner', () => {
  it('builds a session with warm-up, tracked work and cool-down', () => {
    const session = generateWorkout(base);
    expect(session.blocks[0].kind).toBe('guided');
    expect(session.blocks[session.blocks.length - 1].kind).toBe('guided');
    const exercises = session.blocks.filter((block) => block.kind === 'exercise');
    const rests = session.blocks.filter((block) => block.kind === 'rest');
    expect(exercises.length).toBeGreaterThanOrEqual(3);
    expect(rests.length).toBeGreaterThanOrEqual(1);
    expect(session.mode).toBe('planned');
  });

  it('respects the requested duration', () => {
    for (const minutes of [5, 10, 15, 20, 30] as const) {
      const session = generateWorkout({ ...base, minutes });
      const total = session.blocks.reduce((sum, block) => sum + block.durationSec, 0) / 60;
      expect(total, `${minutes} min`).toBeGreaterThan(minutes - 2.5);
      expect(total, `${minutes} min`).toBeLessThan(minutes + 2.5);
    }
  });

  it('gives every exercise a target appropriate to its metric', () => {
    const session = generateWorkout({ ...base, minutes: 15, difficulty: 'intermediate', lowImpact: false });
    for (const block of session.blocks) {
      if (block.kind !== 'exercise') continue;
      const exercise = getExercise(block.exerciseId);
      if (exercise.metric === 'time') {
        expect(block.targetSeconds).toBeGreaterThan(0);
        expect(block.targetReps).toBeUndefined();
      } else {
        expect(block.targetReps).toBeGreaterThan(0);
        expect(block.targetSeconds).toBeUndefined();
      }
    }
  });

  it('honours the low-impact preference', () => {
    const session = generateWorkout({ ...base, minutes: 10, lowImpact: true });
    for (const block of session.blocks) {
      if (block.kind !== 'exercise') continue;
      expect(getExercise(block.exerciseId).lowImpact).toBe(true);
    }
  });

  it('is deterministic for a given seed and preference set', () => {
    const first = generateWorkout(base, { seed: 42 });
    const second = generateWorkout(base, { seed: 42 });
    expect(first.blocks.map((block) => block.id)).toEqual(second.blocks.map((block) => block.id));
    const third = generateWorkout(base, { seed: 43 });
    expect(first.blocks.map((block) => block.id)).not.toEqual(third.blocks.map((block) => block.id));
  });

  it('generates a stable daily challenge per date and scales with level', () => {
    const a = generateDailyChallenge('2026-01-05', 2);
    const b = generateDailyChallenge('2026-01-05', 2);
    const c = generateDailyChallenge('2026-01-06', 2);
    expect(a.config.mode).toBe('daily');
    expect(a.config.dailyKey).toBe('2026-01-05');
    expect(a.config.blocks.map((block) => block.id)).toEqual(b.config.blocks.map((block) => block.id));
    expect(a.config.blocks.map((block) => block.id)).not.toEqual(c.config.blocks.map((block) => block.id));
    const advanced = generateDailyChallenge('2026-01-05', 9);
    expect(advanced.config.difficulty).toBe('advanced');
  });

  it('creates free, endurance and precision sessions', () => {
    const free = generateFreeSession('knee-raise');
    expect(free.mode).toBe('free');
    expect(free.blocks).toHaveLength(1);
    const endurance = generateEnduranceSession('jumping-jack', 45);
    expect(endurance.timeLimitSec).toBe(45);
    expect(endurance.blocks[0].durationSec).toBe(45);
    const precision = generatePrecisionSession('squat', 12, 90);
    expect(precision.accuracyTarget).toBe(90);
    const block = precision.blocks[0];
    expect(block.kind).toBe('exercise');
    if (block.kind === 'exercise') expect(block.targetReps).toBe(12);
  });

  it('builds adventure sessions that mirror the level definition', () => {
    const level = ADVENTURE_LEVELS[3];
    const session = generateAdventureSession(level);
    const exercises = session.blocks.filter((block) => block.kind === 'exercise');
    expect(session.levelId).toBe(level.id);
    expect(exercises.length).toBe(level.exercises.length * level.rounds);
    expect(session.blocks.filter((block) => block.kind === 'rest')).toHaveLength(
      level.exercises.length * level.rounds - 1,
    );
  });

  it('creates the requested number of training days', () => {
    for (const daysPerWeek of [3, 4, 5, 6]) {
      const plan = generateWeeklyPlan({ ...base, daysPerWeek });
      expect(plan.filter((day) => !day.rest)).toHaveLength(daysPerWeek);
      expect(plan).toHaveLength(7);
      expect(plan.filter((day) => day.rest).every((day) => day.session === null)).toBe(true);
    }
  });
});
