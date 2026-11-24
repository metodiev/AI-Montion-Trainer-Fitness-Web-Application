import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  Clock,
  Flame,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CalibrationSnapshot } from '@/core/calibration';
import { PoseCalibration } from '@/core/calibration';
import type { PoseBaseline, PoseFrame } from '@/core/types';
import { getExercise } from '@/exercises/definitions';
import type { WorkoutSessionConfig } from '@/services/sessionTypes';
import type { SessionCompletion } from '@/game/types';
import { buildWorkoutRecord, type SessionSetPerformance } from '@/services/sessionResult';
import { getAudioFeedback } from '@/services/AudioFeedback';
import { useAppData } from '@/store/AppDataProvider';
import { usePoseCamera } from '@/hooks/usePoseCamera';
import { PoseStage } from '@/components/PoseStage';
import { DemoPlayer } from '@/components/DemoPlayer';
import { DemoThumbnail } from '@/components/DemoThumbnail';
import { ExerciseGlyph } from '@/components/ExerciseArt';
import { CalibrationBodyGuide, CalibrationCoach } from '@/components/workout/CalibrationCoach';
import { SessionStage } from '@/components/workout/SessionStage';
import { SessionSummary } from '@/components/workout/SessionSummary';
import { Button, Card, Chip, ProgressBar } from '@/components/ui/primitives';

type Phase = 'intro' | 'camera' | 'ready' | 'training' | 'summary';

const EMPTY_CALIBRATION: CalibrationSnapshot = {
  phase: 'idle',
  checks: { bodyVisible: false, distance: false, lighting: false, stable: false, posture: false },
  progress: 0,
  holdMs: 2400,
  message: 'Camera ready. Stand back so your whole body is in frame.',
  hints: [],
  baseline: null,
  confidence: 0,
};

