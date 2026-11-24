import { ArrowRight, Crown, Flame, Lock, Mountain, Play, Star, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ADVENTURE_LEVELS, isLevelUnlocked, nextAdventureLevel } from '@/game/adventure';
import { levelInfo } from '@/services/GameProgression';
import { useAppData } from '@/store/AppDataProvider';
import { Card, Chip, ProgressBar } from '@/components/ui/primitives';
import { getExercise } from '@/exercises/definitions';

const EMBLEMS: Record<string, typeof Star> = {
  sunrise: Star,
  wind: Zap,
  mountain: Mountain,
  footsteps: ArrowRight,
  shield: Crown,
  zap: Zap,
  flame: Flame,
  crown: Crown,
};

export function AdventurePage() {
  const { data } = useAppData();
  const level = levelInfo(data.player.xp);
  const next = nextAdventureLevel(data.player.adventure, level.level);
  const totalStars = Object.values(data.player.adventure).reduce((sum, entry) => sum + entry.stars, 0);
  const completed = Object.values(data.player.adventure).filter((entry) => entry.stars > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="app-label mb-1">Fitness adventure</p>
          <h1 className="app-title">Climb the summit</h1>
          <p className="app-muted mt-2 max-w-2xl">
            Eight levels of escalating difficulty. Clear every exercise target to earn stars — three
            stars need 92% average technique.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="app-panel flex items-center gap-3 px-4 py-3">
            <Star size={18} className="text-amber-300" />
            <div>
              <p className="font-display text-lg font-semibold text-white">{totalStars}</p>
              <p className="app-label">Stars</p>
            </div>
          </div>
          <div className="app-panel flex items-center gap-3 px-4 py-3">
            <Mountain size={18} className="text-violet-300" />
            <div>
              <p className="font-display text-lg font-semibold text-white">
                {completed}/{ADVENTURE_LEVELS.length}
              </p>
              <p className="app-label">Cleared</p>
            </div>
          </div>
        </div>
      </header>

      {next ? (
        <Card className="relative overflow-hidden border-lime-400/20 p-6" strong>
          <div className="pointer-events-none absolute -top-20 -right-10 h-64 w-64 rounded-full bg-lime-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/25 bg-lime-400/10">
                <Mountain size={24} className="text-lime-300" />
              </div>
              <div>
                <p className="app-label">Up next</p>
                <h2 className="font-display text-xl font-semibold text-white">
                  {next.index}. {next.name}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{next.description}</p>
              </div>
            </div>
            <Link
              to={`/train/adventure?level=${next.id}`}
              className="app-button-primary shrink-0"
            >
              <Play size={15} /> Start level
            </Link>
          </div>
          <div className="relative mt-4">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Overall adventure progress</span>
              <span className="font-mono">
                {completed}/{ADVENTURE_LEVELS.length} levels
              </span>
            </div>
            <ProgressBar value={completed / ADVENTURE_LEVELS.length} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ADVENTURE_LEVELS.map((adventureLevel) => {
          const progress = data.player.adventure[adventureLevel.id];
          const unlocked = isLevelUnlocked(adventureLevel, data.player.adventure, level.level);
          const stars = progress?.stars ?? 0;
          const Emblem = EMBLEMS[adventureLevel.emblem] ?? Mountain;
          const prerequisite = adventureLevel.requiredPrevious
            ? ADVENTURE_LEVELS.find((entry) => entry.id === adventureLevel.requiredPrevious)
            : null;

          return (
            <Card
              key={adventureLevel.id}
              className={`relative flex flex-col overflow-hidden p-5 ${
                unlocked ? 'hover:border-white/20' : 'opacity-70'
              }`}
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${adventureLevel.gradient}`} />
              <div className="relative flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-ink-900/60">
                  {unlocked ? (
                    <Emblem size={20} className="text-white" />
                  ) : (
                    <Lock size={18} className="text-slate-500" />
                  )}
                </span>
                <span className="font-display text-3xl font-semibold text-white/15">
                  {String(adventureLevel.index).padStart(2, '0')}
                </span>
              </div>

              <div className="relative mt-4 flex-1">
                <h3 className="font-display text-base font-semibold text-white">{adventureLevel.name}</h3>
                <p className="mt-0.5 text-[11px] font-medium tracking-wide text-lime-200/80 uppercase">
                  {adventureLevel.tagline}
                </p>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
                  {adventureLevel.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {adventureLevel.exercises.slice(0, 4).map((entry) => (
                    <span
                      key={entry.id}
                      className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-400"
                    >
                      {getExercise(entry.id).name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={star <= stars ? 'fill-amber-300 text-amber-300' : 'text-slate-700'}
                      />
                    ))}
                  </div>
                  <Chip tone={adventureLevel.difficulty === 'beginner' ? 'lime' : adventureLevel.difficulty === 'intermediate' ? 'sky' : 'amber'}>
                    {adventureLevel.difficulty}
                  </Chip>
                </div>

                {unlocked ? (
                  <Link
                    to={`/train/adventure?level=${adventureLevel.id}`}
                    className={`app-button w-full ${
                      stars > 0 ? 'border border-white/12 bg-white/[0.05] text-white' : 'bg-lime-400 text-ink-950'
                    }`}
                  >
                    {stars > 0 ? 'Replay level' : 'Start level'} <ArrowRight size={14} />
                  </Link>
                ) : (
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-center text-[11px] text-slate-500">
                    {prerequisite
                      ? `Earn a star in ${prerequisite.name}`
                      : 'Keep training to unlock'}
                    {adventureLevel.requiredLevel > level.level
                      ? ` · reach level ${adventureLevel.requiredLevel}`
                      : ''}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
