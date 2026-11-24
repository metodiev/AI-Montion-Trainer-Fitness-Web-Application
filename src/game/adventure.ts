import type { Difficulty } from '@/core/types';
import type { ExerciseId } from '@/exercises/types';

export interface AdventureExercise {
  id: ExerciseId;
  reps?: number;
  seconds?: number;
}

export interface AdventureLevel {
  id: string;
  index: number;
  name: string;
  tagline: string;
  description: string;
  difficulty: Difficulty;
  requiredLevel: number;
  requiredPrevious?: string;
  exercises: AdventureExercise[];
  rounds: number;
  restSec: number;
  clearBonusXp: number;
  gradient: string;
  emblem: string;
}

export const ADVENTURE_LEVELS: AdventureLevel[] = [
  {
    id: 'sunrise-foothills',
    index: 1,
    name: 'Sunrise Foothills',
    tagline: 'Take your first steps',
    description: 'A gentle climb through squats, knee raises and arm reaches.',
    difficulty: 'beginner',
    requiredLevel: 1,
    exercises: [
      { id: 'squat', reps: 10 },
      { id: 'knee-raise', reps: 12 },
      { id: 'arm-raise', reps: 10 },
    ],
    rounds: 1,
    restSec: 20,
    clearBonusXp: 60,
    gradient: 'from-emerald-400/20 via-teal-500/10 to-transparent',
    emblem: 'sunrise',
  },
  {
    id: 'jacks-clearing',
    index: 2,
    name: "Jack's Clearing",
    tagline: 'Find your rhythm',
    description: 'Wake up your whole body with jumping jacks, twists and a wall sit.',
    difficulty: 'beginner',
    requiredLevel: 1,
    requiredPrevious: 'sunrise-foothills',
    exercises: [
      { id: 'jumping-jack', reps: 20 },
      { id: 'torso-twist', reps: 14 },
      { id: 'wall-sit', seconds: 25 },
    ],
    rounds: 1,
    restSec: 20,
    clearBonusXp: 80,
    gradient: 'from-cyan-400/20 via-blue-500/10 to-transparent',
    emblem: 'wind',
  },
  {
    id: 'steady-climb',
    index: 3,
    name: 'Steady Climb',
    tagline: 'Build the engine',
    description: 'Two rounds of full-body work to build your base.',
    difficulty: 'beginner',
    requiredLevel: 2,
    requiredPrevious: 'jacks-clearing',
    exercises: [
      { id: 'squat', reps: 14 },
      { id: 'knee-raise', reps: 18 },
      { id: 'jumping-jack', reps: 22 },
      { id: 'plank', seconds: 25 },
    ],
    rounds: 2,
    restSec: 20,
    clearBonusXp: 110,
    gradient: 'from-lime-400/20 via-emerald-500/10 to-transparent',
    emblem: 'mountain',
  },
  {
    id: 'lunge-ridge',
    index: 4,
    name: 'Lunge Ridge',
    tagline: 'Step up to the challenge',
    description: 'Single-leg strength and pressing power on the ridge line.',
    difficulty: 'intermediate',
    requiredLevel: 3,
    requiredPrevious: 'steady-climb',
    exercises: [
      { id: 'lunge', reps: 10 },
      { id: 'push-up', reps: 8 },
      { id: 'plank', seconds: 30 },
    ],
    rounds: 2,
    restSec: 20,
    clearBonusXp: 140,
    gradient: 'from-amber-400/20 via-orange-500/10 to-transparent',
    emblem: 'footsteps',
  },
  {
    id: 'core-cavern',
    index: 5,
    name: 'Core Cavern',
    tagline: 'Hold the line',
    description: 'Deep core endurance under the mountain.',
    difficulty: 'intermediate',
    requiredLevel: 3,
    requiredPrevious: 'lunge-ridge',
    exercises: [
      { id: 'plank', seconds: 35 },
      { id: 'mountain-climbers', reps: 20 },
      { id: 'push-up', reps: 10 },
      { id: 'wall-sit', seconds: 35 },
    ],
    rounds: 2,
    restSec: 20,
    clearBonusXp: 160,
    gradient: 'from-violet-400/20 via-purple-500/10 to-transparent',
    emblem: 'shield',
  },
  {
    id: 'momentum-peak',
    index: 6,
    name: 'Momentum Peak',
    tagline: 'Find your pace',
    description: 'Cardio intervals and power combinations at altitude.',
    difficulty: 'intermediate',
    requiredLevel: 4,
    requiredPrevious: 'core-cavern',
    exercises: [
      { id: 'high-knees', reps: 28 },
      { id: 'burpee', reps: 6 },
      { id: 'lunge', reps: 12 },
      { id: 'jumping-jack', reps: 26 },
    ],
    rounds: 2,
    restSec: 20,
    clearBonusXp: 190,
    gradient: 'from-rose-400/20 via-pink-500/10 to-transparent',
    emblem: 'zap',
  },
  {
    id: 'power-plateau',
    index: 7,
    name: 'Power Plateau',
    tagline: 'Explode forward',
    description: 'Advanced power and anti-rotation work for seasoned movers.',
    difficulty: 'advanced',
    requiredLevel: 5,
    requiredPrevious: 'momentum-peak',
    exercises: [
      { id: 'jump-squat', reps: 10 },
      { id: 'side-lunge', reps: 10 },
      { id: 'push-up', reps: 12 },
      { id: 'plank-shoulder-tap', reps: 12 },
    ],
    rounds: 2,
    restSec: 25,
    clearBonusXp: 230,
    gradient: 'from-orange-400/20 via-red-500/10 to-transparent',
    emblem: 'flame',
  },
  {
    id: 'summit',
    index: 8,
    name: 'The Summit',
    tagline: 'Earn the view',
    description: 'The final test: power, control, balance and grit.',
    difficulty: 'advanced',
    requiredLevel: 6,
    requiredPrevious: 'power-plateau',
    exercises: [
      { id: 'burpee', reps: 10 },
      { id: 'jump-squat', reps: 12 },
      { id: 'diamond-push-up', reps: 8 },
      { id: 'plank', seconds: 45 },
      { id: 'single-leg-balance', seconds: 30 },
    ],
    rounds: 2,
    restSec: 25,
    clearBonusXp: 300,
    gradient: 'from-yellow-300/25 via-amber-500/10 to-transparent',
    emblem: 'crown',
  },
];

export const ADVENTURE_BY_ID = Object.fromEntries(
  ADVENTURE_LEVELS.map((level) => [level.id, level]),
) as Record<string, AdventureLevel>;

export function starsForScore(averageScore: number, completed: boolean): number {
  if (!completed) return 0;
  if (averageScore >= 92) return 3;
  if (averageScore >= 80) return 2;
  return 1;
}

export function isLevelUnlocked(
  level: AdventureLevel,
  progress: Record<string, { stars: number }>,
  playerLevel: number,
): boolean {
  if (!level.requiredPrevious) return true;
  const previous = progress[level.requiredPrevious];
  return (previous?.stars ?? 0) >= 1 && playerLevel >= level.requiredLevel;
}

export function nextAdventureLevel(
  progress: Record<string, { stars: number }>,
  playerLevel: number,
): AdventureLevel | null {
  return (
    ADVENTURE_LEVELS.find(
      (level) => isLevelUnlocked(level, progress, playerLevel) && (progress[level.id]?.stars ?? 0) === 0,
    ) ?? null
  );
}
