import { Check, CircleAlert, CircleCheck, Loader2, Play, RotateCcw, ScanLine, X } from 'lucide-react';
import type { CalibrationSnapshot } from '@/core/calibration';
import type { PoseBaseline } from '@/core/types';
import { Button, Card, ProgressBar, Ring } from '@/components/ui/primitives';

const CHECKS: { key: keyof CalibrationSnapshot['checks']; label: string; hint: string }[] = [
  { key: 'bodyVisible', label: 'Whole body in frame', hint: 'Head and both feet visible' },
  { key: 'distance', label: 'Good distance', hint: 'You fill most of the frame' },
  { key: 'lighting', label: 'Clear tracking', hint: 'Joints are confidently detected' },
  { key: 'stable', label: 'Holding still', hint: 'Neutral pose is captured' },
  { key: 'posture', label: 'Standing tall', hint: 'Feet hip-width, knees soft' },
];

export function CalibrationBodyGuide({ visible, progress }: { visible: boolean; progress: number }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 100 140" className="h-[86%] w-auto opacity-70" fill="none">
        <g stroke={progress > 0.66 ? '#c8ff4d' : 'rgba(226,232,240,0.55)'} strokeWidth="1.1" strokeDasharray="4 4" strokeLinecap="round">
          <circle cx="50" cy="16" r="9" />
          <path d="M50 25v40" />
          <path d="M50 33 32 52M50 33l18 19" />
          <path d="M50 65 36 100l-4 33M50 65l14 35 4 33" />
          <path d="M23 136h18M59 136h18" />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <span className="rounded-full border border-white/10 bg-ink-950/70 px-3 py-1 text-[10px] font-semibold tracking-wide text-slate-300 uppercase backdrop-blur">
          Fit your head to feet inside the guide
        </span>
      </div>
    </div>
  );
}

export function CalibrationCoach({
  snapshot,
  baseline,
  exerciseName,
  cameraHint,
  onStart,
  onRecalibrate,
  onCancel,
  starting,
  cameraRunning,
}: {
  snapshot: CalibrationSnapshot;
  baseline: PoseBaseline | null;
  exerciseName: string;
  cameraHint: string;
  onStart: () => void;
  onRecalibrate: () => void;
  onCancel: () => void;
  starting: boolean;
  cameraRunning: boolean;
}) {
  const readyToStart = !!baseline && snapshot.phase === 'complete';
  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6" strong>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-label">Calibration</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-white">
            {readyToStart ? 'You’re ready' : 'Find your position'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:text-white"
          aria-label="Cancel workout"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
        <Ring
          progress={readyToStart ? 1 : snapshot.progress}
          size={84}
          stroke={8}
          tone={readyToStart ? '#34d399' : '#c8ff4d'}
        >
          {readyToStart ? (
            <CircleCheck size={26} className="text-emerald-300" />
          ) : (
            <span className="font-display text-lg font-semibold text-white">
              {Math.round(snapshot.progress * 100)}%
            </span>
          )}
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">{snapshot.message}</p>
          {snapshot.hints.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {snapshot.hints.map((hint) => (
                <li key={hint} className="text-[11px] leading-relaxed text-slate-500">
                  {hint}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              {baseline
                ? `Baseline locked for ${exerciseName}. Counting starts only when your body is reliably tracked.`
                : 'Calibration measures your neutral stance so every rep is judged against your own body, not a fixed pixel size.'}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {CHECKS.map((check) => {
          const passed = snapshot.checks[check.key];
          return (
            <div
              key={check.key}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                passed ? 'bg-emerald-400/[0.07]' : 'bg-white/[0.025]'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  passed
                    ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                    : 'border-white/12 bg-white/[0.03] text-slate-500'
                }`}
              >
                {passed ? <Check size={13} /> : <CircleAlert size={12} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium ${passed ? 'text-emerald-100' : 'text-slate-300'}`}>
                  {check.label}
                </p>
                <p className="text-[10px] text-slate-500">{check.hint}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!readyToStart ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <ScanLine size={12} /> Calibration hold
            </span>
            <span className="font-mono">{Math.round(snapshot.progress * 100)}%</span>
          </div>
          <ProgressBar value={snapshot.progress} height="h-1.5" />
        </div>
      ) : null}

      <div className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.05] px-4 py-3 text-[11px] leading-relaxed text-sky-100/80">
        <span className="font-semibold text-sky-200">Camera setup:</span> {cameraHint}
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onStart} disabled={!readyToStart || starting || !cameraRunning} size="lg" icon={starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}>
          {starting ? 'Starting…' : readyToStart ? 'Start workout' : 'Waiting for calibration'}
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onRecalibrate} className="flex-1" icon={<RotateCcw size={13} />}>
            Recalibrate
          </Button>
        </div>
      </div>
    </Card>
  );
}
