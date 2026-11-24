import clsx from 'clsx';
import {
  ArrowUp,
  Blocks,
  Crosshair,
  Dumbbell,
  Flame,
  Footprints,
  Hand,
  Minus,
  Mountain,
  Move,
  MoveHorizontal,
  MoveUpRight,
  RotateCw,
  Scale,
  Sparkles,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ExerciseId } from '@/exercises/types';

interface ExerciseTheme {
  icon: LucideIcon;
  gradient: string;
  ring: string;
}

const THEMES: Record<ExerciseId, ExerciseTheme> = {
  squat: { icon: Footprints, gradient: 'from-lime-400/25 via-emerald-500/10 to-transparent', ring: 'text-lime-300' },
  'knee-raise': { icon: MoveUpRight, gradient: 'from-cyan-400/25 via-sky-500/10 to-transparent', ring: 'text-cyan-300' },
  'arm-raise': { icon: ArrowUp, gradient: 'from-violet-400/25 via-fuchsia-500/10 to-transparent', ring: 'text-violet-300' },
  'jumping-jack': { icon: Sparkles, gradient: 'from-amber-400/25 via-orange-500/10 to-transparent', ring: 'text-amber-300' },
  'wall-sit': { icon: Blocks, gradient: 'from-emerald-400/25 via-teal-500/10 to-transparent', ring: 'text-emerald-300' },
  'torso-twist': { icon: RotateCw, gradient: 'from-violet-400/25 via-purple-500/10 to-transparent', ring: 'text-violet-300' },
  lunge: { icon: Footprints, gradient: 'from-sky-400/25 via-blue-500/10 to-transparent', ring: 'text-sky-300' },
  'push-up': { icon: Dumbbell, gradient: 'from-rose-400/25 via-pink-500/10 to-transparent', ring: 'text-rose-300' },
  'wide-push-up': { icon: Dumbbell, gradient: 'from-rose-400/25 via-red-500/10 to-transparent', ring: 'text-rose-300' },
  'diamond-push-up': { icon: Crosshair, gradient: 'from-fuchsia-400/25 via-rose-500/10 to-transparent', ring: 'text-fuchsia-300' },
  plank: { icon: Minus, gradient: 'from-cyan-400/25 via-teal-500/10 to-transparent', ring: 'text-cyan-300' },
  'high-knees': { icon: Zap, gradient: 'from-amber-400/25 via-yellow-500/10 to-transparent', ring: 'text-amber-300' },
  'mountain-climbers': { icon: Mountain, gradient: 'from-emerald-400/25 via-lime-500/10 to-transparent', ring: 'text-emerald-300' },
  burpee: { icon: Flame, gradient: 'from-orange-400/25 via-red-500/10 to-transparent', ring: 'text-orange-300' },
  'jump-squat': { icon: ArrowUp, gradient: 'from-lime-400/25 via-green-500/10 to-transparent', ring: 'text-lime-300' },
  'side-lunge': { icon: MoveHorizontal, gradient: 'from-sky-400/25 via-cyan-500/10 to-transparent', ring: 'text-sky-300' },
  'single-leg-balance': { icon: Scale, gradient: 'from-violet-400/25 via-indigo-500/10 to-transparent', ring: 'text-violet-300' },
  'plank-shoulder-tap': { icon: Hand, gradient: 'from-amber-400/25 via-orange-500/10 to-transparent', ring: 'text-amber-300' },
};

export function exerciseTheme(id: ExerciseId): ExerciseTheme {
  return THEMES[id] ?? { icon: Move, gradient: 'from-white/10 to-transparent', ring: 'text-slate-300' };
}

export function ExerciseGlyph({
  id,
  size = 'md',
  className,
}: {
  id: ExerciseId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const theme = exerciseTheme(id);
  const Icon = theme.icon;
  const sizes = {
    sm: 'h-9 w-9 rounded-xl',
    md: 'h-12 w-12 rounded-2xl',
    lg: 'h-16 w-16 rounded-3xl',
  };
  const iconSizes = { sm: 16, md: 20, lg: 28 };
  return (
    <span
      className={clsx(
        'relative flex shrink-0 items-center justify-center border border-white/10 bg-gradient-to-br',
        theme.gradient,
        sizes[size],
        className,
      )}
    >
      <Icon size={iconSizes[size]} className={theme.ring} strokeWidth={2.2} />
    </span>
  );
}

export function TimerGlyph({ className }: { className?: string }) {
  return <Timer className={className} />;
}
