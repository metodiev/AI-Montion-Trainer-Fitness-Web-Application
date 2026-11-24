import clsx from 'clsx';
import {
  ArrowRight,
  Award,
  Check,
  ChevronRight,
  CircleAlert,
  Flame,
  RotateCcw,
  Star,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { getExercise } from '@/exercises/definitions';
import { ACHIEVEMENTS } from '@/game/achievements';
import { ADVENTURE_BY_ID } from '@/game/adventure';
import type { SessionCompletion } from '@/game/types';
import type { WorkoutSessionConfig } from '@/services/sessionTypes';
import { levelInfo } from '@/services/GameProgression';
import { formatDuration } from '@/services/StatisticsService';
import { Button, ButtonLink, Card, ProgressBar, Ring } from '@/components/ui/primitives';
import { ExerciseGlyph } from '@/components/ExerciseArt';

function Stat({
  label,
  value,
  tone = 'text-white',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center">
      <p className={clsx('font-display text-2xl leading-none font-semibold', tone)}>{value}</p>
      <p className="mt-1 text-[9px] font-semibold tracking-[0.14em] text-slate-500 uppercase">{label}</p>
    </div>
  );
}

export function SessionSummary({
  completion,
  config,
  completed,
  onRetry,
}: {
  completion: SessionCompletion;
  config: WorkoutSessionConfig;
  completed: boolean;
  onRetry: () => void;
}) {
  const { rewards, record, data } = completion;
  const level = data.player;
  const levelState = levelInfo(level.xp);
  const adventure = record.levelId ? ADVENTURE_BY_ID[record.levelId] : null;
  const stars = rewards.stars ?? 0;
  const score = record.averageScore;
  const achievementDetails = rewards.newAchievements
    .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);

  return (
    <div className="min-h-dvh bg-ink-950">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 lg:py-12">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-850/80 p-6 text-center sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(200,255,77,0.2),transparent_60%)]" />
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-lime-400/15 blur-3xl" />
          <div className="relative">
            <span className="app-chip border-lime-400/30 bg-lime-400/10 text-lime-200">
              {completed ? <Sparkles size={11} /> : <CircleAlert size={11} />}
              {completed ? 'Session complete' : 'Session ended early'}
            </span>
            <h1 className="mt-4 font-display text-3xl leading-tight font-semibold text-white sm:text-4xl">
              {completed ? 'Strong work.' : 'Progress still counts.'}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
              {completed
                ? `${config.title} is in the books. ${score >= 90 ? 'Technique was outstanding — that is how you build real strength.' : score >= 75 ? 'Solid technique. Keep the quality high and the reps will follow.' : 'Focus on clean positions next time; the tracker rewards form, not volume.'}`
                : 'Your completed sets have been saved. Finish the full session next time for bonus XP and level star requirements.'}
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-center">
              <Ring
                progress={score / 100}
                size={180}
                stroke={13}
                tone={score >= 90 ? '#34d399' : score >= 70 ? '#c8ff4d' : '#fbbf24'}
              >
                <span className="app-label">Technique</span>
                <span className="font-display text-5xl leading-none font-bold text-white">{score}%</span>
                <span className="mt-1 text-[10px] tracking-wide text-slate-400 uppercase">
                  {score >= 90 ? 'Excellent' : score >= 75 ? 'Solid' : 'Keep building'}
                </span>
              </Ring>
              <div className="grid w-full max-w-sm grid-cols-2 gap-2">
                <Stat label="XP earned" value={`+${record.xp}`} tone="text-lime-300" />
                <Stat label="Points" value={`+${record.points}`} tone="text-violet-300" />
                <Stat label="Reps" value={`${record.totalReps}`} />
                <Stat label="Time" value={formatDuration(record.durationSec)} />
              </div>
            </div>

            {adventure ? (
              <div className="mt-6">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3].map((star) => (
                    <Star
                      key={star}
                      size={30}
                      className={star <= stars ? 'fill-amber-300 text-amber-300' : 'text-slate-700'}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  {stars > 0 ? `${stars}-star clear on ${adventure.name}` : 'Targets not met — no star awarded'}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {rewards.leveledUp ? (
          <Card className="flex items-center gap-4 border-violet-400/25 bg-gradient-to-r from-violet-500/15 to-transparent p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/40 bg-violet-400/15 font-display text-xl font-bold text-violet-200">
              {rewards.levelAfter}
            </div>
            <div>
              <p className="app-label">Level up</p>
              <p className="font-display text-xl font-semibold text-white">
                Level {rewards.levelBefore} → {rewards.levelAfter}
              </p>
              <p className="text-xs text-slate-400">New title unlocked and harder exercises available.</p>
            </div>
            <TrendingUp size={24} className="ml-auto text-violet-300" />
          </Card>
        ) : null}

        {achievementDetails.length > 0 ? (
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Trophy size={17} className="text-amber-300" />
              <h2 className="font-display text-base font-semibold text-white">
                {achievementDetails.length === 1 ? 'Achievement unlocked' : `${achievementDetails.length} achievements unlocked`}
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {achievementDetails.map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3"
                >
                  <Award size={20} className="shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{achievement.name}</p>
                    <p className="truncate text-[10px] text-slate-400">{achievement.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {rewards.newRecords.length > 0 ? (
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Flame size={17} className="text-orange-300" />
              <h2 className="font-display text-base font-semibold text-white">New personal records</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {rewards.newRecords.map((entry) => {
                const exercise = getExercise(entry.exerciseId);
                return (
                  <span
                    key={`${entry.exerciseId}-${entry.kind}`}
                    className="flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1.5 text-[11px] font-medium text-orange-100"
                  >
                    <Check size={11} /> {exercise.name} ·{' '}
                    {entry.kind === 'reps'
                      ? `${entry.value} reps`
                      : entry.kind === 'hold'
                        ? `${entry.value}s hold`
                        : `${entry.value}% technique`}
                  </span>
                );
              })}
            </div>
          </Card>
        ) : null}

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target size={17} className="text-lime-300" />
            <h2 className="font-display text-base font-semibold text-white">Set breakdown</h2>
          </div>
          <div className="space-y-2">
            {record.exercises.map((set, index) => {
              const exercise = getExercise(set.exerciseId);
              const met = set.targetMet;
              return (
                <div
                  key={`${set.exerciseId}-${index}`}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.025] px-3 py-2.5"
                >
                  <ExerciseGlyph id={exercise.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{exercise.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {set.reps > 0 ? `${set.reps} reps` : `${set.holdSeconds}s hold`}
                      {set.targetReps ? ` · target ${set.targetReps}` : ''}
                      {set.targetSeconds ? ` · target ${set.targetSeconds}s` : ''}
                      {` · ${Math.round(set.durationSec)}s`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold text-lime-300">{set.averageScore}%</p>
                    <p className="text-[9px] tracking-wide text-slate-500 uppercase">
                      {met ? 'Target met' : 'Below target'}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'flex h-6 w-6 items-center justify-center rounded-full',
                      met ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300',
                    )}
                  >
                    {met ? <Check size={12} /> : <ChevronRight size={12} />}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Level {levelState.level} · {levelState.title}</span>
            <span className="font-mono text-slate-300">{level.xp} XP total</span>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={levelState.progress} tone="violet" />
          </div>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onRetry} variant="secondary" className="flex-1" icon={<RotateCcw size={15} />}>
            Train again
          </Button>
          <ButtonLink to="/progress" variant="secondary" className="flex-1" icon={<TrendingUp size={15} />}>
            View progress
          </ButtonLink>
          <ButtonLink to="/" className="flex-1" icon={<ArrowRight size={15} />}>
            Dashboard
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

