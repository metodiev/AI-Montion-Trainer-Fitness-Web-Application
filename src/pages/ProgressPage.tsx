import { useMemo } from 'react';
import { Clock, Flame, Sparkles, Target, TrendingUp, Trophy } from 'lucide-react';
import { useAppData } from '@/store/AppDataProvider';
import { getExercise } from '@/exercises/definitions';
import { personalRecords, dailySeries, exerciseStats, totalStats, weeklySeries, formatMinutes } from '@/services/StatisticsService';
import { Card, Chip, EmptyState, ProgressBar, SectionHeader, StatTile } from '@/components/ui/primitives';
import { TechniqueTrendChart, WeeklyLoadChart, WeeklyXpChart } from '@/components/charts/Charts';
import { ExerciseGlyph } from '@/components/ExerciseArt';
import { Link } from 'react-router-dom';

export function ProgressPage() {
  const { data } = useAppData();
  const stats = useMemo(() => totalStats(data.history), [data.history]);
  const days = useMemo(() => dailySeries(data.history, 7), [data.history]);
  const weeks = useMemo(() => weeklySeries(data.history, 8), [data.history]);
  const records = useMemo(() => personalRecords(data.history), [data.history]);
  const exercises = useMemo(() => exerciseStats(data.history), [data.history]);

  const recordEntries = Object.entries(records).sort((a, b) => (b[1]?.bestReps ?? 0) - (a[1]?.bestReps ?? 0));
  const exerciseEntries = Object.values(exercises).sort((a, b) => b.totalXp - a.totalXp);
  const bestScore = Math.max(0, ...data.history.map((record) => record.averageScore));

  if (data.history.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="app-label mb-1">Progress</p>
          <h1 className="app-title">Your training story</h1>
        </header>
        <EmptyState
          icon={<TrendingUp size={28} />}
          title="No workouts yet"
          description="Complete your first camera session and this page will fill up with XP charts, technique trends, personal records and workout history."
          action={
            <Link to="/train/daily" className="app-button-primary mt-2">
              Start a workout
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="app-label mb-1">Progress</p>
          <h1 className="app-title">Your training story</h1>
          <p className="app-muted mt-2">
            {stats.workouts} sessions · {Math.round(stats.minutes)} minutes · {stats.reps} repetitions
          </p>
        </div>
        <div className="flex gap-2">
          <Chip tone="lime">
            <Sparkles size={11} /> Best {bestScore}% technique
          </Chip>
          <Chip tone="violet">
            <Trophy size={11} /> {data.player.points} points
          </Chip>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total XP" value={stats.xp} hint="Earned across all sessions" icon={<TrendingUp size={16} />} tone="lime" />
        <StatTile label="Minutes" value={Math.round(stats.minutes)} hint="Active tracked time" icon={<Clock size={16} />} tone="sky" />
        <StatTile label="Clean reps" value={stats.cleanReps} hint={`${Math.round((stats.cleanReps / Math.max(1, stats.reps)) * 100)}% of all reps`} icon={<Target size={16} />} tone="violet" />
        <StatTile label="Calories" value={stats.calories} hint="Estimated from movement METs" icon={<Flame size={16} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeader eyebrow="Last 7 days" title="XP earned" />
          <WeeklyXpChart data={days} />
        </Card>
        <Card className="p-6">
          <SectionHeader eyebrow="Last 8 weeks" title="Technique trend" />
          <TechniqueTrendChart data={weeks} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-6">
          <SectionHeader eyebrow="This week" title="Training load" />
          <WeeklyLoadChart data={days} />
          <div className="mt-4 space-y-2">
            {days.map((day) => (
              <div key={day.dateKey} className="flex items-center gap-3">
                <span className="w-8 font-mono text-[10px] text-slate-500">{day.label}</span>
                <ProgressBar
                  value={Math.min(1, day.minutes / 30)}
                  height="h-1.5"
                  tone={day.workouts > 0 ? 'lime' : 'sky'}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono text-[10px] text-slate-500">
                  {day.minutes > 0 ? formatMinutes(day.minutes * 60) : '—'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader eyebrow="Personal records" title="Your best sets" />
          <div className="overflow-hidden rounded-2xl border border-white/8">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] text-[10px] tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Exercise</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Best reps</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Best hold</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {recordEntries.slice(0, 8).map(([exerciseId, record]) => {
                  if (!record) return null;
                  const exercise = getExercise(exerciseId as never);
                  return (
                    <tr key={exerciseId} className="border-t border-white/6">
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <ExerciseGlyph id={exercise.id} size="sm" className="h-7 w-7 rounded-lg" />
                          <span className="font-medium text-slate-200">{exercise.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                        {record.bestReps > 0 ? record.bestReps : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                        {record.bestHoldSeconds > 0 ? `${record.bestHoldSeconds}s` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-lime-300">{record.bestScore}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <SectionHeader eyebrow="All-time" title="Exercise breakdown" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exerciseEntries.slice(0, 9).map((entry) => {
            const exercise = getExercise(entry.exerciseId as never);
            return (
              <div key={entry.exerciseId} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <div className="flex items-center gap-3">
                  <ExerciseGlyph id={exercise.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{exercise.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {entry.sets} sets · last {entry.lastPerformed ?? '—'}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-lime-300">{entry.bestScore}%</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-display text-base font-semibold text-white">{entry.reps}</p>
                    <p className="text-[9px] tracking-wide text-slate-500 uppercase">Reps</p>
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold text-white">{Math.round(entry.holdSeconds)}s</p>
                    <p className="text-[9px] tracking-wide text-slate-500 uppercase">Holds</p>
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold text-white">{entry.totalXp}</p>
                    <p className="text-[9px] tracking-wide text-slate-500 uppercase">XP</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <SectionHeader eyebrow="Journal" title="Recent workouts" />
        <div className="space-y-2">
          {data.history.slice(0, 12).map((record) => (
            <div
              key={record.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-400/12 text-[10px] font-bold text-lime-300 uppercase">
                {record.mode.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{record.title}</p>
                <p className="text-[10px] text-slate-500">
                  {new Date(record.completedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {Math.round(record.durationSec / 60)} min · {record.totalReps} reps
                </p>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <p className="font-mono text-xs font-semibold text-lime-300">{record.averageScore}%</p>
                  <p className="text-[9px] tracking-wide text-slate-500 uppercase">Form</p>
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold text-violet-300">+{record.xp}</p>
                  <p className="text-[9px] tracking-wide text-slate-500 uppercase">XP</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
