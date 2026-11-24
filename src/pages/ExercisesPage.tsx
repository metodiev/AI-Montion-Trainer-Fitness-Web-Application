import { useMemo, useState } from 'react';
import { ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EXERCISE_DEFINITIONS } from '@/exercises/definitions';
import type { Difficulty, FocusArea } from '@/core/types';
import { FOCUS_LABELS } from '@/services/WorkoutPlanner';
import { useAppData } from '@/store/AppDataProvider';
import { personalRecords } from '@/services/StatisticsService';
import { Chip, EmptyState } from '@/components/ui/primitives';
import { ExerciseGlyph, exerciseTheme } from '@/components/ExerciseArt';
import { DemoThumbnail } from '@/components/DemoThumbnail';

const DIFFICULTIES: (Difficulty | 'all')[] = ['all', 'beginner', 'intermediate', 'advanced'];
const FOCUSES: (FocusArea | 'all')[] = ['all', 'full-body', 'upper-body', 'lower-body', 'core', 'mobility'];

const DIFFICULTY_TONE: Record<Difficulty, 'lime' | 'sky' | 'amber'> = {
  beginner: 'lime',
  intermediate: 'sky',
  advanced: 'amber',
};

export function ExercisesPage() {
  const { data } = useAppData();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [focus, setFocus] = useState<FocusArea | 'all'>('all');
  const records = useMemo(() => personalRecords(data.history), [data.history]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return EXERCISE_DEFINITIONS.filter((exercise) => {
      if (difficulty !== 'all' && exercise.difficulty !== difficulty) return false;
      if (focus !== 'all' && !exercise.focus.includes(focus)) return false;
      if (!query) return true;
      return (
        exercise.name.toLowerCase().includes(query) ||
        exercise.summary.toLowerCase().includes(query) ||
        exercise.focus.some((area) => FOCUS_LABELS[area].toLowerCase().includes(query))
      );
    });
  }, [difficulty, focus, search]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="app-label mb-1">Exercise library</p>
        <h1 className="app-title">Train every angle</h1>
        <p className="app-muted mt-2 max-w-2xl">
          {EXERCISE_DEFINITIONS.length} tracked movements across three difficulty levels. Every one has
          animated coaching, live rep counting and a technique score — no exercise is listed until its
          tracking logic is implemented and tested.
        </p>
      </header>

      <div className="app-panel flex flex-col gap-4 p-4 sm:p-5">
        <div className="relative">
          <Search size={16} className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search squats, planks, mobility…"
            className="app-input pl-11"
            aria-label="Search exercises"
          />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal size={14} className="text-slate-500" />
            <span className="app-label mr-1">Level</span>
            {DIFFICULTIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize transition ${
                  difficulty === value
                    ? 'border-lime-400/40 bg-lime-400/15 text-lime-200'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-label mr-1 ml-5">Focus</span>
            {FOCUSES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFocus(value)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  focus === value
                    ? 'border-violet-400/40 bg-violet-400/15 text-violet-200'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white'
                }`}
              >
                {value === 'all' ? 'All' : FOCUS_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No exercises match"
          description="Try another search term or clear the filters to see the full library."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((exercise) => {
            const record = records[exercise.id];
            const theme = exerciseTheme(exercise.id);
            return (
              <Link
                key={exercise.id}
                to={`/exercises/${exercise.id}`}
                className="group app-panel flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-white/20"
              >
                <div className="relative h-40 overflow-hidden border-b border-white/8 bg-gradient-to-br from-white/[0.05] to-transparent">
                  <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-70`} />
                  <DemoThumbnail demo={exercise.demo} className="absolute inset-4 border-0 bg-transparent" />
                  <div className="absolute top-3 left-3">
                    <Chip tone={DIFFICULTY_TONE[exercise.difficulty]}>{exercise.difficulty}</Chip>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Chip tone="neutral">
                      {exercise.cameraView === 'front' ? 'Front cam' : exercise.cameraView === 'side' ? 'Side cam' : 'Angled cam'}
                    </Chip>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <ExerciseGlyph id={exercise.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-base font-semibold text-white">{exercise.name}</h2>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {exercise.focus.map((area) => FOCUS_LABELS[area]).join(' · ')}
                      </p>
                    </div>
                    <ChevronRight size={16} className="mt-1 shrink-0 text-slate-600 transition group-hover:text-white" />
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">{exercise.summary}</p>
                  <div className="mt-auto flex items-center justify-between border-t border-white/6 pt-3">
                    <span className="font-mono text-[11px] text-slate-400">
                      {exercise.metric === 'time'
                        ? `${exercise.targetSeconds}s hold`
                        : `${exercise.targetReps} reps`}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {record
                        ? `Best ${exercise.metric === 'time' ? `${record.bestHoldSeconds}s` : `${record.bestReps} reps`}`
                        : 'New for you'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
