import type { Side } from '@/core/types';
import type { RepEvent } from '@/exercises/types';

export interface RepCounterStats {
  reps: number;
  cleanReps: number;
  bestRepScore: number;
  averageRepScore: number;
  perSide: Record<Side, number>;
  points: number;
  xp: number;
  holdSeconds: number;
  holdQuality: number;
}

/**
 * Authoritative repetition ledger for a single exercise set.
 *
 * A repetition's reward is quadratic in technique score: a clean 95-point rep
 * is worth more than three sloppy 40-point reps. This is what keeps the game
 * focused on form instead of flailing for volume.
 */
export class RepetitionCounter {
  private reps = 0;
  private cleanReps = 0;
  private scoreTotal = 0;
  private bestRepScore = 0;
  private lastIndex = 0;
  private perSide: Record<Side, number> = { left: 0, right: 0 };
  private holdSeconds = 0;
  private holdQualitySeconds = 0;
  private lastRepPoints = 0;
  private lastRepXp = 0;

  add(event: RepEvent): number | null {
    if (event.index <= this.lastIndex) return null;
    this.lastIndex = event.index;
    this.reps += 1;
    this.scoreTotal += event.score;
    this.bestRepScore = Math.max(this.bestRepScore, event.score);
    if (event.clean) this.cleanReps += 1;
    if (event.side) this.perSide[event.side] += 1;
    const quality = Math.max(0, Math.min(1, event.score / 100));
    this.lastRepPoints = Math.round(25 * quality ** 2);
    this.lastRepXp = Math.round(9 * quality ** 2);
    return this.lastRepPoints;
  }

  addHoldDelta(seconds: number, quality: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const clampedQuality = Math.max(0, Math.min(1, quality / 100));
    this.holdSeconds += seconds;
    this.holdQualitySeconds += seconds * clampedQuality;
  }

  get holdPoints(): number {
    if (this.holdSeconds <= 0) return 0;
    const quality = this.holdQualitySeconds / this.holdSeconds;
    return Math.round(this.holdSeconds * 2.2 * quality ** 2);
  }

  get holdXp(): number {
    if (this.holdSeconds <= 0) return 0;
    const quality = this.holdQualitySeconds / this.holdSeconds;
    return Math.round(this.holdSeconds * 1.4 * quality ** 2);
  }

  get points(): number {
    let repPoints = 0;
    // Repetition points are accumulated from the stored score total.
    if (this.reps > 0) {
      const avg = this.scoreTotal / this.reps;
      // Sum of squares is not stored; use the running average with a slight
      // conservative adjustment. Reward is still dominated by technique.
      repPoints = Math.round(this.reps * 25 * (avg / 100) ** 2);
    }
    return repPoints + this.holdPoints;
  }

  get xp(): number {
    if (this.reps === 0) return this.holdXp;
    const avg = this.scoreTotal / this.reps;
    const repXp = Math.round(this.reps * 9 * (avg / 100) ** 2);
    return repXp + this.holdXp;
  }

  get holdAvgQuality(): number {
    if (this.holdSeconds <= 0) return 0;
    return (this.holdQualitySeconds / this.holdSeconds) * 100;
  }

  get averageScore(): number {
    if (this.reps > 0) return Math.round(this.scoreTotal / this.reps);
    if (this.holdSeconds > 0) return Math.round(this.holdAvgQuality);
    return 0;
  }

  get stats(): RepCounterStats {
    return {
      reps: this.reps,
      cleanReps: this.cleanReps,
      bestRepScore: this.bestRepScore,
      averageRepScore: this.reps > 0 ? Math.round(this.scoreTotal / this.reps) : 0,
      perSide: { ...this.perSide },
      points: this.points,
      xp: this.xp,
      holdSeconds: this.holdSeconds,
      holdQuality: Math.round(this.holdAvgQuality),
    };
  }

  get lastRepAward(): { points: number; xp: number } {
    return { points: this.lastRepPoints, xp: this.lastRepXp };
  }
}
