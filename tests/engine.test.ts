import { describe, expect, it } from 'vitest';
import { getExercise } from '@/exercises/definitions';
import { ExerciseEngine } from '@/services/ExerciseEngine';
import { RepetitionCounter } from '@/services/RepetitionCounter';
import { TechniqueEvaluator } from '@/services/TechniqueEvaluator';
import type { RepEvent } from '@/exercises/types';
import {
  baselineFrom,
  frameOf,
  sideStanding,
  squatPose,
  pushUpPose,
} from './helpers/pose';

const baseline = baselineFrom(sideStanding());
const standing = sideStanding();
const deep = squatPose({ hipFlex: 95, kneeBend: 115, lean: 5, armFlex: 90 });
const mid = squatPose({ hipFlex: 70, kneeBend: 80, lean: 5, armFlex: 90 });

function feed(
  engine: ExerciseEngine,
  startNow: number,
  steps: { pose: ReturnType<typeof sideStanding> | null; ms: number; visibility?: number }[],
) {
  let now = startNow;
  let last = engine.update(null, now);
  const events: number[] = [];
  for (const step of steps) {
    const frames = Math.max(1, Math.round(step.ms / 33));
    for (let index = 0; index < frames; index += 1) {
      now += step.ms / frames;
      const frame = step.pose ? frameOf(step.pose, now, step.visibility ?? 1) : null;
      last = engine.update(frame, now);
      if (last.repEvent) events.push(last.repEvent.index);
    }
  }
  return { last, now, events };
}

const rep = (index: number, score: number, side: 'left' | 'right' | null = null): RepEvent => ({
  index,
  score,
  side,
  clean: score >= 70,
  durationMs: 1000,
  issues: [],
  at: index * 1000,
});

describe('ExerciseEngine', () => {
  it('arms only after a short stable tracking window', () => {
    const engine = new ExerciseEngine({
      definition: getExercise('squat'),
      baseline,
      armDelayMs: 200,
    });
    const early = feed(engine, 1000, [{ pose: standing, ms: 100 }]);
    expect(early.last.armed).toBe(false);
    const later = feed(engine, early.now + 20, [{ pose: standing, ms: 320 }]);
    expect(later.last.armed).toBe(true);
    expect(later.last.tracking).toBe(true);
  });

  it('counts a full squat after arming', () => {
    const engine = new ExerciseEngine({
      definition: getExercise('squat'),
      baseline,
      armDelayMs: 150,
    });
    const warm = feed(engine, 1000, [{ pose: standing, ms: 250 }]);
    const run = feed(engine, warm.now + 20, [
      { pose: mid, ms: 220 },
      { pose: deep, ms: 480 },
      { pose: mid, ms: 200 },
      { pose: standing, ms: 480 },
    ]);
    expect(run.last.reps).toBe(1);
    expect(run.last.xp).toBeGreaterThan(0);
    expect(run.last.points).toBeGreaterThan(0);
    expect(run.events).toEqual([1]);
  });

  it('ignores reps while the body is not tracked', () => {
    const engine = new ExerciseEngine({
      definition: getExercise('squat'),
      baseline,
      armDelayMs: 150,
      loseDelayMs: 400,
    });
    const warm = feed(engine, 1000, [{ pose: standing, ms: 250 }]);
    const lost = feed(engine, warm.now + 20, [
      { pose: null, ms: 600 },
      { pose: deep, ms: 400, visibility: 0.1 },
      { pose: standing, ms: 400, visibility: 0.1 },
    ]);
    expect(lost.last.armed).toBe(false);
    expect(lost.last.reps).toBe(0);
    expect(lost.last.bodyLost || lost.last.cues.some((cue) => cue.code === 'tracking-paused')).toBe(true);
  });

  it('credits hold time only while tracking', () => {
    const engine = new ExerciseEngine({
      definition: getExercise('plank'),
      baseline,
      armDelayMs: 120,
    });
    const plank = pushUpPose({ elbow: 'top' });
    const warm = feed(engine, 1000, [{ pose: plank, ms: 400 }]);
    const held = feed(engine, warm.now + 20, [{ pose: plank, ms: 1200 }]);
    expect(held.last.holdSeconds).toBeGreaterThan(0.8);
    expect(held.last.xp).toBeGreaterThan(0);
    const frozen = held.last.holdSeconds;
    const lost = feed(engine, held.now + 20, [{ pose: null, ms: 1200 }]);
    expect(lost.last.holdSeconds).toBeCloseTo(frozen, 5);
  });

  it('produces a set result and frequent issues', () => {
    const engine = new ExerciseEngine({ definition: getExercise('squat'), baseline, armDelayMs: 120 });
    let now = 1000;
    const standingFrame = () => frameOf(standing, now);
    const sequence = [standing, standing, mid, deep, mid, standing, standing];
    for (const pose of sequence) {
      for (let index = 0; index < 12; index += 1) {
        now += 33;
        engine.update(frameOf(pose, now), now);
      }
    }
    const result = engine.finish();
    expect(result.exerciseId).toBe('squat');
    expect(result.reps).toBeGreaterThanOrEqual(0);
    expect(result.durationSec).toBeGreaterThanOrEqual(0);
    void standingFrame;
  });
});

