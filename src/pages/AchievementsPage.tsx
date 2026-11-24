import { useMemo } from 'react';
import {
  Activity,
  Award,
  Calendar,
  CalendarCheck,
  ChevronRight,
  Crown,
  Crosshair,
  Flame,
  Footprints,
  Gauge,
  Hourglass,
  LayoutGrid,
  Mountain,
  Star,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ACHIEVEMENTS } from '@/game/achievements';
import { streakInfo } from '@/services/GameProgression';
import { useAppData } from '@/store/AppDataProvider';
import { Card, Chip, ProgressBar, SectionHeader } from '@/components/ui/primitives';

const ICONS: Record<string, LucideIcon> = {
  sparkles: Star,
  calendar: Calendar,
  'calendar-check': CalendarCheck,
  trophy: Trophy,
  crown: Crown,
  flame: Flame,
  target: Target,
  zap: Zap,
  shield: Award,
  star: Star,
  footsteps: Footprints,
  'chevrons-up': TrendingUp,
  timer: Timer,
  activity: Activity,
  mountain: Mountain,
  'trending-up': TrendingUp,
  award: Award,
  crosshair: Crosshair,
  gauge: Gauge,
  'layout-grid': LayoutGrid,
  hourglass: Hourglass,
};


const TIER_TONE: Record<string, 'amber' | 'sky' | 'lime'> = {
  bronze: 'amber',
  silver: 'sky',
  gold: 'lime',
};

export function AchievementsPage() {
  const { data } = useAppData();
  const streak = streakInfo(data.player.workoutDates);
  const unlocked = ACHIEVEMENTS.filter((achievement) => data.player.achievements[achievement.id]);
  const locked = ACHIEVEMENTS.filter((achievement) => !data.player.achievements[achievement.id]);
  const progress = useMemo(() => unlocked.length / ACHIEVEMENTS.length, [unlocked.length]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="app-label mb-1">Achievements</p>
          <h1 className="app-title">Trophy cabinet</h1>
          <p className="app-muted mt-2 max-w-2xl">
            Technique and consistency earn every badge. {unlocked.length} of {ACHIEVEMENTS.length}{' '}
            unlocked{streak.longest > 1 ? ` · best streak ${streak.longest} days` : ''}.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Collection</span>
            <span className="font-mono">{Math.round(progress * 100)}%</span>
          </div>
          <ProgressBar value={progress} tone="amber" />
        </div>
      </header>

      <section>
        <SectionHeader eyebrow="Unlocked" title={`${unlocked.length} badges earned`} />
        {unlocked.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-slate-400">
              No badges yet. Complete a workout and the first one lands instantly.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unlocked.map((achievement) => {
              const Icon = ICONS[achievement.icon] ?? Trophy;
              return (
                <Card
                  key={achievement.id}
                  className="relative flex items-start gap-4 overflow-hidden border-amber-400/15 bg-gradient-to-br from-amber-400/[0.07] to-transparent p-5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/12 text-amber-200">
                    <Icon size={22} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-semibold text-white">{achievement.name}</h3>
                      <Chip tone={TIER_TONE[achievement.tier]}>{achievement.tier}</Chip>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{achievement.description}</p>
                    <p className="mt-2 font-mono text-[10px] text-slate-500">
                      Earned{' '}
                      {data.player.achievements[achievement.id]
                        ? new Date(data.player.achievements[achievement.id]).toLocaleDateString()
                        : 'recently'}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionHeader eyebrow="Next up" title={`${locked.length} still to earn`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {locked.map((achievement) => {
            const Icon = ICONS[achievement.icon] ?? Trophy;
            return (
              <Card key={achievement.id} className="flex items-start gap-4 border-white/6 bg-white/[0.02] p-5 opacity-80">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-500">
                  <Icon size={22} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-semibold text-slate-200">{achievement.name}</h3>
                    <Chip tone="neutral">{achievement.tier}</Chip>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{achievement.description}</p>
                  <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                    Locked <ChevronRight size={10} />
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
