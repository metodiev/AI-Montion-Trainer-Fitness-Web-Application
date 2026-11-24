import type { AppData, PersonalRecords, StreakInfo, WorkoutRecord } from './types';

export interface AchievementContext {
  data: AppData;
  history: WorkoutRecord[];
  record?: WorkoutRecord;
  records: PersonalRecords;
  level: number;
  streak: StreakInfo;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  condition: (context: AchievementContext) => boolean;
}

const totalReps = (history: WorkoutRecord[]): number =>
  history.reduce((sum, workout) => sum + workout.totalReps, 0);

const totalHoldSeconds = (history: WorkoutRecord[]): number =>
  history.reduce((sum, workout) => sum + workout.totalHoldSeconds, 0);

const repsFor = (history: WorkoutRecord[], ids: string[]): number =>
  history.reduce(
    (sum, workout) =>
      sum +
      workout.exercises
        .filter((set) => ids.includes(set.exerciseId))
        .reduce((inner, set) => inner + set.reps, 0),
    0,
  );

const hasScore = (history: WorkoutRecord[], minimum: number, minReps = 10): boolean =>
  history.some((workout) => workout.averageScore >= minimum && workout.totalReps >= minReps);

const adventureCompleted = (data: AppData): number =>
  Object.values(data.player.adventure).filter((progress) => progress.stars > 0).length;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first workout.',
    icon: 'sparkles',
    tier: 'bronze',
    condition: ({ history }) => history.length >= 1,
  },
  {
    id: 'getting-consistent',
    name: 'Getting Consistent',
    description: 'Complete 5 workouts.',
    icon: 'calendar',
    tier: 'bronze',
    condition: ({ history }) => history.length >= 5,
  },
  {
    id: 'habit-formed',
    name: 'Habit Formed',
    description: 'Complete 25 workouts.',
    icon: 'trophy',
    tier: 'silver',
    condition: ({ history }) => history.length >= 25,
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Complete 50 workouts.',
    icon: 'crown',
    tier: 'gold',
    condition: ({ history }) => history.length >= 50,
  },
  {
    id: 'on-fire',
    name: 'On Fire',
    description: 'Reach a 3-day training streak.',
    icon: 'flame',
    tier: 'bronze',
    condition: ({ streak }) => streak.longest >= 3,
  },
  {
    id: 'week-warrior',
    name: 'Week Warrior',
    description: 'Reach a 7-day training streak.',
    icon: 'flame',
    tier: 'silver',
    condition: ({ streak }) => streak.longest >= 7,
  },
  {
    id: 'monthly-machine',
    name: 'Monthly Machine',
    description: 'Reach a 30-day training streak.',
    icon: 'flame',
    tier: 'gold',
    condition: ({ streak }) => streak.longest >= 30,
  },
  {
    id: 'century-club',
    name: 'Century Club',
    description: 'Perform 100 total repetitions.',
    icon: 'target',
    tier: 'bronze',
    condition: ({ history }) => totalReps(history) >= 100,
  },
  {
    id: 'thousand-strong',
    name: 'Thousand Strong',
    description: 'Perform 1,000 total repetitions.',
    icon: 'zap',
    tier: 'gold',
    condition: ({ history }) => totalReps(history) >= 1000,
  },
  {
    id: 'form-first',
    name: 'Form First',
    description: 'Finish a 10+ rep workout with 90%+ technique.',
    icon: 'shield',
    tier: 'silver',
    condition: ({ history }) => hasScore(history, 90, 10),
  },
  {
    id: 'flawless',
    name: 'Flawless',
    description: 'Finish a workout with 95%+ technique.',
    icon: 'star',
    tier: 'gold',
    condition: ({ history }) => hasScore(history, 95, 5),
  },
  {
    id: 'leg-day-legend',
    name: 'Leg Day Legend',
    description: 'Complete 50 squats with the tracker.',
    icon: 'footsteps',
    tier: 'silver',
    condition: ({ history }) => repsFor(history, ['squat', 'jump-squat']) >= 50,
  },
  {
    id: 'pressing-power',
    name: 'Pressing Power',
    description: 'Complete 50 push-up repetitions.',
    icon: 'chevrons-up',
    tier: 'silver',
    condition: ({ history }) =>
      repsFor(history, ['push-up', 'wide-push-up', 'diamond-push-up']) >= 50,
  },
  {
    id: 'core-of-steel',
    name: 'Core of Steel',
    description: 'Hold a plank for 60 seconds in one set.',
    icon: 'timer',
    tier: 'gold',
    condition: ({ history }) =>
      history.some((workout) =>
        workout.exercises.some(
          (set) => set.exerciseId === 'plank' && set.holdSeconds >= 60,
        ),
      ),
  },
  {
    id: 'balance-master',
    name: 'Balance Master',
    description: 'Accumulate 30 seconds of single-leg balance.',
    icon: 'activity',
    tier: 'silver',
    condition: ({ history }) =>
      history.some((workout) =>
        workout.exercises.some(
          (set) => set.exerciseId === 'single-leg-balance' && set.holdSeconds >= 30,
        ),
      ),
  },
  {
    id: 'peak-explorer',
    name: 'Peak Explorer',
    description: 'Complete 5 Fitness Adventure levels.',
    icon: 'mountain',
    tier: 'gold',
    condition: ({ data }) => adventureCompleted(data) >= 5,
  },
  {
    id: 'star-collector',
    name: 'Star Collector',
    description: 'Earn 3 stars on any adventure level.',
    icon: 'star',
    tier: 'silver',
    condition: ({ data }) =>
      Object.values(data.player.adventure).some((progress) => progress.stars >= 3),
  },
  {
    id: 'rising-star',
    name: 'Rising Star',
    description: 'Reach level 5.',
    icon: 'trending-up',
    tier: 'silver',
    condition: ({ level }) => level >= 5,
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Reach level 10.',
    icon: 'award',
    tier: 'gold',
    condition: ({ level }) => level >= 10,
  },
  {
    id: 'precision-pro',
    name: 'Precision Pro',
    description: 'Score 90%+ technique in Precision mode.',
    icon: 'crosshair',
    tier: 'gold',
    condition: ({ history }) =>
      history.some((workout) => workout.mode === 'precision' && workout.averageScore >= 90),
  },
  {
    id: 'endurance-engine',
    name: 'Endurance Engine',
    description: 'Perform 30+ reps in one Endurance session.',
    icon: 'gauge',
    tier: 'silver',
    condition: ({ history }) =>
      history.some((workout) => workout.mode === 'endurance' && workout.totalReps >= 30),
  },
  {
    id: 'daily-devotion',
    name: 'Daily Devotion',
    description: 'Complete 7 Daily Challenges.',
    icon: 'calendar-check',
    tier: 'silver',
    condition: ({ history }) =>
      history.filter((workout) => workout.mode === 'daily').length >= 7,
  },
  {
    id: 'all-rounder',
    name: 'All-Rounder',
    description: 'Train in 4 different game modes.',
    icon: 'layout-grid',
    tier: 'silver',
    condition: ({ history }) =>
      new Set(history.map((workout) => workout.mode)).size >= 4,
  },
  {
    id: 'bring-the-heat',
    name: 'Bring the Heat',
    description: 'Complete an advanced-difficulty session.',
    icon: 'flame',
    tier: 'gold',
    condition: ({ history }) =>
      history.some((workout) => workout.difficulty === 'advanced'),
  },
  {
    id: 'iron-core',
    name: 'Iron Core',
    description: 'Accumulate 10 minutes of total hold time.',
    icon: 'hourglass',
    tier: 'gold',
    condition: ({ history }) => totalHoldSeconds(history) >= 600,
  },
];

export const ACHIEVEMENT_IDS = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));

export function evaluateAchievements(context: AchievementContext): string[] {
  return ACHIEVEMENTS.filter(
    (achievement) =>
      !context.data.player.achievements[achievement.id] && achievement.condition(context),
  ).map((achievement) => achievement.id);
}
