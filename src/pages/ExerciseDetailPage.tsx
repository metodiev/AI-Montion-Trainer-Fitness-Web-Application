import {
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  Gauge,
  Info,
  Play,
  Shield,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { EXERCISES_BY_ID } from '@/exercises/definitions';
import type { ExerciseId } from '@/exercises/types';
import { FOCUS_LABELS } from '@/services/WorkoutPlanner';
import { personalRecords } from '@/services/StatisticsService';
import { useAppData } from '@/store/AppDataProvider';
import { ButtonLink, Card, Chip, EmptyState, ProgressBar } from '@/components/ui/primitives';
import { DemoPlayer } from '@/components/DemoPlayer';
import { ExerciseGlyph } from '@/components/ExerciseArt';

export function ExerciseDetailPage() {
  const { exerciseId } = useParams();
  const { data } = useAppData();
  const exercise = exerciseId ? EXERCISES_BY_ID[exerciseId as ExerciseId] : undefined;

  if (!exercise) {
    return (
      <EmptyState
        title="Exercise not found"
        description="That movement is not in the library. Browse the full list to pick another."
        action={
          <ButtonLink to="/exercises" variant="secondary">
            Back to library
          </ButtonLink>
        }
      />
    );
  }

  const record = personalRecords(data.history)[exercise.id];
  const bestValue = exercise.metric === 'time' ? record?.bestHoldSeconds ?? 0 : record?.bestReps ?? 0;
  const target = exercise.metric === 'time' ? exercise.targetSeconds : exercise.targetReps;
  const recordProgress = target > 0 ? Math.min(1, bestValue / target) : 0;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/exercises" className="flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
        <ArrowLeft size={14} /> Exercise library
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden p-3 sm:p-4" strong>
          <DemoPlayer demo={exercise.demo} className="aspect-[4/3] w-full" />
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-6">
            <div className="flex items-start gap-3">
              <ExerciseGlyph id={exercise.id} size="lg" />
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  <Chip tone={exercise.difficulty === 'beginner' ? 'lime' : exercise.difficulty === 'intermediate' ? 'sky' : 'amber'}>
                    {exercise.difficulty}
                  </Chip>
                  <Chip tone="neutral">{exercise.metric === 'time' ? 'Timed hold' : 'Rep counted'}</Chip>
                </div>
                <h1 className="font-display text-2xl font-semibold tracking-tight text-white">{exercise.name}</h1>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {exercise.focus.map((area) => FOCUS_LABELS[area]).join(' · ')}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">{exercise.summary}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <p className="app-label">Target</p>
                <p className="mt-1 font-display text-xl font-semibold text-white">
                  {exercise.metric === 'time' ? `${exercise.targetSeconds}s` : `${exercise.targetReps} reps`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <p className="app-label">Your best</p>
                <p className="mt-1 font-display text-xl font-semibold text-lime-300">
                  {bestValue > 0 ? (exercise.metric === 'time' ? `${bestValue}s` : `${bestValue}`) : '—'}
                </p>
              </div>
            </div>

            {bestValue > 0 ? (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Target progress</span>
                  <span className="font-mono">{Math.round(recordProgress * 100)}%</span>
                </div>
                <ProgressBar value={recordProgress} height="h-1.5" />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <ButtonLink to={`/train/free?exercise=${exercise.id}`} icon={<Play size={15} />}>
                Free training
              </ButtonLink>
              <ButtonLink
                to={`/train/endurance?exercise=${exercise.id}`}
                variant="secondary"
                size="md"
                icon={<Gauge size={15} />}
              >
                Endurance
              </ButtonLink>
              <ButtonLink
                to={`/train/precision?exercise=${exercise.id}`}
                variant="secondary"
                size="md"
                icon={<Target size={15} />}
              >
                Precision
              </ButtonLink>
            </div>
          </Card>

          <Card className="flex items-start gap-3 border-sky-400/20 bg-sky-400/[0.06] p-5">
            <Camera size={18} className="mt-0.5 shrink-0 text-sky-300" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-sky-200 uppercase">Camera setup</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{exercise.cameraHint}</p>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Sparkles size={17} className="text-lime-300" /> How to perform it
          </h2>
          <ol className="mt-4 space-y-3">
            {exercise.instructions.map((instruction, index) => (
              <li key={instruction} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-lime-400/30 bg-lime-400/10 font-mono text-[11px] font-bold text-lime-300">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-300">{instruction}</span>
              </li>
            ))}
          </ol>

          <div className="app-divider my-5" />

          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Check size={15} className="text-emerald-300" /> Body positioning
          </h3>
          <ul className="mt-3 space-y-2">
            {exercise.posture.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">
              <CircleAlert size={16} className="text-amber-300" /> Common mistakes
            </h2>
            <ul className="mt-3 space-y-2.5">
              {exercise.mistakes.map((item) => (
                <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-slate-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="border-rose-400/15 bg-rose-400/[0.045] p-6">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-rose-100">
              <Shield size={16} /> Safety first
            </h2>
            <ul className="mt-3 space-y-2.5">
              {exercise.safety.map((item) => (
                <li key={item} className="flex gap-2.5 text-xs leading-relaxed text-rose-100/80">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300/80" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Info size={17} className="text-violet-300" /> How the tracker judges this exercise
          </h2>
          <Chip tone="violet">
            <Timer size={11} /> {exercise.requiredLandmarks.length} tracked joints
          </Chip>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{exercise.trackingNotes}</p>
        <div className="mt-4 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
            <span className="font-semibold text-slate-300">State machine</span> — reps require a full
            movement cycle with thresholds and cooldowns.
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
            <span className="font-semibold text-slate-300">Calibrated</span> — thresholds scale to your
            torso length and neutral stance, not raw pixels.
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
            <span className="font-semibold text-slate-300">Local-only</span> — pose landmarks are processed
            in your browser and never uploaded.
          </div>
        </div>
      </Card>
    </div>
  );
}
