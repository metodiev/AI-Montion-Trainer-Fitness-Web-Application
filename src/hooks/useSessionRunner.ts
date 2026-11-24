import { useCallback, useEffect, useRef, useState } from 'react';
import { getExercise } from '@/exercises/definitions';
import type { CoachingCue } from '@/exercises/types';
import type { PoseBaseline, PoseFrame } from '@/core/types';
import { ExerciseEngine, type EngineSnapshot } from '@/services/ExerciseEngine';
import type { ExerciseBlock, SessionBlock, WorkoutSessionConfig } from '@/services/sessionTypes';
import type { SessionSetPerformance } from '@/services/sessionResult';

export type SessionPhase = 'guided' | 'active' | 'rest' | 'complete';

export interface RunnerBlockState {
  block: SessionBlock;
  index: number;
  phase: SessionPhase;
  remainingSec: number;
  elapsedSec: number;
  progress: number;
  targetReps?: number;
  targetSeconds?: number;
}

export interface UseSessionRunnerOptions {
  config: WorkoutSessionConfig;
  baseline: PoseBaseline | null;
  paused: boolean;
  onCue?: (cue: CoachingCue) => void;
  onRep?: (reps: number, snapshot: EngineSnapshot) => void;
  onPhaseChange?: (phase: SessionPhase, block: SessionBlock, index: number) => void;
  onComplete: (
    performances: SessionSetPerformance[],
    activeSeconds: number,
    completed: boolean,
  ) => void;
}

export interface SessionRunnerApi {
  state: RunnerBlockState;
  snapshot: EngineSnapshot | null;
  performances: SessionSetPerformance[];
  activeSeconds: number;
  handleFrame: (frame: PoseFrame | null, now: number) => void;
  skipBlock: () => void;
  finishSession: () => void;
}

const TICK_MS = 200;
const ADVANCE_DELAY_MS = 650;

const phaseOf = (block: SessionBlock): SessionPhase =>
  block.kind === 'guided' ? 'guided' : block.kind === 'rest' ? 'rest' : 'active';

/**
 * Runs a workout script: guided warm-ups, exercise blocks with live tracking,
 * rest intervals and a final summary. Timers are independent of pose frames so
 * a dropped camera frame never stalls the session.
 */
