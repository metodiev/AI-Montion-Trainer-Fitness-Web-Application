import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Flame,
  Gauge,
  Mountain,
  Play,
  Sparkles,
  Target,
  Trophy,
  Wand2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { EXERCISE_DEFINITIONS } from '@/exercises/definitions';
import { ACHIEVEMENTS } from '@/game/achievements';
import { ADVENTURE_LEVELS, isLevelUnlocked, nextAdventureLevel } from '@/game/adventure';
import { useAppData } from '@/store/AppDataProvider';
import { dailyGoalProgress, levelInfo, streakInfo, weeklyGoalProgress } from '@/services/GameProgression';
import { dailySeries, personalRecords, totalStats, toDateKey } from '@/services/StatisticsService';
import { generateDailyChallenge } from '@/services/WorkoutPlanner';
import { ButtonLink, Card, Chip, ProgressBar, Ring, SectionHeader, StatTile } from '@/components/ui/primitives';
import { ExerciseGlyph } from '@/components/ExerciseArt';
import { WeeklyXpChart } from '@/components/charts/Charts';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late-night session';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { data } = useAppData();
  const level = levelInfo(data.player.xp);
  const streak = streakInfo(data.player.workoutDates);
  const goal = dailyGoalProgress(data);
  const week = weeklyGoalProgress(data);
  const stats = totalStats(data.history);
  const records = personalRecords(data.history);
  const weekSeries = dailySeries(data.history, 7);
  const todayKey = toDateKey();
  const daily = generateDailyChallenge(todayKey, level.level);
  const dailyDone = data.history.some((record) => record.dailyKey === todayKey);
  const adventure = nextAdventureLevel(data.player.adventure, level.level);
  const unlockedLevels = ADVENTURE_LEVELS.filter((levelItem) =>
    isLevelUnlocked(levelItem, data.player.adventure, level.level),
  ).length;
  const unlockedAchievements = Object.keys(data.player.achievements).length;
  const recent = data.history[0];

  const suggested = EXERCISE_DEFINITIONS.filter((exercise) => {
    if (level.level <= 2) return exercise.difficulty === 'beginner';
    if (level.level <= 4) return exercise.difficulty !== 'advanced';
    return true;
  }).slice(0, 4);

  return (
    <div className="flex flex-col gap-7">
      <section className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card className="relative overflow-hidden p-6 sm:p-8" strong>
          <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-lime-400/12 blur-3xl" />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="lime">
                <Sparkles size={12} /> {greeting()}
              </Chip>
              {streak.activeToday ? (
                <Chip tone="amber">
                  <Flame size={12} /> {streak.current}-day streak
                </Chip>
              ) : null}
              <Chip tone="violet">
                Level {level.level} · {level.title}
              </Chip>
            </div>

            <div>
              <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-white sm:text-5xl">
                Your body is the
                <span className="text-lime-300 text-glow-lime"> controller.</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                Step in front of the camera and let your AI coach count reps, score your technique and
                turn today&apos;s workout into a game.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink to="/train/daily" size="lg" icon={<Play size={17} />}>
                {dailyDone ? 'Repeat daily challenge' : 'Start daily challenge'}
              </ButtonLink>
              <ButtonLink to="/planner" variant="secondary" size="lg" icon={<Wand2 size={16} />}>
                Build a workout
              </ButtonLink>
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock size={13} /> {daily.config.estimatedMinutes} min · {daily.config.blocks.filter((b) => b.kind === 'exercise').length} movements
              </span>
            </div>

            <div className="flex flex-wrap gap-6 border-t border-white/8 pt-5">
              <div>
                <p className="app-label">Today</p>
                <p className="font-display text-xl font-semibold text-white">
                  {goal.xp}
                  <span className="text-sm font-normal text-slate-500"> / {goal.goal} XP</span>
                </p>
              </div>
              <div>
                <p className="app-label">This week</p>
                <p className="font-display text-xl font-semibold text-white">
                  {week.workouts}
                  <span className="text-sm font-normal text-slate-500"> / {week.target} sessions</span>
                </p>
              </div>
              <div>
                <p className="app-label">Total reps</p>
                <p className="font-display text-xl font-semibold text-white">{stats.reps}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center gap-5 p-6">
          <div className="relative">
            <Ring progress={level.progress} size={170} stroke={12}>
              <span className="app-label">Level</span>
              <span className="font-display text-5xl leading-none font-semibold text-white">{level.level}</span>
              <span className="mt-1 text-[11px] font-medium text-lime-300">{level.title}</span>
            </Ring>
          </div>
          <div className="w-full">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Next level</span>
              <span className="font-mono">
                {level.xpIntoLevel}/{level.nextLevelXp - level.currentLevelXp} XP
              </span>
            </div>
            <ProgressBar value={level.progress} height="h-2" />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <p className="font-display text-lg font-semibold text-amber-300">{streak.current}</p>
              <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Day streak</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <p className="font-display text-lg font-semibold text-violet-300">{data.player.points}</p>
              <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Points</p>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader
          eyebrow="Game modes"
          title="Choose your run"
          action={
            <Link to="/exercises" className="flex items-center gap-1 text-xs font-semibold text-lime-300 hover:text-lime-200">
              All exercises <ChevronRight size={14} />
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ModeCard
            to="/train/daily"
            icon={<CalendarDays size={18} />}
            title="Daily Challenge"
            description="A fresh 10-minute session tuned to your level."
            accent="lime"
            meta={dailyDone ? 'Completed today' : 'Not started'}
          />
          <ModeCard
            to={adventure ? `/train/adventure?level=${adventure.id}` : '/adventure'}
            icon={<Mountain size={18} />}
            title="Fitness Adventure"
            description="Climb eight levels, earn stars and unlock the summit."
            accent="violet"
            meta={`${unlockedLevels}/${ADVENTURE_LEVELS.length} unlocked`}
          />
          <ModeCard
            to={`/train/endurance?exercise=${recent?.exercises[0]?.exerciseId ?? 'squat'}`}
            icon={<Gauge size={18} />}
            title="Endurance"
            description="As many clean reps as possible in 60 seconds."
            accent="sky"
            meta="60s time limit"
          />
          <ModeCard
            to={`/train/precision?exercise=${recent?.exercises[0]?.exerciseId ?? 'squat'}`}
            icon={<Target size={18} />}
            title="Precision"
            description="Technique is the score. Chase a perfect set."
            accent="amber"
            meta="Aim for 85%+"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <SectionHeader eyebrow="Last 7 days" title="Training momentum" />
          <WeeklyXpChart data={weekSeries} />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MiniStat label="Sessions" value={`${weekSeries.reduce((sum, day) => sum + day.workouts, 0)}`} />
            <MiniStat label="Minutes" value={`${Math.round(weekSeries.reduce((sum, day) => sum + day.minutes, 0))}`} />
            <MiniStat label="Reps" value={`${weekSeries.reduce((sum, day) => sum + day.reps, 0)}`} />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <SectionHeader eyebrow="Your goal" title="Daily ring" />
          <div className="flex items-center gap-5">
            <Ring progress={goal.progress} size={116} stroke={10} tone={goal.met ? '#34d399' : '#c8ff4d'}>
              <span className="font-display text-2xl font-semibold text-white">
                {Math.round(goal.progress * 100)}%
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 uppercase">XP goal</span>
            </Ring>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-slate-400">Earned today</p>
                <p className="font-display text-2xl font-semibold text-white">{goal.xp} XP</p>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                {goal.met
                  ? 'Goal complete — anything more is bonus XP.'
                  : `${Math.max(0, goal.goal - goal.xp)} XP to go. A clean workout usually covers it.`}
              </p>
            </div>
          </div>
          <div className="app-divider" />
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Trophy size={14} className="text-amber-300" /> Achievements
            </span>
            <span className="font-mono text-slate-300">
              {unlockedAchievements}/{ACHIEVEMENTS.length}
            </span>
          </div>
          <ProgressBar value={unlockedAchievements / ACHIEVEMENTS.length} tone="amber" height="h-1.5" />
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Mountain size={14} className="text-violet-300" /> Adventure
            </span>
            <span className="font-mono text-slate-300">
              {Object.values(data.player.adventure).reduce((sum, item) => sum + item.stars, 0)} stars
            </span>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader
          eyebrow="Jump back in"
          title="Quick training"
          action={
            <ButtonLink to="/exercises" variant="ghost" size="sm">
              Browse all
            </ButtonLink>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {suggested.map((exercise) => {
            const record = records[exercise.id];
            return (
              <Card key={exercise.id} className="group flex flex-col gap-4 p-5 transition hover:border-white/20">
                <div className="flex items-start justify-between">
                  <ExerciseGlyph id={exercise.id} />
                  <Chip tone={exercise.difficulty === 'beginner' ? 'lime' : exercise.difficulty === 'intermediate' ? 'sky' : 'amber'}>
                    {exercise.difficulty}
                  </Chip>
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-white">{exercise.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{exercise.summary}</p>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-mono text-[11px] text-slate-500">
                    {exercise.metric === 'time'
                      ? `${exercise.targetSeconds}s target`
                      : `${exercise.targetReps} reps`}
                    {record ? ` · best ${record.bestReps || record.bestHoldSeconds}` : ''}
                  </span>
                  <Link
                    to={`/train/free?exercise=${exercise.id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-lime-300 transition group-hover:text-lime-200"
                  >
                    Train <ArrowRight size={13} />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Workouts" value={stats.workouts} hint="All-time sessions" icon={<CalendarDays size={16} />} />
        <StatTile label="Minutes" value={Math.round(stats.minutes)} hint="Time under the camera" icon={<Clock size={16} />} tone="sky" />
        <StatTile label="Clean reps" value={stats.cleanReps} hint={`of ${stats.reps} total reps`} icon={<Target size={16} />} tone="lime" />
        <StatTile label="Technique" value={`${stats.averageScore}%`} hint="Weighted set average" icon={<Sparkles size={16} />} tone="violet" />
      </section>
    </div>
  );
}

function ModeCard({
  to,
  icon,
  title,
  description,
  meta,
  accent,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  meta: string;
  accent: 'lime' | 'violet' | 'sky' | 'amber';
}) {
  const accents: Record<string, string> = {
    lime: 'from-lime-400/18 text-lime-300 border-lime-400/20',
    violet: 'from-violet-400/18 text-violet-300 border-violet-400/20',
    sky: 'from-sky-400/18 text-sky-300 border-sky-400/20',
    amber: 'from-amber-400/18 text-amber-300 border-amber-400/20',
  };
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className={`pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-gradient-to-br ${accents[accent]} opacity-60 blur-2xl`} />
      <span className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border bg-white/[0.04] ${accents[accent]}`}>
        {icon}
      </span>
      <h3 className="relative mt-4 font-display text-base font-semibold text-white">{title}</h3>
      <p className="relative mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
      <div className="relative mt-4 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-wide text-slate-500 uppercase">{meta}</span>
        <ArrowRight size={14} className="text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
      </div>
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
      <p className="font-display text-lg font-semibold text-white">{value}</p>
      <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
    </div>
  );
}
