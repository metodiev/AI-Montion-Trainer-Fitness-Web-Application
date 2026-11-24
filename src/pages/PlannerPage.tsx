import { useMemo } from 'react';
import { CalendarDays, ChevronRight, Clock, Dumbbell, Flame, Play, Sparkles } from 'lucide-react';
import type { Difficulty, FocusArea } from '@/core/types';
import { useAppData } from '@/store/AppDataProvider';
import {
  FOCUS_LABELS,
  generateWeeklyPlan,
  generateWorkout,
  pickExercises,
} from '@/services/WorkoutPlanner';
import { getExercise } from '@/exercises/definitions';
import { ButtonLink, Card, Chip, ProgressBar, SegmentedControl, SectionHeader, Toggle } from '@/components/ui/primitives';
import { ExerciseGlyph } from '@/components/ExerciseArt';

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const MINUTES: (5 | 10 | 15 | 20 | 30)[] = [5, 10, 15, 20, 30];
const FOCUSES: FocusArea[] = ['full-body', 'upper-body', 'lower-body', 'core', 'mobility'];
const DAYS = [3, 4, 5, 6];

export function PlannerPage() {
  const { data, updatePlanner } = useAppData();
  const planner = data.planner;
  const session = useMemo(() => generateWorkout(planner), [planner]);
  const week = useMemo(() => generateWeeklyPlan(planner), [planner]);
  const preview = useMemo(
    () =>
      pickExercises(planner, 4, 42).map((exercise) => ({
        exercise,
        target:
          exercise.metric === 'time'
            ? `${Math.max(15, Math.round(exercise.targetSeconds * 0.8))}s hold`
            : `${Math.max(6, Math.round(exercise.targetReps * 0.8))} reps`,
      })),
    [planner],
  );
  const exerciseBlocks = session.blocks.filter((block) => block.kind === 'exercise').length;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="app-label mb-1">Workout planner</p>
        <h1 className="app-title">Build your week</h1>
        <p className="app-muted mt-2 max-w-2xl">
          Conservative defaults, fully adjustable. Sessions always include a guided warm-up, tracked
          exercise intervals and a cool-down.
        </p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card className="flex flex-col gap-6 p-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="app-label">Difficulty</span>
              <span className="text-[11px] text-slate-500">Start conservative</span>
            </div>
            <SegmentedControl
              options={DIFFICULTIES.map((value) => ({
                value,
                label: value[0].toUpperCase() + value.slice(1),
              }))}
              value={planner.difficulty}
              onChange={(difficulty) => updatePlanner({ difficulty })}
              className="w-full"
            />
          </div>

          <div>
            <span className="app-label mb-2 block">Session length</span>
            <SegmentedControl
              options={MINUTES.map((minutes) => ({ value: minutes, label: `${minutes} min` }))}
              value={planner.minutes}
              onChange={(minutes) => updatePlanner({ minutes })}
              className="w-full"
            />
          </div>

          <div>
            <span className="app-label mb-2 block">Focus</span>
            <div className="flex flex-wrap gap-1.5">
              {FOCUSES.map((focus) => (
                <button
                  key={focus}
                  type="button"
                  onClick={() => updatePlanner({ focus })}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                    planner.focus === focus
                      ? 'border-lime-400/40 bg-lime-400/15 text-lime-200'
                      : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white'
                  }`}
                >
                  {FOCUS_LABELS[focus]}
                </button>
              ))}
            </div>
          </div>

          <div className="app-divider" />

          <Toggle
            checked={planner.lowImpact}
            onChange={(lowImpact) => updatePlanner({ lowImpact })}
            label="Low impact only"
            description="Prefer joint-friendly movements; excludes jumps and burpees."
          />

          <div>
            <span className="app-label mb-2 block">Training days per week</span>
            <div className="grid grid-cols-4 gap-2">
              {DAYS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => updatePlanner({ daysPerWeek: days })}
                  className={`rounded-2xl border px-2 py-3 text-center transition ${
                    planner.daysPerWeek === days
                      ? 'border-lime-400/40 bg-lime-400/12'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  }`}
                >
                  <span className="block font-display text-lg font-semibold text-white">{days}</span>
                  <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">days</span>
                </button>
              ))}
            </div>
          </div>

          <ButtonLink to="/train/planned" size="lg" icon={<Play size={16} />} className="w-full">
            Start this session
          </ButtonLink>
          <p className="text-center text-[11px] text-slate-500">
            {session.estimatedMinutes} min · {exerciseBlocks} tracked intervals · {planner.lowImpact ? 'low impact' : 'normal intensity'}
          </p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <SectionHeader eyebrow="Generated session" title={session.title} />
            <div className="mb-4 flex flex-wrap gap-1.5">
              <Chip tone="lime">
                <Sparkles size={11} /> {session.difficulty}
              </Chip>
              <Chip tone="sky">
                <Clock size={11} /> {session.estimatedMinutes} min
              </Chip>
              <Chip tone="violet">
                <Dumbbell size={11} /> {FOCUS_LABELS[planner.focus]}
              </Chip>
            </div>
            <div className="max-h-[330px] space-y-1.5 overflow-y-auto pr-1">
              {session.blocks.map((block, index) => (
                <div
                  key={block.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.025] px-3 py-2"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      block.kind === 'exercise'
                        ? 'bg-lime-400/15 text-lime-300'
                        : block.kind === 'rest'
                          ? 'bg-sky-400/15 text-sky-300'
                          : 'bg-violet-400/15 text-violet-300'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">
                      {block.kind === 'exercise' ? getExercise(block.exerciseId).name : block.kind === 'guided' ? block.title : block.label}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {block.kind === 'exercise'
                        ? `${block.targetReps ? `${block.targetReps} reps` : `${block.targetSeconds}s hold`} · ${Math.round(block.durationSec)}s window`
                        : `${block.kind === 'guided' ? block.label : 'Recovery'} · ${block.durationSec}s`}
                    </p>
                  </div>
                  <ChevronRight size={13} className="text-slate-600" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader eyebrow="Focus preview" title={`${FOCUS_LABELS[planner.focus]} pool`} />
            <div className="grid gap-2">
              {preview.map(({ exercise, target }) => (
                <div key={exercise.id} className="flex items-center gap-3">
                  <ExerciseGlyph id={exercise.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">{exercise.name}</p>
                    <p className="text-[10px] text-slate-500">{target}</p>
                  </div>
                  <Chip tone={exercise.difficulty === 'beginner' ? 'lime' : exercise.difficulty === 'intermediate' ? 'sky' : 'amber'}>
                    {exercise.difficulty}
                  </Chip>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <section>
        <SectionHeader eyebrow="Weekly schedule" title={`Your ${planner.daysPerWeek}-day plan`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {week.map((day) => (
            <Card
              key={day.dayIndex}
              className={`flex flex-col gap-3 p-4 ${day.rest ? 'border-white/5 bg-white/[0.015]' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-display text-sm font-semibold ${day.rest ? 'text-slate-500' : 'text-white'}`}>
                  {day.dayLabel}
                </span>
                {day.rest ? (
                  <span className="text-[10px] font-semibold tracking-wide text-slate-600 uppercase">Rest</span>
                ) : (
                  <Flame size={13} className="text-lime-300" />
                )}
              </div>
              {day.session ? (
                <>
                  <p className="text-[11px] leading-snug text-slate-400">{day.session.title}</p>
                  <div className="mt-auto">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{day.session.estimatedMinutes} min</span>
                      <span>{day.session.blocks.filter((b) => b.kind === 'exercise').length} moves</span>
                    </div>
                    <ProgressBar value={0} height="h-1" />
                  </div>
                </>
              ) : (
                <p className="text-[11px] leading-snug text-slate-600">Walk, stretch, recover.</p>
              )}
            </Card>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <CalendarDays size={13} /> The weekly plan regenerates instantly as you change any preference.
        </div>
      </section>
    </div>
  );
}