export function WorkoutPlayer({ config }: { config: WorkoutSessionConfig }) {
  const navigate = useNavigate();
  const { data, completeWorkoutSession } = useAppData();
  const [phase, setPhase] = useState<Phase>('intro');
  const [calibration, setCalibration] = useState<CalibrationSnapshot>(EMPTY_CALIBRATION);
  const [baseline, setBaseline] = useState<PoseBaseline | null>(null);
  const [summary, setSummary] = useState<SessionCompletion | null>(null);
  const [summaryCompleted, setSummaryCompleted] = useState(false);
  const [starting, setStarting] = useState(false);

  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const calibrationRef = useRef(new PoseCalibration());
  const frameSinkRef = useRef<((frame: PoseFrame | null, now: number) => void) | null>(null);
  const lastCalibrationUi = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const audio = useRef(getAudioFeedback());

  const camera = usePoseCamera({
    enabled: phase === 'camera' || phase === 'ready' || phase === 'training',
    deviceId: data.settings.cameraDeviceId,
    mirror: data.settings.mirror,
    showSkeleton: data.settings.showSkeleton,
    onFrame: useCallback((frame: PoseFrame | null, now: number) => {
      if (phaseRef.current === 'camera') {
        const snapshot = calibrationRef.current.update(frame, now);
        if (now - lastCalibrationUi.current > 90 || snapshot.phase === 'complete') {
          lastCalibrationUi.current = now;
          setCalibration(snapshot);
        }
        if (snapshot.phase === 'complete' && snapshot.baseline) {
          setBaseline(snapshot.baseline);
          setPhase('ready');
          audio.current.play('start');
          audio.current.speak('Calibrated. Press start when you are ready.');
        }
        return;
      }
      frameSinkRef.current?.(frame, now);
    }, []),
  });

  useEffect(() => {
    audio.current.configure({
      volume: data.settings.volume,
      sound: data.settings.sound,
      voice: data.settings.voice,
    });
  }, [data.settings.volume, data.settings.sound, data.settings.voice]);

  useEffect(() => {
    if (phase === 'summary') camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const firstExercise = useMemo(() => {
    const block = config.blocks.find((entry) => entry.kind === 'exercise');
    return block && block.kind === 'exercise' ? getExercise(block.exerciseId) : null;
  }, [config.blocks]);

  const exerciseBlocks = config.blocks.filter((entry) => entry.kind === 'exercise');
  const movements = exerciseBlocks.length;

  const beginCalibration = useCallback(async () => {
    await audio.current.unlock();
    calibrationRef.current.reset();
    calibrationRef.current.start(performance.now());
    setCalibration(EMPTY_CALIBRATION);
    setBaseline(null);
    setPhase('camera');
  }, []);

  const recalibrate = useCallback(() => {
    calibrationRef.current.reset();
    calibrationRef.current.start(performance.now());
    setCalibration(EMPTY_CALIBRATION);
    setBaseline(null);
    setPhase('camera');
    if (camera.status !== 'running') void camera.retry();
  }, [camera]);

  const startTraining = useCallback(async () => {
    if (!baseline) return;
    setStarting(true);
    await audio.current.unlock();
    audio.current.play('start');
    audio.current.speak('Workout starting. Let us go.');
    startedAtRef.current = Date.now();
    completedRef.current = false;
    setPhase('training');
    setStarting(false);
  }, [baseline]);

  const handleComplete = useCallback(
    (performances: SessionSetPerformance[], activeSeconds: number, completed: boolean) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const now = Date.now();
      const record = buildWorkoutRecord(config, performances, {
        startedAt: startedAtRef.current ?? now,
        endedAt: now,
        activeSeconds,
        completed,
      });
      const completion = completeWorkoutSession(record);
      setSummary(completion);
      setSummaryCompleted(completed);
      setPhase('summary');
      audio.current.play(completed ? 'finish' : 'warn');
      if (completed) {
        audio.current.speak(
          completion.rewards.newRecords.length > 0
            ? 'Workout complete. New personal record!'
            : 'Workout complete. Great work.',
          { force: true },
        );
      }
      if (completion.rewards.leveledUp) {
        window.setTimeout(() => audio.current.play('levelUp'), 900);
      }
      if (completion.rewards.newAchievements.length > 0) {
        window.setTimeout(() => audio.current.play('achievement'), 1500);
      }
    },
    [completeWorkoutSession, config],
  );

  const retry = useCallback(() => {
    setSummary(null);
    setPhase(baseline ? 'ready' : 'camera');
    completedRef.current = false;
    setStarting(false);
    if (!baseline) {
      calibrationRef.current.reset();
      calibrationRef.current.start(performance.now());
    }
  }, [baseline]);

  if (phase === 'training') {
    return (
      <SessionStage
        config={config}
        baseline={baseline!}
        camera={camera}
        frameSink={frameSinkRef}
        mirror={data.settings.mirror}
        showMetrics={data.settings.showMetrics}
        onComplete={handleComplete}
      />
    );
  }

  if (phase === 'summary' && summary) {
    return (
      <SessionSummary
        completion={summary}
        config={config}
        completed={summaryCompleted}
        onRetry={retry}
      />
    );
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-dvh bg-ink-950">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card className="overflow-hidden p-3 sm:p-4" strong>
              {firstExercise ? (
                <DemoPlayer demo={firstExercise.demo} className="aspect-[4/3] w-full" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-slate-500">Guided session</div>
              )}
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="p-6">
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="lime">{config.difficulty}</Chip>
                  <Chip tone="sky">
                    <Clock size={11} /> {config.estimatedMinutes} min
                  </Chip>
                  <Chip tone="violet">
                    <Sparkles size={11} /> {movements} tracked
                  </Chip>
                </div>
                <h1 className="mt-3 font-display text-3xl leading-tight font-semibold text-white">
                  {config.title}
                </h1>
                <p className="mt-1 text-sm text-slate-400">{config.subtitle}</p>

                <div className="mt-5 space-y-2">
                  {config.blocks
                    .filter((block) => block.kind !== 'rest')
                    .slice(0, 8)
                    .map((block) => (
                      <div key={block.id} className="flex items-center gap-3">
                        {block.kind === 'exercise' ? (
                          <ExerciseGlyph id={block.exerciseId} size="sm" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-400/10 text-violet-300">
                            <Sparkles size={15} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-200">
                            {block.kind === 'exercise'
                              ? getExercise(block.exerciseId).name
                              : block.kind === 'guided'
                                ? block.title
                                : 'Recovery'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {block.kind === 'exercise'
                              ? block.targetReps
                                ? `${block.targetReps} reps`
                                : `${block.targetSeconds}s hold`
                              : `${block.durationSec}s`}
                          </p>
                        </div>
                        <ChevronRight size={12} className="text-slate-600" />
                      </div>
                    ))}
                  {config.blocks.filter((block) => block.kind !== 'rest').length > 8 ? (
                    <p className="text-[10px] text-slate-500">
                      + {config.blocks.filter((block) => block.kind !== 'rest').length - 8} more intervals
                    </p>
                  ) : null}
                </div>

                <Button size="lg" className="mt-6 w-full" onClick={() => void beginCalibration()} icon={<Camera size={17} />}>
                  Enable camera & calibrate
                </Button>
                <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-500">
                  Your camera feed is processed on this device only. Nothing is recorded or uploaded.
                </p>
              </Card>

              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck size={15} className="text-emerald-300" /> Before you start
                </h2>
                <ul className="mt-3 space-y-2">
                  {[
                    'Clear 2–3 metres of space and put the laptop at chest height.',
                    'Make sure your head and feet both fit in the frame.',
                    'Wear comfortable clothing; avoid strong backlight.',
                    'Stop if you feel pain or dizziness.',
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-slate-400">
                      <Check size={12} className="mt-0.5 shrink-0 text-emerald-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cameraRunning = camera.status === 'running';
  return (
    <div className="min-h-dvh bg-ink-950">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Exit setup
        </button>

        <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-3">
            <PoseStage
              videoRef={camera.videoRef}
              canvasRef={camera.canvasRef}
              status={camera.status}
              error={camera.error}
              mirror={data.settings.mirror}
              detected={camera.detected}
              fps={camera.fps}
              onRetry={() => void camera.retry()}
              onStart={() => void camera.retry()}
              className="aspect-[4/3] w-full [&>video]:object-contain"
            >
              <CalibrationBodyGuide
                visible={phase === 'camera' && !baseline}
                progress={calibration.progress}
              />
              {phase === 'ready' ? (
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-1.5 text-xs font-bold tracking-wide text-emerald-100 uppercase backdrop-blur">
                    Calibrated · body locked
                  </span>
                </div>
              ) : null}
            </PoseStage>

            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    cameraRunning ? 'bg-emerald-400/12 text-emerald-300' : 'bg-rose-400/12 text-rose-300'
                  }`}
                >
                  {cameraRunning ? <Camera size={16} /> : <CameraOff size={16} />}
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">
                    {cameraRunning ? 'Camera on · local processing' : 'Camera off'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {camera.fps > 0 ? `${camera.fps} fps pose inference` : 'Waiting for camera frames'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                  <Lock size={10} /> Private
                </span>
                <Button
                  variant={cameraRunning ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => (cameraRunning ? camera.stop() : void camera.retry())}
                  icon={cameraRunning ? <CameraOff size={13} /> : <Camera size={13} />}
                >
                  {cameraRunning ? 'Turn off' : 'Turn on'}
                </Button>
              </div>
            </Card>

            {phase === 'ready' && firstExercise ? (
              <Card className="flex items-center gap-3 p-4">
                <DemoThumbnail demo={firstExercise.demo} className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="app-label">First movement</p>
                  <p className="truncate text-sm font-medium text-white">{firstExercise.name}</p>
                  <p className="truncate text-[10px] text-slate-500">{firstExercise.cameraHint}</p>
                </div>
                <Flame size={18} className="shrink-0 text-lime-300" />
              </Card>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <CalibrationCoach
              snapshot={calibration}
              baseline={baseline}
              exerciseName={firstExercise?.name ?? 'this session'}
              cameraHint={
                firstExercise?.cameraHint ??
                'Stand back so your whole body is visible from head to feet.'
              }
              onStart={() => void startTraining()}
              onRecalibrate={recalibrate}
              onCancel={() => navigate(-1)}
              starting={starting}
              cameraRunning={cameraRunning}
            />

            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                <span>Session progress</span>
                <span className="font-mono">0%</span>
              </div>
              <ProgressBar value={0} height="h-1.5" />
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Counting starts only after calibration and pauses automatically if you leave the frame.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
