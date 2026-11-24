import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Pause, Play } from 'lucide-react';
import { interpolatePose, type DemoPose, type DemoSpec } from '@/core/skeleton';

const LINES: [keyof DemoPose['joints'], keyof DemoPose['joints'], 'left' | 'right' | 'center'][] = [
  ['head', 'neck', 'center'],
  ['neck', 'shoulderL', 'left'],
  ['neck', 'shoulderR', 'right'],
  ['shoulderL', 'shoulderR', 'center'],
  ['shoulderL', 'elbowL', 'left'],
  ['elbowL', 'wristL', 'left'],
  ['shoulderR', 'elbowR', 'right'],
  ['elbowR', 'wristR', 'right'],
  ['shoulderL', 'hipL', 'left'],
  ['shoulderR', 'hipR', 'right'],
  ['hipL', 'hipR', 'center'],
  ['hipL', 'kneeL', 'left'],
  ['kneeL', 'ankleL', 'left'],
  ['ankleL', 'footL', 'left'],
  ['hipR', 'kneeR', 'right'],
  ['kneeR', 'ankleR', 'right'],
  ['ankleR', 'footR', 'right'],
];

const COLORS = {
  left: '#38bdf8',
  right: '#a78bfa',
  center: '#e2e8f0',
};

function poseAt(spec: DemoSpec, elapsedMs: number): { pose: DemoPose; caption?: string; segment: number } {
  const frames = spec.keyframes;
  if (frames.length === 0) {
    return { pose: { joints: {} as DemoPose['joints'] }, caption: undefined, segment: 0 };
  }
  const total = frames.reduce((sum, frame) => sum + Math.max(120, frame.durationMs), 0);
  let time = spec.loop ? elapsedMs % total : Math.min(elapsedMs, total - 1);
  let index = 0;
  while (index < frames.length) {
    const duration = Math.max(120, frames[index].durationMs);
    if (time < duration) break;
    time -= duration;
    index += 1;
  }
  const safeIndex = Math.min(index, frames.length - 1);
  const current = frames[safeIndex];
  const next = frames[spec.loop ? (safeIndex + 1) % frames.length : Math.min(safeIndex + 1, frames.length - 1)];
  const duration = Math.max(120, current.durationMs);
  const t = Math.min(1, Math.max(0, time / duration));
  const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return {
    pose: interpolatePose(current.pose, next.pose, eased),
    caption: current.caption,
    segment: safeIndex,
  };
}

export function DemoPlayer({
  demo,
  className,
  compact = false,
  autoPlay = true,
}: {
  demo: DemoSpec;
  className?: string;
  compact?: boolean;
  autoPlay?: boolean;
}) {
  const [playing, setPlaying] = useState(autoPlay);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(0);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    startedRef.current = performance.now() - elapsedRef.current;
    const tick = (now: number) => {
      const value = now - startedRef.current;
      elapsedRef.current = value;
      setElapsed(value);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing]);

  const { pose, caption, segment } = useMemo(() => poseAt(demo, elapsed), [demo, elapsed]);
  const total = demo.keyframes.reduce((sum, frame) => sum + Math.max(120, frame.durationMs), 0);
  const progress = total > 0 ? (elapsed % total) / total : 0;

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-ink-800 to-ink-950',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_center,rgba(200,255,77,0.18),transparent_62%)]" />
      <svg
        viewBox="0 0 1 1"
        className="relative h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Exercise demonstration animation"
      >
        <defs>
          <linearGradient id="floor-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8ff4d" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#c8ff4d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0.08" y1="0.965" x2="0.92" y2="0.965" stroke="url(#floor-fade)" strokeWidth="0.006" />
        {demo.wall ? (
          <rect x="0.72" y="0.18" width="0.045" height="0.79" rx="0.01" fill="rgba(148,163,184,0.16)" />
        ) : null}
        {demo.view === 'side' ? (
          <line x1="0.5" y1="0.12" x2="0.5" y2="0.94" stroke="rgba(255,255,255,0.05)" strokeWidth="0.002" strokeDasharray="0.01 0.02" />
        ) : null}

        {LINES.map(([from, to, side]) => {
          const a = pose.joints[from];
          const b = pose.joints[to];
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}`}
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke={COLORS[side]}
              strokeWidth={compact ? 3 : 3.4}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={0.92}
            />
          );
        })}

        {Object.entries(pose.joints).map(([joint, point]) => {
          if (!point) return null;
          if (joint === 'head') {
            return (
              <circle
                key={joint}
                cx={point[0]}
                cy={point[1]}
                r={0.028}
                fill="#0b0f18"
                stroke="#e2e8f0"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          if (joint === 'neck') return null;
          const side = joint.endsWith('L') ? 'left' : joint.endsWith('R') ? 'right' : 'center';
          return (
            <circle
              key={joint}
              cx={point[0]}
              cy={point[1]}
              r={0.012}
              fill={COLORS[side]}
              opacity={0.95}
            />
          );
        })}
      </svg>

      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="app-chip border-white/15 bg-ink-950/70 text-[10px] text-slate-300">
          {demo.view === 'front' ? 'Front view' : 'Side view'}
        </span>
        {!demo.loop ? (
          <span className="app-chip border-violet-400/30 bg-violet-400/10 text-[10px] text-violet-200">Hold</span>
        ) : null}
      </div>

      {caption ? (
        <div className="absolute right-3 bottom-14 left-3 flex justify-center">
          <span className="rounded-full border border-white/10 bg-ink-950/75 px-3.5 py-1.5 text-center text-xs font-medium text-slate-200 backdrop-blur">
            {caption}
          </span>
        </div>
      ) : null}

      <div className="absolute right-3 bottom-3 left-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-ink-950/70 text-white transition hover:bg-white/10"
          aria-label={playing ? 'Pause demonstration' : 'Play demonstration'}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <div className="flex flex-1 items-center gap-1">
          {demo.keyframes.map((_, index) => (
            <span
              key={index}
              className={clsx(
                'h-1 flex-1 rounded-full transition-colors',
                index === segment ? 'bg-lime-400' : index < segment ? 'bg-white/40' : 'bg-white/12',
              )}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] text-slate-400">
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}
