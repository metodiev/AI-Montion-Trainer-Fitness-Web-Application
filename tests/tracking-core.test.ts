import { describe, expect, it } from 'vitest';
import {
  CycleCounter,
  HoldAccumulator,
  RepIssues,
} from '@/exercises/tracking/core';

describe('CycleCounter', () => {
  it('counts a complete low-mode cycle and requires re-arming', () => {
    const counter = new CycleCounter({
      mode: 'low',
      enter: 0.2,
      exit: 0.7,
      minActiveMs: 150,
      minCycleMs: 400,
      cooldownMs: 200,
    });

    expect(counter.update(0.5, 0).justCompleted).toBe(false);
    expect(counter.update(0.15, 100).justActivated).toBe(true);
    expect(counter.update(0.1, 300).justCompleted).toBe(false);
    expect(counter.update(0.8, 500).justCompleted).toBe(true);
    expect(counter.update(0.8, 550).justCompleted).toBe(false);
    expect(counter.update(0.15, 600).justActivated).toBe(true);
  });

  it('rejects cycles that are too shallow or too fast', () => {
    const counter = new CycleCounter({
      mode: 'high',
      enter: 0.3,
      exit: 0.05,
      minActiveMs: 200,
      minCycleMs: 400,
      cooldownMs: 200,
    });
    counter.update(0.4, 100);
    expect(counter.update(0.02, 250).justCompleted).toBe(false);
    counter.update(0.4, 500);
    expect(counter.update(0.02, 550).justCompleted).toBe(false);
    expect(counter.update(0.02, 900).justCompleted).toBe(false);
  });

  it('requires a return to the start position between reps', () => {
    const counter = new CycleCounter({
      mode: 'high',
      enter: 0.8,
      exit: 0.3,
      minActiveMs: 200,
      minCycleMs: 400,
      cooldownMs: 100,
    });
    expect(counter.update(0.9, 0).justActivated).toBe(true);
    expect(counter.update(0.95, 100).justCompleted).toBe(false);
    expect(counter.update(0.2, 250).justCompleted).toBe(false);
    expect(counter.update(0.9, 350).justActivated).toBe(true);
    expect(counter.update(0.2, 600).justCompleted).toBe(false);
    expect(counter.update(0.9, 1000).justActivated).toBe(true);
    expect(counter.update(0.2, 1600).justCompleted).toBe(true);
  });

  it('can count when entering the working position', () => {
    const counter = new CycleCounter({
      mode: 'high',
      enter: 0.8,
      exit: 0.3,
      countOn: 'enter',
      minCycleMs: 400,
      cooldownMs: 200,
    });
    counter.update(0.1, 0);
    expect(counter.update(0.9, 100).justCompleted).toBe(true);
    expect(counter.update(0.9, 200).justCompleted).toBe(false);
    counter.update(0.2, 300);
    expect(counter.update(0.9, 400).justCompleted).toBe(false);
    expect(counter.update(0.2, 450).justCompleted).toBe(false);
    expect(counter.update(0.9, 700).justCompleted).toBe(true);
  });

  it('does not count while disabled and disarms safely', () => {
    const counter = new CycleCounter({
      mode: 'low',
      enter: 0.2,
      exit: 0.7,
      minActiveMs: 0,
      minCycleMs: 0,
      cooldownMs: 0,
    });
    counter.update(0.1, 100, false);
    expect(counter.isActive).toBe(false);
    expect(counter.update(0.8, 200).justCompleted).toBe(false);
    expect(counter.update(0.1, 300, true).justActivated).toBe(true);
    expect(counter.update(0.8, 400).justCompleted).toBe(true);
  });
});

describe('HoldAccumulator', () => {
  it('accumulates valid hold time only', () => {
    const hold = new HoldAccumulator();
    expect(hold.update(100, true).seconds).toBeCloseTo(0.1, 5);
    expect(hold.update(100, true).seconds).toBeCloseTo(0.2, 5);
    expect(hold.update(100, false).holding).toBe(false);
    expect(hold.update(100, true).seconds).toBeCloseTo(0.3, 5);
  });

  it('reports a break after the grace period', () => {
    const hold = new HoldAccumulator();
    hold.update(100, true);
    expect(hold.update(300, false, 450).broke).toBe(false);
    expect(hold.update(300, false, 450).broke).toBe(true);
    expect(hold.update(100, false, 450).broke).toBe(false);
  });
});

describe('RepIssues', () => {
  it('keeps the worst penalty per fault and computes a score', () => {
    const issues = new RepIssues();
    issues.flag('depth', 'Go deeper', 10);
    issues.flag('depth', 'Go deeper', 25);
    issues.flag('torso', 'Stay tall', 10);
    expect(issues.score).toBe(65);
    expect(issues.messages).toHaveLength(2);
    issues.reset();
    expect(issues.score).toBe(100);
  });

  it('never returns a negative score', () => {
    const issues = new RepIssues();
    issues.flag('a', 'A', 80);
    issues.flag('b', 'B', 80);
    expect(issues.score).toBe(0);
  });
});
