import { clamp } from '@/core/geometry';
import type { Side } from '@/core/types';
import {
  CLEAN_REP_SCORE,
  emptyResult,
  type ChipTone,
  type CoachingCue,
  type RepEvent,
  type TrackerChip,
  type TrackerResult,
} from '../types';

export const cue = (
  code: string,
  message: string,
  severity: CoachingCue['severity'] = 'warning',
): CoachingCue => ({ code, message, severity });

export const bodyLost = (message = 'Step back so I can see your whole body.'): TrackerResult =>
  emptyResult({
    stateLabel: 'No body detected',
    cues: [cue('body-lost', message, 'warning')],
  });

export const notCalibrated = (): TrackerResult =>
  emptyResult({
    stateLabel: 'Calibrating',
    cues: [cue('not-calibrated', 'Hold still in the camera view to calibrate.', 'info')],
  });

export const chip = (label: string, tone: ChipTone = 'neutral'): TrackerChip => ({ label, tone });

export function buildChip(label: string, value: number, good: number, warn: number, suffix = '%'): TrackerChip {
  const rounded = Math.round(clamp(value, 0, 100));
  const tone: ChipTone = rounded >= good ? 'good' : rounded >= warn ? 'warn' : 'bad';
  return { label: `${label} ${rounded}${suffix}`, tone };
}

/** Formats a number for on-screen chips without trailing decimals. */
export const fmt = (value: number, decimals = 0): string => value.toFixed(decimals);

export interface CycleOptions {
  /** 'low': activation when value drops below `enter`. 'high': when it rises above. */
  mode: 'low' | 'high';
  /** Threshold that activates the movement. */
  enter: number;
  /** Threshold that completes the movement. */
  exit: number;
  /** Count the repetition on entering the movement instead of leaving it. */
  countOn?: 'enter' | 'exit';
  minActiveMs?: number;
  minCycleMs?: number;
  cooldownMs?: number;
}

export interface CycleStep {
  active: boolean;
  justActivated: boolean;
  justCompleted: boolean;
  activeMs: number;
}

/**
 * Generic hysteresis state machine for one repetition.
 *
 * It enforces three anti-cheat rules that a simple angle threshold lacks:
 *  - a minimum time spent in the working position (no camera noise reps),
 *  - a minimum full cycle time and cooldown (no double counting), and
 *  - re-arming only after the user genuinely returns to the start position.
 */
export class CycleCounter {
  private readonly options: Required<CycleOptions>;
  private active = false;
  private activatedAt = 0;
  private lastExitAt = Number.NEGATIVE_INFINITY;
  private lastCountAt = Number.NEGATIVE_INFINITY;

  constructor(options: CycleOptions) {
    this.options = {
      countOn: 'exit',
      minActiveMs: 120,
      minCycleMs: 320,
      cooldownMs: 250,
      ...options,
    };
  }

  reset(): void {
    this.active = false;
    this.activatedAt = 0;
    this.lastExitAt = Number.NEGATIVE_INFINITY;
    this.lastCountAt = Number.NEGATIVE_INFINITY;
  }

  get isActive(): boolean {
    return this.active;
  }

  update(value: number, now: number, enabled = true): CycleStep {
    const { mode, enter, exit, countOn, minActiveMs, minCycleMs, cooldownMs } = this.options;
    let justActivated = false;
    let justCompleted = false;

    if (!enabled) {
      if (this.active) {
        this.active = false;
        this.lastExitAt = now;
      }
      return { active: false, justActivated, justCompleted, activeMs: 0 };
    }

    const shouldActivate = mode === 'low' ? value <= enter : value >= enter;
    const shouldExit = mode === 'low' ? value >= exit : value <= exit;

    if (!this.active && shouldActivate) {
      this.active = true;
      this.activatedAt = now;
      justActivated = true;
      if (
        countOn === 'enter' &&
        now - this.lastCountAt >= Math.max(cooldownMs, minCycleMs) &&
        now - this.lastExitAt >= minCycleMs / 2
      ) {
        justCompleted = true;
        this.lastCountAt = now;
      }
    } else if (this.active && shouldExit) {
      const activeMs = now - this.activatedAt;
      this.active = false;
      this.lastExitAt = now;
      if (
        countOn === 'exit' &&
        activeMs >= minActiveMs &&
        activeMs >= minCycleMs &&
        now - this.lastCountAt >= cooldownMs
      ) {
        justCompleted = true;
        this.lastCountAt = now;
      }
    }

    return {
      active: this.active,
      justActivated,
      justCompleted,
      activeMs: this.active ? now - this.activatedAt : 0,
    };
  }
}

/** Accumulates valid hold time with a short grace period for sensor noise. */
export class HoldAccumulator {
  seconds = 0;
  private invalidMs = 0;
  private lastDt = 0;
  private broken = false;

  reset(): void {
    this.seconds = 0;
    this.invalidMs = 0;
    this.broken = false;
  }

  update(dtMs: number, valid: boolean, graceMs = 450): { seconds: number; holding: boolean; broke: boolean } {
    const dt = clamp(dtMs || this.lastDt, 0, 250);
    this.lastDt = dt;
    if (valid) {
      this.seconds += dt / 1000;
      this.invalidMs = 0;
      this.broken = false;
      return { seconds: this.seconds, holding: true, broke: false };
    }
    this.invalidMs += dt;
    const broke = this.invalidMs > graceMs && !this.broken;
    if (broke) this.broken = true;
    return { seconds: this.seconds, holding: false, broke };
  }
}

/**
 * Collects the worst form violation seen during a repetition. Repetition score
 * is dominated by the single worst fault, which is how real coaches prioritise
 * corrections instead of averaging mistakes away.
 */
export class RepIssues {
  private issues = new Map<string, { message: string; penalty: number }>();

  reset(): void {
    this.issues.clear();
  }

  flag(code: string, message: string, penalty: number): void {
    const existing = this.issues.get(code);
    if (!existing || penalty > existing.penalty) {
      this.issues.set(code, { message, penalty });
    }
  }

  get penalty(): number {
    return [...this.issues.values()].reduce((sum, issue) => sum + issue.penalty, 0);
  }

  get score(): number {
    return Math.round(clamp(100 - this.penalty, 0, 100));
  }

  get messages(): string[] {
    return [...this.issues.values()].map((issue) => issue.message);
  }
}

export function makeRepEvent(
  index: number,
  score: number,
  side: Side | null,
  durationMs: number,
  issues: string[],
  at: number,
): RepEvent {
  return {
    index,
    side,
    score,
    clean: score >= CLEAN_REP_SCORE,
    durationMs: Math.round(durationMs),
    issues,
    at,
  };
}

export function liveScore(penalties: number[]): number {
  const total = penalties.reduce((sum, value) => sum + value, 0);
  return Math.round(clamp(100 - total, 0, 100));
}

export function statusFromScore(score: number): ChipTone {
  return score >= 85 ? 'good' : score >= 65 ? 'warn' : 'bad';
}

/** 0..1 progress toward a target, tolerant of slightly exceeding it. */
export function progressTo(value: number, target: number): number {
  if (target <= 0) return 0;
  return clamp(value / target, 0, 1);
}

export function targetLabel(done: number, target: number, unit = 'reps'): string {
  return `${done}/${target} ${unit}`;
}