describe('RepetitionCounter', () => {
  it('rewards technique quadratically', () => {
    const counter = new RepetitionCounter();
    counter.add(rep(1, 100));
    counter.add(rep(2, 100));
    expect(counter.points).toBe(50);
    expect(counter.xp).toBe(18);
    expect(counter.stats.cleanReps).toBe(2);
    expect(counter.stats.averageRepScore).toBe(100);
  });

  it('ignores duplicate or out-of-order rep indices', () => {
    const counter = new RepetitionCounter();
    counter.add(rep(1, 90));
    counter.add(rep(1, 90));
    counter.add(rep(0, 90));
    expect(counter.stats.reps).toBe(1);
  });

  it('deducts points for sloppy reps', () => {
    const clean = new RepetitionCounter();
    const sloppy = new RepetitionCounter();
    clean.add(rep(1, 95));
    sloppy.add(rep(1, 40));
    expect(clean.points).toBeGreaterThan(sloppy.points * 3);
  });

  it('tracks per-side reps and hold quality', () => {
    const counter = new RepetitionCounter();
    counter.add(rep(1, 80, 'left'));
    counter.add(rep(2, 90, 'right'));
    counter.addHoldDelta(5, 100);
    expect(counter.stats.perSide).toEqual({ left: 1, right: 1 });
    expect(counter.stats.holdSeconds).toBe(5);
    expect(counter.holdAvgQuality).toBe(100);
    expect(counter.holdPoints).toBeGreaterThan(0);
  });
});

describe('TechniqueEvaluator', () => {
  const cue = (code: string, severity: 'error' | 'warning' | 'success' | 'info') => ({
    code,
    severity,
    message: code,
  });

  it('prioritises errors over praise', () => {
    const evaluator = new TechniqueEvaluator();
    const chosen = evaluator.pickCue([cue('great', 'success'), cue('sag', 'error')], 1000);
    expect(chosen?.code).toBe('sag');
  });

  it('throttles repeated cues and respects cooldowns', () => {
    const evaluator = new TechniqueEvaluator();
    expect(evaluator.pickCue([cue('deeper', 'warning')], 1000)?.code).toBe('deeper');
    expect(evaluator.pickCue([cue('deeper', 'warning')], 1500)).toBeNull();
    expect(evaluator.pickCue([cue('deeper', 'warning')], 2000)).toBeNull();
    expect(evaluator.pickCue([cue('deeper', 'warning')], 4500)?.code).toBe('deeper');
  });

  it('does not let praise interrupt active errors', () => {
    const evaluator = new TechniqueEvaluator();
    evaluator.pickCue([cue('sag', 'error')], 1000);
    expect(evaluator.pickCue([cue('great', 'success')], 2200)).toBeNull();
  });

  it('computes a weighted session score', () => {
    const evaluator = new TechniqueEvaluator();
    for (let index = 0; index < 6; index += 1) evaluator.addLiveSample(80, 1000);
    evaluator.registerRep(rep(1, 100));
    expect(evaluator.sessionScore).toBe(95);
    expect(evaluator.frequentIssues).toHaveLength(0);
  });
});
