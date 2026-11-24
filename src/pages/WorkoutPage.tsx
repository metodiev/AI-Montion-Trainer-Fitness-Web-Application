import { useMemo, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { EXERCISES_BY_ID } from '@/exercises/definitions';
import type { ExerciseId } from '@/exercises/types';
import type { WorkoutMode } from '@/core/types';
import { ADVENTURE_BY_ID, ADVENTURE_LEVELS, isLevelUnlocked, nextAdventureLevel } from '@/game/adventure';
import { levelInfo } from '@/services/GameProgression';
import {
  generateAdventureSession,
  generateDailyChallenge,
  generateEnduranceSession,
  generateFreeSession,
  generatePrecisionSession,
  generateWorkout,
} from '@/services/WorkoutPlanner';
import { toDateKey } from '@/services/StatisticsService';
import { useAppData } from '@/store/AppDataProvider';
import { WorkoutPlayer } from '@/components/workout/WorkoutPlayer';
import { ButtonLink, EmptyState } from '@/components/ui/primitives';

const MODES: WorkoutMode[] = ['free', 'daily', 'adventure', 'endurance', 'precision', 'planned'];

function resolveExercise(value: string | null): ExerciseId {
  if (value && value in EXERCISES_BY_ID) return value as ExerciseId;
  return 'squat';
}

export function WorkoutPage() {
  const { mode } = useParams();
  const [searchParams] = useSearchParams();
  const { data } = useAppData();
  const level = levelInfo(data.player.xp);
  const todayKey = toDateKey();
  const exerciseId = resolveExercise(searchParams.get('exercise'));
  const levelParam = searchParams.get('level');
  const seconds = Number(searchParams.get('seconds') ?? 60);
  const reps = Number(searchParams.get('reps') ?? 10);
  const accuracy = Number(searchParams.get('accuracy') ?? 85);
  const selectedLevel = levelParam ? ADVENTURE_BY_ID[levelParam] : null;
  const fallbackLevel = nextAdventureLevel(data.player.adventure, level.level) ?? ADVENTURE_LEVELS[0];
  const adventureLevel = selectedLevel ?? fallbackLevel;
  const adventureLocked =
    mode === 'adventure' &&
    !isLevelUnlocked(adventureLevel, data.player.adventure, level.level);

  const config = useMemo(() => {
    switch (mode as WorkoutMode) {
      case 'free':
        return generateFreeSession(exerciseId);
      case 'daily':
        return generateDailyChallenge(todayKey, level.level).config;
      case 'adventure':
        return generateAdventureSession(adventureLevel);
      case 'endurance':
        return generateEnduranceSession(exerciseId, Number.isFinite(seconds) ? Math.min(180, Math.max(20, seconds)) : 60);
      case 'precision':
        return generatePrecisionSession(
          exerciseId,
          Number.isFinite(reps) ? Math.min(30, Math.max(3, Math.round(reps))) : 10,
          Number.isFinite(accuracy) ? Math.min(100, Math.max(50, accuracy)) : 85,
        );
      case 'planned':
        return generateWorkout(data.planner);
      default:
        return null;
    }
  }, [mode, exerciseId, todayKey, level.level, adventureLevel, seconds, reps, accuracy, data.planner]);

  // Freeze the session identity on mount: earning XP on completion can bump the
  // player level, and remounting here would throw away the summary screen.
  const [signature] = useState(() =>
    [mode, exerciseId, adventureLevel.id, todayKey, seconds, reps, accuracy].join(':'),
  );

  if (!mode || !MODES.includes(mode as WorkoutMode) || !config) {
    return <Navigate to="/" replace />;
  }

  if (adventureLocked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={<Lock size={28} />}
          title="Level locked"
          description={`Clear ${
            adventureLevel.requiredPrevious
              ? ADVENTURE_BY_ID[adventureLevel.requiredPrevious]?.name
              : 'the previous level'
          } and reach level ${adventureLevel.requiredLevel} to unlock ${adventureLevel.name}.`}
          action={
            <ButtonLink to="/adventure" variant="secondary" className="mt-2">
              Back to adventure
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return <WorkoutPlayer key={signature} config={config} />;
}
