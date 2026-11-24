import { describe, expect, it, vi } from 'vitest';
import {
  browserStorage,
  createDefaultData,
  DEFAULT_SETTINGS,
  loadAppData,
  sanitizeAppData,
  saveAppData,
  STORAGE_KEY,
  type StorageLike,
} from '@/services/storage';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('storage', () => {
  it('round-trips app data', () => {
    const storage = memoryStorage();
    const data = createDefaultData();
    data.player.xp = 420;
    data.player.points = 300;
    data.planner.difficulty = 'intermediate';
    expect(saveAppData(storage, data)).toBe(true);
    const loaded = loadAppData(storage);
    expect(loaded.player.xp).toBe(420);
    expect(loaded.player.points).toBe(300);
    expect(loaded.planner.difficulty).toBe('intermediate');
  });

  it('returns defaults when nothing is stored or JSON is corrupt', () => {
    expect(loadAppData(memoryStorage()).history).toHaveLength(0);
    const corrupt = memoryStorage({ [STORAGE_KEY]: '{not json' });
    const loaded = loadAppData(corrupt);
    expect(loaded.version).toBe(1);
    expect(loaded.player.xp).toBe(0);
    expect(loaded.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects unsupported save versions', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99, player: { xp: 9999 } }) });
    expect(loadAppData(storage).player.xp).toBe(0);
  });

  it('sanitises hostile or stale data', () => {
    const raw = {
      version: 1,
      player: {
        xp: -50,
        points: 'lots',
        workoutDates: ['2026-01-01', 'bad-date', '2026-01-01'],
        achievements: { 'first-steps': '2026-01-01', hacked: 5 },
        adventure: { 'sunrise-foothills': { stars: 99, bestScore: 400, completedAt: '2026-01-01' } },
      },
      settings: { volume: 5, weightKg: 2, dailyGoalXp: -3, sound: 'yes', mirror: false },
      planner: { difficulty: 'impossible', minutes: 7, focus: 'arms', daysPerWeek: 9 },
      history: [
        {
          id: 'ok',
          dateKey: '2026-01-01',
          completedAt: '2026-01-01T10:00:00.000Z',
          mode: 'daily',
          title: 'Good',
          difficulty: 'beginner',
          durationSec: 300,
          exercises: [
            {
              exerciseId: 'squat',
              reps: 10,
              cleanReps: 8,
              holdSeconds: 0,
              averageScore: 92,
              points: 40,
              xp: 20,
              completed: true,
              targetMet: true,
              durationSec: 120,
            },
          ],
          totalReps: 10,
          cleanReps: 8,
          totalHoldSeconds: 0,
          averageScore: 92,
          points: 40,
          xp: 20,
          calories: 10,
        },
        {
          id: 'unknown-exercise',
          completedAt: '2026-01-02T10:00:00.000Z',
          exercises: [{ exerciseId: 'moon-walk', reps: 5, averageScore: 100 }],
        },
        { nonsense: true },
      ],
    };
    const data = sanitizeAppData(raw);
    expect(data.player.xp).toBe(0);
    expect(data.player.points).toBe(0);
    expect(data.player.workoutDates).toEqual(['2026-01-01']);
    expect(data.player.achievements).toEqual({ 'first-steps': '2026-01-01' });
    expect(data.player.adventure['sunrise-foothills'].stars).toBe(3);
    expect(data.player.adventure['sunrise-foothills'].bestScore).toBe(100);
    expect(data.settings.volume).toBe(1);
    expect(data.settings.weightKg).toBe(25);
    expect(data.settings.dailyGoalXp).toBe(150);
    expect(data.settings.sound).toBe(DEFAULT_SETTINGS.sound);
    expect(data.settings.mirror).toBe(false);
    expect(data.planner.difficulty).toBe('beginner');
    expect(data.planner.minutes).toBe(10);
    expect(data.planner.focus).toBe('full-body');
    expect(data.planner.daysPerWeek).toBe(3);
    expect(data.history).toHaveLength(1);
    expect(data.history[0].exercises[0].exerciseId).toBe('squat');
  });

  it('handles storage write failures gracefully', () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveAppData(failing, createDefaultData())).toBe(false);
    expect(saveAppData(null, createDefaultData())).toBe(false);
  });

  it('detects browser storage availability', () => {
    const store = memoryStorage();
    const spy = vi
      .spyOn(window, 'localStorage', 'get')
      .mockReturnValue(store as unknown as Storage);
    const storage = browserStorage();
    expect(storage).toBe(store);
    spy.mockRestore();
  });

  it('does not throw when localStorage is blocked', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(browserStorage()).toBeNull();
    spy.mockRestore();
  });
});
