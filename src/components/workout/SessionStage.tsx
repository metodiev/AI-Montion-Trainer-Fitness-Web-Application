import clsx from 'clsx';
import {
  Camera,
  CameraOff,
  ChevronRight,
  CircleAlert,
  LogOut,
  Pause,
  Play,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { CoachingCue } from '@/exercises/types';
import { getExercise } from '@/exercises/definitions';
import type { PoseBaseline, PoseFrame } from '@/core/types';
import type { PoseCameraApi } from '@/hooks/usePoseCamera';
import { useSessionRunner } from '@/hooks/useSessionRunner';
import type { WorkoutSessionConfig } from '@/services/sessionTypes';
import type { SessionSetPerformance } from '@/services/sessionResult';
import { getAudioFeedback } from '@/services/AudioFeedback';
import { formatDuration } from '@/services/StatisticsService';
import { PoseStage } from '@/components/PoseStage';
import { DemoPlayer } from '@/components/DemoPlayer';
import { DemoThumbnail } from '@/components/DemoThumbnail';
import { Button, Chip, ProgressBar, Ring } from '@/components/ui/primitives';

const CUE_STYLE: Record<CoachingCue['severity'], string> = {
  error: 'border-rose-400/40 bg-rose-500/18 text-rose-50',
  warning: 'border-amber-400/40 bg-amber-500/16 text-amber-50',
  success: 'border-emerald-400/40 bg-emerald-500/16 text-emerald-50',
  info: 'border-sky-400/35 bg-sky-500/14 text-sky-50',
};

const CUE_ICON = {
  error: CircleAlert,
  warning: CircleAlert,
  success: Sparkles,
  info: Sparkles,
};

export function SessionStage({
  config,
  baseline,
  camera,
  frameSink,
  mirror,
  showMetrics,
  onComplete,
}: {
  config: WorkoutSessionConfig;
  baseline: PoseBaseline;
  camera: PoseCameraApi;
  frameSink: MutableRefObject<((frame: PoseFrame | null, now: number) => void) | null>;
  mirror: boolean;
  showMetrics: boolean;
  onComplete: (performances: SessionSetPerformance[], activeSeconds: number, completed: boolean) => void;
}) {
  const audioRef = useRef(getAudioFeedback());
  const [paused, setPaused] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimeout = useRef<number | null>(null);

  const runner = useSessionRunner({
    config,
    baseline,
    paused,
    onCue: (cue) => {
      audioRef.current.coach(cue.severity, cue.message);
    },
    onRep: (reps, snapshot) => {
      const clean = (snapshot.repEvent?.score ?? 100) >= 70;
      audioRef.current.count(reps, clean);
      if (snapshot.repEvent) {
        setFlash(
          snapshot.repEvent.score >= 85
            ? 'Clean rep'
            : snapshot.repEvent.score >= 70
              ? 'Rep counted'
              : 'Rep counted · work on form',
        );
        if (flashTimeout.current) window.clearTimeout(flashTimeout.current);
        flashTimeout.current = window.setTimeout(() => setFlash(null), 1200);
      }
    },
    onPhaseChange: (phase) => {
      if (phase === 'rest') audioRef.current.play('tick');
    },
    onComplete,
  });

  useEffect(() => {
    frameSink.current = runner.handleFrame;
    return () => {
      if (frameSink.current === runner.handleFrame) frameSink.current = null;
    };
  }, [frameSink, runner.handleFrame]);

  useEffect(
    () => () => {
      if (flashTimeout.current) window.clearTimeout(flashTimeout.current);
    },
    [],
  );

  const block = runner.state.block;
  const snapshot = runner.snapshot;
  const phase = runner.state.phase;
  const blockIndex = runner.state.index;
  const totalExercises = config.blocks.filter((entry) => entry.kind === 'exercise').length;
  const completedExercises = config.blocks
    .slice(0, blockIndex)
    .filter((entry) => entry.kind === 'exercise').length;
  const exercise = block?.kind === 'exercise' ? getExercise(block.exerciseId) : null;
  const targetLabel =
    block?.kind === 'exercise'
      ? block.targetReps
        ? `${block.targetReps} reps`
        : `${block.targetSeconds}s hold`
      : null;

  const reps = snapshot?.reps ?? 0;
  const targetReps = block?.kind === 'exercise' ? block.targetReps ?? 0 : 0;
  const holdSeconds = snapshot?.holdSeconds ?? 0;
  const targetSeconds = block?.kind === 'exercise' ? block.targetSeconds ?? 0 : 0;
  const isHold = !!block && block.kind === 'exercise' && !!block.targetSeconds;
  const progressValue = isHold
    ? Math.min(1, holdSeconds / Math.max(1, targetSeconds))
    : Math.min(1, reps / Math.max(1, targetReps));
  const cue = snapshot?.cue;
  const CueIcon = cue ? CUE_ICON[cue.severity] : Sparkles;
  const tracking = snapshot?.tracking ?? false;
  const cameraRunning = camera.status === 'running';

  const nextExerciseBlock = (() => {
    for (let index = blockIndex + 1; index < config.blocks.length; index += 1) {
      const entry = config.blocks[index];
      if (entry.kind === 'exercise') return entry;
    }
    return null;
  })();
  const nextExercise = nextExerciseBlock ? getExercise(nextExerciseBlock.exerciseId) : null;

  const handleEnd = useCallback(() => {
    setConfirmExit(false);
    runner.finishSession();
  }, [runner]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink-950">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/8 bg-ink-950/90 px-3 py-2.5 backdrop-blur sm:px-5">
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
        >
          <LogOut size={13} /> <span className="hidden sm:inline">End</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-white">{config.title}</p>
          <p className="truncate text-[10px] text-slate-500">
            {phase === 'rest'
              ? 'Recovery'
              : phase === 'guided'
                ? block?.kind === 'guided'
                  ? block.label ?? 'Guided'
                  : 'Guided'
                : `Exercise ${Math.min(totalExercises, completedExercises + 1)}/${totalExercises}`}
            {' · '}
            {config.difficulty}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 sm:flex">
            <span className="font-mono text-xs font-semibold text-lime-300">+{snapshot?.xp ?? 0}</span>
            <span className="text-[9px] tracking-wide text-slate-500 uppercase">XP</span>
          </div>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-xl border transition',
              paused
                ? 'border-lime-400/40 bg-lime-400/15 text-lime-200'
                : 'border-white/10 bg-white/[0.04] text-slate-300 hover:text-white',
            )}
            aria-label={paused ? 'Resume workout' : 'Pause workout'}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (cameraRunning) camera.stop();
              else void camera.retry();
            }}
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-xl border transition',
              cameraRunning
                ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:text-white'
                : 'border-rose-400/40 bg-rose-500/15 text-rose-200',
            )}
            aria-label={cameraRunning ? 'Turn camera off' : 'Turn camera on'}
          >
            {cameraRunning ? <Camera size={14} /> : <CameraOff size={14} />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1 p-2 sm:p-3">
          <PoseStage
            videoRef={camera.videoRef}
            canvasRef={camera.canvasRef}
            status={camera.status}
            error={camera.error}
            mirror={mirror}
            detected={camera.detected}
            fps={camera.fps}
            onRetry={() => void camera.retry()}
            onStart={() => void camera.start()}
            className="h-full min-h-[46vh] w-full [&>video]:object-contain"
            hidePlaceholder
          >
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="rounded-2xl border border-white/10 bg-ink-950/72 px-3.5 py-2 backdrop-blur">
                  <p className="text-[9px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                    {phase === 'rest' ? 'Recovery' : phase === 'guided' ? 'Guided' : 'Now training'}
                  </p>
                  <p className="font-display text-sm font-semibold text-white sm:text-base">
                    {block?.kind === 'exercise'
                      ? exercise?.name
                      : block?.kind === 'guided'
                        ? block.title
                        : block?.label ?? 'Workout'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {targetLabel ? (
                    <span className="rounded-2xl border border-white/10 bg-ink-950/72 px-3 py-1.5 font-mono text-[11px] font-semibold text-lime-300 backdrop-blur">
                      {targetLabel}
                    </span>
                  ) : null}
                  <span
                    className={clsx(
                      'rounded-2xl border px-3 py-1.5 font-mono text-[11px] font-semibold backdrop-blur',
                      runner.state.remainingSec <= 10 && phase !== 'active'
                        ? 'border-amber-400/40 bg-amber-500/20 text-amber-100'
                        : 'border-white/10 bg-ink-950/72 text-slate-200',
                    )}
                  >
                    {formatDuration(runner.state.remainingSec)}
                  </span>
                </div>
              </div>

              {cue ? (
                <div className="flex justify-center">
                  <div
                    key={cue.code}
                    className={clsx(
                      'animate-pop flex max-w-xl items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur',
                      CUE_STYLE[cue.severity],
                    )}
                  >
                    <CueIcon size={16} className="shrink-0" />
                    {cue.message}
                  </div>
                </div>
              ) : null}

              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {(snapshot?.chips ?? []).map((chip) => (
                    <span
                      key={chip.label}
                      className={clsx(
                        'rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur',
                        chip.tone === 'good'
                          ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                          : chip.tone === 'warn'
                            ? 'border-amber-400/35 bg-amber-500/15 text-amber-100'
                            : chip.tone === 'bad'
                              ? 'border-rose-400/35 bg-rose-500/15 text-rose-100'
                              : 'border-white/10 bg-ink-950/70 text-slate-300',
                      )}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
                {showMetrics && snapshot ? (
                  <div className="hidden rounded-2xl border border-white/10 bg-ink-950/75 px-3 py-2 font-mono text-[9px] leading-relaxed text-slate-400 backdrop-blur sm:block">
                    {Object.entries(snapshot.metrics)
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-3">
                          <span>{key}</span>
                          <span className="text-slate-200">{Number(value).toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            </div>
          </PoseStage>

          {phase === 'active' ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center">
                {isHold ? (
                  <div className="rounded-[2.5rem] border border-white/10 bg-ink-950/72 px-8 py-4 text-center backdrop-blur-md">
                    <p
                      data-testid="hold-count"
                      className="font-display text-6xl leading-none font-bold text-white tabular-nums sm:text-7xl"
                    >
                      {holdSeconds.toFixed(1)}
                      <span className="text-2xl text-slate-400">s</span>
                    </p>
                    <p className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
                      of {targetSeconds}s hold
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p
                      key={reps}
                      data-testid="rep-count"
                      className={clsx(
                        'animate-pop font-display text-[5.5rem] leading-none font-bold tabular-nums drop-shadow-[0_8px_40px_rgba(0,0,0,0.8)] sm:text-[7rem]',
                        reps > 0 ? 'text-white' : 'text-white/70',
                      )}
                    >
                      {reps}
                    </p>
                    <p className="-mt-1 text-[11px] font-semibold tracking-[0.22em] text-lime-300 uppercase">
                      of {targetReps || '∞'} reps
                    </p>
                  </div>
                )}
              </div>

              <div className="pointer-events-none absolute right-4 bottom-16 hidden sm:block">
                <Ring progress={progressValue} size={92} stroke={7} tone={progressValue >= 1 ? '#34d399' : '#c8ff4d'}>
                  <span className="font-display text-base font-semibold text-white">
                    {Math.round(progressValue * 100)}%
                  </span>
                  <span className="text-[8px] tracking-wide text-slate-400 uppercase">set</span>
                </Ring>
              </div>

              {flash ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
                  <span className="animate-pop rounded-full border border-lime-400/40 bg-lime-400/20 px-4 py-1.5 text-xs font-bold tracking-wide text-lime-100 uppercase backdrop-blur">
                    {flash}
                  </span>
                </div>
              ) : null}
            </>
          ) : null}

          {phase === 'rest' ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <div className="pointer-events-auto w-full max-w-sm rounded-3xl border border-white/12 bg-ink-950/88 p-6 text-center shadow-2xl backdrop-blur-xl">
                <p className="app-label">Recovery</p>
                <p className="mt-1 font-display text-5xl font-bold text-white tabular-nums">
                  {formatDuration(runner.state.remainingSec)}
                </p>
                {nextExercise ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-left">
                    <DemoThumbnail demo={nextExercise.demo} className="h-14 w-14 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Up next</p>
                      <p className="truncate text-sm font-medium text-white">{nextExercise.name}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Cool-down next — almost done.</p>
                )}
                <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={runner.skipBlock} icon={<SkipForward size={13} />}>
                  Skip rest
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'guided' && block && block.kind === 'guided' ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/12 bg-ink-950/88 p-4 shadow-2xl backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="app-label">{block.label ?? 'Guided'}</p>
                    <p className="font-display text-lg font-semibold text-white">{block.title}</p>
                  </div>
                  <p className="font-display text-3xl font-bold text-lime-300 tabular-nums">
                    {formatDuration(runner.state.remainingSec)}
                  </p>
                </div>
                <DemoPlayer demo={block.demo} className="aspect-[4/3] w-full" compact />
                <p className="mt-3 text-center text-xs text-slate-400">{block.cue}</p>
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={runner.skipBlock} icon={<SkipForward size={13} />}>
                  Skip
                </Button>
              </div>
            </div>
          ) : null}

          {!cameraRunning ? (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm">
              <div className="max-w-xs rounded-3xl border border-white/12 bg-ink-900/95 p-6 text-center">
                <CameraOff size={26} className="mx-auto text-rose-300" />
                <p className="mt-2 font-display text-base font-semibold text-white">Camera is off</p>
                <p className="mt-1 text-xs text-slate-400">
                  Counting is paused. Your session timer keeps running.
                </p>
                <Button size="sm" className="mt-4 w-full" onClick={() => void camera.retry()} icon={<Camera size={13} />}>
                  Turn camera back on
                </Button>
              </div>
            </div>
          ) : null}

          {paused ? (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/80 backdrop-blur-md">
              <div className="max-w-xs rounded-3xl border border-white/12 bg-ink-900/95 p-7 text-center">
                <Pause size={26} className="mx-auto text-lime-300" />
                <p className="mt-2 font-display text-xl font-semibold text-white">Paused</p>
                <p className="mt-1 text-xs text-slate-400">Timers and rep counting are frozen.</p>
                <Button className="mt-5 w-full" onClick={() => setPaused(false)} icon={<Play size={14} />}>
                  Resume
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="hidden w-[370px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-white/8 bg-ink-950/70 p-4 lg:flex">
          <div className="flex items-center justify-between">
            <span className="app-label">Movement</span>
            <span className="font-mono text-[10px] text-slate-500">
              {completedExercises + (phase === 'active' ? 1 : 0)}/{totalExercises}
            </span>
          </div>
          {exercise ? (
            <>
              <DemoPlayer demo={exercise.demo} className="aspect-[4/3] w-full" compact />
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="lime">{exercise.difficulty}</Chip>
                  <Chip tone="neutral">{exercise.metric === 'time' ? 'Hold' : 'Reps'}</Chip>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{exercise.cameraHint}</p>
              </div>
              <div className="space-y-1.5">
                {exercise.posture.slice(0, 3).map((item) => (
                  <p key={item} className="flex gap-2 text-[11px] leading-relaxed text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-lime-300" />
                    {item}
                  </p>
                ))}
              </div>
              <div className="mt-auto rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Technique</span>
                  <span className="font-mono text-slate-300">{snapshot?.averageScore ?? 0}%</span>
                </div>
                <ProgressBar value={(snapshot?.averageScore ?? 0) / 100} tone="violet" height="h-1.5" />
                <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className={clsx('h-1.5 w-1.5 rounded-full', tracking ? 'bg-emerald-400' : 'bg-amber-400')} />
                  {tracking ? 'Tracking locked' : 'Locking on…'}
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-xs text-slate-400">
              {phase === 'rest'
                ? 'Breathe, shake it out and get ready for the next interval.'
                : 'Follow the guided movement on screen.'}
            </div>
          )}

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p className="app-label mb-2">Session timeline</p>
            <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
              {config.blocks.map((entry, index) => {
                const isCurrent = index === blockIndex;
                const done = index < blockIndex;
                return (
                  <div
                    key={entry.id}
                    className={clsx(
                      'flex items-center gap-2 rounded-lg px-2 py-1 text-[10px]',
                      isCurrent ? 'bg-lime-400/12 text-lime-100' : done ? 'text-slate-600' : 'text-slate-500',
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold',
                        isCurrent
                          ? 'bg-lime-400 text-ink-950'
                          : done
                            ? 'bg-white/10 text-slate-500'
                            : 'border border-white/10 text-slate-500',
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate">
                      {entry.kind === 'exercise'
                        ? getExercise(entry.exerciseId).name
                        : entry.kind === 'guided'
                          ? entry.title
                          : 'Recovery'}
                    </span>
                    <ChevronRight size={9} className="ml-auto shrink-0 opacity-50" />
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      <div className="shrink-0 border-t border-white/8 bg-ink-950/90 px-3 py-2.5 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-white">
              {block?.kind === 'exercise'
                ? exercise?.name
                : block?.kind === 'guided'
                  ? block?.title
                  : 'Recovery'}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <ProgressBar value={progressValue} height="h-1" className="flex-1" />
              <span className="font-mono text-[10px] text-slate-400">
                {isHold ? `${holdSeconds.toFixed(1)}s` : `${reps}/${targetReps || '∞'}`}
              </span>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={runner.skipBlock} icon={<SkipForward size={12} />}>
            Skip
          </Button>
        </div>
      </div>

      {confirmExit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-white/12 bg-ink-900 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-white">End workout?</h3>
              <button type="button" onClick={() => setConfirmExit(false)} className="text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Your completed sets will still be saved and scored, but bonus XP and adventure star
              requirements need a full session.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmExit(false)}>
                Keep going
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleEnd}>
                End workout
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

