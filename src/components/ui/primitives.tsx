import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'app-button-primary',
  secondary: 'app-button-secondary',
  ghost: 'app-button-ghost',
  danger: 'app-button-danger',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', icon, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        VARIANT_CLASS[variant],
        size === 'sm' && 'px-3.5 py-2 text-xs',
        size === 'lg' && 'px-7 py-4 text-base',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={clsx(
        VARIANT_CLASS[variant],
        size === 'sm' && 'px-3.5 py-2 text-xs',
        size === 'lg' && 'px-7 py-4 text-base',
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

export function Card({
  children,
  className,
  strong,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return <div className={clsx(strong ? 'app-panel-strong' : 'app-panel', className)}>{children}</div>;
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'lime' | 'violet' | 'sky' | 'amber' | 'rose' | 'mint';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-white/10 bg-white/[0.05] text-slate-300',
    lime: 'border-lime-400/30 bg-lime-400/10 text-lime-300',
    violet: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
    sky: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    mint: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = 'lime',
  className,
  height = 'h-2',
}: {
  value: number;
  tone?: 'lime' | 'violet' | 'sky' | 'amber';
  className?: string;
  height?: string;
}) {
  const tones: Record<string, string> = {
    lime: 'from-lime-400 to-emerald-400',
    violet: 'from-violet-400 to-fuchsia-400',
    sky: 'from-sky-400 to-cyan-300',
    amber: 'from-amber-400 to-orange-400',
  };
  return (
    <div className={clsx('w-full overflow-hidden rounded-full bg-white/8', height, className)}>
      <div
        className={clsx('h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out', tones[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function Ring({
  progress,
  size = 132,
  stroke = 10,
  tone = '#c8ff4d',
  track = 'rgba(255,255,255,0.08)',
  children,
  className,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  tone?: string;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 500ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'lime' | 'violet' | 'sky';
}) {
  const tones: Record<string, string> = {
    neutral: 'text-white',
    lime: 'text-lime-300',
    violet: 'text-violet-300',
    sky: 'text-sky-300',
  };
  return (
    <div className="app-panel flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between">
        <span className="app-label">{label}</span>
        {icon ? <span className="text-slate-500">{icon}</span> : null}
      </div>
      <div className={clsx('font-display text-3xl leading-none font-semibold', tones[tone])}>{value}</div>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="app-label mb-1">{eyebrow}</p> : null}
        <h2 className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx('inline-flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-ink-900/70 p-1', className)}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'rounded-xl px-3.5 py-2 text-xs font-semibold transition',
            value === option.value
              ? 'bg-lime-400 text-ink-950 shadow-[0_8px_24px_-12px_rgba(200,255,77,0.9)]'
              : 'text-slate-400 hover:bg-white/5 hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-slate-500">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-lime-400' : 'bg-white/15',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-ink-950 transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="app-panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? <div className="text-slate-500">{icon}</div> : null}
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      <p className="max-w-md text-sm text-slate-400">{description}</p>
      {action}
    </div>
  );
}