export function useSessionRunner(options: UseSessionRunnerOptions): SessionRunnerApi {
  const { config, baseline, paused, onCue, onRep, onPhaseChange, onComplete } = options;
  const [blockIndex, setBlockIndex] = useState(0);
  const [remainingSec, setRemainingSec] = useState(config.blocks[0]?.durationSec ?? 0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [performances, setPerformances] = useState<SessionSetPerformance[]>([]);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [phase, setPhase] = useState<SessionPhase>(
    config.blocks.length > 0 ? phaseOf(config.blocks[0]) : 'complete',
  );

  const elapsedRef = useRef(0);
  const totalActiveRef = useRef(0);
  const engineRef = useRef<ExerciseEngine | null>(null);
  const performancesRef = useRef<SessionSetPerformance[]>([]);
  const snapshotRef = useRef<EngineSnapshot | null>(null);
  const pausedRef = useRef(paused);
  const pendingAdvanceAt = useRef<number | null>(null);
  const completedRef = useRef(false);
  const lastUiUpdate = useRef(0);
  const lastCueCode = useRef<string | null>(null);
  const lastReps = useRef(0);
  const blockIndexRef = useRef(0);
  const onCueRef = useRef(onCue);
  const onRepRef = useRef(onRep);
  const onCompleteRef = useRef(onComplete);
  const onPhaseRef = useRef(onPhaseChange);
  const completingRef = useRef(false);

  pausedRef.current = paused;
  onCueRef.current = onCue;
  onRepRef.current = onRep;
  onCompleteRef.current = onComplete;
  onPhaseRef.current = onPhaseChange;

  const currentBlock = config.blocks[blockIndex];

  const targetsFor = useCallback((block: SessionBlock | undefined) => {
    if (!block || block.kind !== 'exercise') return { targetReps: undefined, targetSeconds: undefined };
    return { targetReps: block.targetReps, targetSeconds: block.targetSeconds };
  }, []);

  const finalizeCurrent = useCallback(
    (completed: boolean, extraSeconds = 0) => {
      const block = config.blocks[blockIndexRef.current];
      if (!block || block.kind !== 'exercise' || !engineRef.current) return;
      const result = engineRef.current.finish();
      const repsMet = block.targetReps === undefined || result.reps >= block.targetReps;
      const holdMet = block.targetSeconds === undefined || result.holdSeconds >= block.targetSeconds;
      const targetMet = completed && repsMet && holdMet;
      const entry: SessionSetPerformance = {
        block: block as ExerciseBlock,
        result: { ...result, durationSec: Math.round(elapsedRef.current + extraSeconds) },
        targetMet,
        durationSec: Math.round(elapsedRef.current),
      };
      performancesRef.current = [...performancesRef.current, entry];
      setPerformances(performancesRef.current);
      engineRef.current = null;
    },
    [config.blocks],
  );

  const goToBlock = useCallback(
    (index: number) => {
      const next = config.blocks[index];
      if (!next) {
        if (!completedRef.current) {
          completedRef.current = true;
          setPhase('complete');
          onCompleteRef.current(performancesRef.current, totalActiveRef.current, true);
        }
        return;
      }
      blockIndexRef.current = index;
      elapsedRef.current = 0;
      pendingAdvanceAt.current = null;
      lastCueCode.current = null;
      lastReps.current = 0;
      setBlockIndex(index);
      setElapsedSec(0);
      setRemainingSec(next.durationSec);
      setPhase(phaseOf(next));
      if (next.kind === 'exercise' && baseline) {
        const definition = getExercise(next.exerciseId);
        engineRef.current = new ExerciseEngine({ definition, baseline });
        const initial = engineRef.current.update(null, performance.now());
        snapshotRef.current = initial;
        setSnapshot(initial);
      } else {
        engineRef.current = null;
        snapshotRef.current = null;
        setSnapshot(null);
      }
      onPhaseRef.current?.(phaseOf(next), next, index);
    },
    [baseline, config.blocks],
  );

  const advance = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    finalizeCurrent(true);
    const nextIndex = blockIndexRef.current + 1;
    // Defer so the last rep/score paints before the next block.
    window.setTimeout(() => {
      completingRef.current = false;
      goToBlock(nextIndex);
    }, 250);
  }, [finalizeCurrent, goToBlock]);

  const skipBlock = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    finalizeCurrent(false);
    window.setTimeout(() => {
      completingRef.current = false;
      goToBlock(blockIndexRef.current + 1);
    }, 120);
  }, [finalizeCurrent, goToBlock]);

  const finishSession = useCallback(() => {
    if (completedRef.current) return;
    completingRef.current = true;
    finalizeCurrent(true);
    completedRef.current = true;
    setPhase('complete');
    onCompleteRef.current(performancesRef.current, totalActiveRef.current, false);
  }, [finalizeCurrent]);

  // Reset when the session config changes.
  useEffect(() => {
    completedRef.current = false;
    completingRef.current = false;
    performancesRef.current = [];
    totalActiveRef.current = 0;
    setPerformances([]);
    setActiveSeconds(0);
    blockIndexRef.current = 0;
    goToBlock(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Create the engine when the baseline becomes available later.
  useEffect(() => {
    const block = config.blocks[blockIndexRef.current];
    if (!baseline || !block || block.kind !== 'exercise' || engineRef.current) return;
    const definition = getExercise(block.exerciseId);
    engineRef.current = new ExerciseEngine({ definition, baseline });
    const initial = engineRef.current.update(null, performance.now());
    snapshotRef.current = initial;
    setSnapshot(initial);
  }, [baseline, config.blocks]);

  useEffect(() => {
    if (phase === 'complete') return;
    const interval = window.setInterval(() => {
      if (pausedRef.current || completedRef.current) return;
      const block = config.blocks[blockIndexRef.current];
      if (!block || completingRef.current) return;

      elapsedRef.current = Math.min(block.durationSec + 5, elapsedRef.current + TICK_MS / 1000);
      if (block.kind === 'exercise') {
        totalActiveRef.current += TICK_MS / 1000;
        setActiveSeconds(totalActiveRef.current);
      }
      const remaining = Math.max(0, block.durationSec - elapsedRef.current);
      setElapsedSec(elapsedRef.current);
      setRemainingSec(remaining);

      if (pendingAdvanceAt.current !== null && performance.now() >= pendingAdvanceAt.current) {
        pendingAdvanceAt.current = null;
        advance();
        return;
      }

      if (remaining <= 0) {
        if (block.kind === 'exercise') {
          finalizeCurrent(false);
        }
        const nextIndex = blockIndexRef.current + 1;
        if (!config.blocks[nextIndex]) {
          if (!completedRef.current) {
            completedRef.current = true;
            setPhase('complete');
            onCompleteRef.current(performancesRef.current, totalActiveRef.current, true);
          }
        } else {
          window.setTimeout(() => {
            if (!completedRef.current) goToBlock(nextIndex);
          }, 0);
        }
      }

      const currentSnapshot = snapshotRef.current;
      if (block.kind === 'exercise' && currentSnapshot) {
        const targetMet =
          (block.targetReps !== undefined && currentSnapshot.reps >= block.targetReps) ||
          (block.targetSeconds !== undefined && currentSnapshot.holdSeconds >= block.targetSeconds);
        if (targetMet && pendingAdvanceAt.current === null) {
          pendingAdvanceAt.current = performance.now() + ADVANCE_DELAY_MS;
        }
      }
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [advance, config.blocks, finalizeCurrent, goToBlock, phase]);

  const handleFrame = useCallback(
    (frame: PoseFrame | null, now: number) => {
      const engine = engineRef.current;
      if (!engine || pausedRef.current || completedRef.current) return;
      const next = engine.update(frame, now);
      snapshotRef.current = next;

      if (next.holdSeconds > 0) {
        // Holds update slowly; refresh the HUD at ~4 Hz.
        if (now - lastUiUpdate.current > 220) {
          lastUiUpdate.current = now;
          setSnapshot(next);
        }
      } else if (next.repEvent || now - lastUiUpdate.current > 90) {
        lastUiUpdate.current = now;
        setSnapshot(next);
      }

      if (next.cue && next.cue.code !== lastCueCode.current) {
        lastCueCode.current = next.cue.code;
        onCueRef.current?.(next.cue);
      }
      if (next.reps > lastReps.current) {
        lastReps.current = next.reps;
        onRepRef.current?.(next.reps, next);
      }
    },
    [],
  );

  return {
    state: {
      block: currentBlock,
      index: blockIndex,
      phase,
      remainingSec: Math.ceil(remainingSec),
      elapsedSec,
      progress:
        currentBlock && currentBlock.durationSec > 0
          ? Math.min(1, elapsedSec / currentBlock.durationSec)
          : 0,
      ...targetsFor(currentBlock),
    },
    snapshot,
    performances,
    activeSeconds,
    handleFrame,
    skipBlock,
    finishSession,
  };
}
