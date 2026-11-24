import clsx from 'clsx';
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Flame,
  Home,
  LineChart,
  Mountain,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAppData } from '@/store/AppDataProvider';
import { dailyGoalProgress, levelInfo, streakInfo } from '@/services/GameProgression';
import { ProgressBar } from '@/components/ui/primitives';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell },
  { to: '/adventure', label: 'Adventure', icon: Mountain },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/achievements', label: 'Awards', icon: Trophy },
];

export function AppShell() {
  const { data } = useAppData();
  const level = levelInfo(data.player.xp);
  const streak = streakInfo(data.player.workoutDates);
  const goal = dailyGoalProgress(data);

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-white/6 bg-ink-950/70 px-4 py-6 backdrop-blur-xl lg:flex">
        <NavLink to="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-400 text-ink-950 shadow-[0_12px_34px_-14px_rgba(200,255,77,0.9)]">
            <Activity size={20} strokeWidth={2.6} />
          </span>
          <span>
            <span className="block font-display text-[15px] leading-tight font-semibold text-white">
              AI Motion Trainer
            </span>
            <span className="block text-[10px] font-medium tracking-[0.18em] text-slate-500 uppercase">
              Camera fitness game
            </span>
          </span>
        </NavLink>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-lime-300' : 'text-slate-500'} />
                  {label}
                  {label === 'Home' && streak.activeToday ? (
                    <Flame size={13} className="ml-auto text-amber-400" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="app-label">Daily goal</span>
              <span className="font-mono text-[11px] text-lime-300">{goal.xp}/{goal.goal} XP</span>
            </div>
            <ProgressBar value={goal.progress} height="h-1.5" />
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500">
              <Flame size={12} className={streak.current > 0 ? 'text-amber-400' : 'text-slate-600'} />
              {streak.current > 0 ? `${streak.current}-day streak` : 'Start a streak today'}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-3xl border border-white/8 bg-gradient-to-br from-violet-500/12 to-transparent p-4">
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-violet-400/50 font-display text-sm font-bold text-violet-200">
              {level.level}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">{level.title}</p>
              <p className="mb-1.5 truncate font-mono text-[10px] text-slate-500">
                {level.xpIntoLevel}/{level.nextLevelXp - level.currentLevelXp} XP
              </p>
              <ProgressBar value={level.progress} tone="violet" height="h-1" />
            </div>
          </div>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs font-medium transition',
                isActive ? 'bg-white/[0.07] text-white' : 'text-slate-500 hover:text-slate-200',
              )
            }
          >
            <Settings size={15} /> Settings & privacy
          </NavLink>
          <p className="px-3 text-[10px] leading-relaxed text-slate-600">
            Video is processed locally. Nothing is uploaded.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/6 bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-ink-950">
                <Activity size={18} strokeWidth={2.6} />
              </span>
              <span className="font-display text-sm font-semibold text-white">AI Motion Trainer</span>
            </NavLink>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                <Flame size={12} /> {streak.current}
              </span>
              <NavLink to="/settings" className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300">
                <Settings size={16} />
              </NavLink>
            </div>
          </div>
          <nav className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                    isActive
                      ? 'bg-lime-400 text-ink-950'
                      : 'border border-white/8 bg-white/[0.04] text-slate-400',
                  )
                }
              >
                <Icon size={13} /> {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>

        <footer className="hidden border-t border-white/5 px-10 py-5 text-[11px] text-slate-600 lg:block">
          <span className="flex items-center gap-2">
            <Sparkles size={12} className="text-lime-400/70" />
            Built with MediaPipe Pose Landmarker · All pose estimation runs locally in your browser
          </span>
        </footer>
      </div>
    </div>
  );
}
