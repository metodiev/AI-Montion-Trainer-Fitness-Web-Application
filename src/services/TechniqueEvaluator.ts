import { clamp } from '@/core/geometry';
import type { CoachingCue, CueSeverity, RepEvent } from '@/exercises/types';

const SEVERITY_PRIORITY: Record<CueSeverity, number> = {
  error: 0,
  warning: 1,
  success: 2,
  info: 3,
};

const COOLDOWN_MS: Record<CueSeverity, number> = {
  error: 2600,
  warning: 3200,
  success: 2600,
  info: 4500,
};

/**
 * Aggregates technique over a set and decides which coaching cue deserves the
 * screen at any moment. Unlike a raw stream of messages, it never spams the
 * same instruction and always lets safety errors outrank praise.
 */
export class TechniqueEvaluator {
  private liveQualitySeconds = 0;
  private liveSeconds = 0;
  private repScoreTotal = 0;
  private reps = 0;
  private bestRep = 0;
  private cueShownAt = Number.NEGATIVE_INFINITY;
  private lastByCode = new Map<string, number>();
  private lastCueSeverity: CueSeverity | null = null;
  private lastSuccessAt = Number.NEGATIVE_INFINITY;
  private recentIssues = new Map<string, number>();

  reset(): void {
    this.liveQualitySeconds = 0;
    this.liveSeconds = 0;
    this.repScoreTotal = 0;
    this.reps = 0;
    this.bestRep = 0;
    this.cueShownAt = Number.NEGATIVE_INFINITY;
    this.lastByCode.clear();
    this.lastCueSeverity = null;
    this.lastSuccessAt = Number.NEGATIVE_INFINITY;
    this.recentIssues.clear();
  }

  addLiveSample(score: number, dtMs: number): void {
    const dt = clamp(dtMs, 0, 250) / 1000;
    if (dt <= 0) return;
    this.liveSeconds += dt;
    this.liveQualitySeconds += dt * clamp(score, 0, 100);
  }

  registerRep(event: RepEvent): void {
    this.reps += 1;
    this.repScoreTotal += event.score;
    this.bestRep = Math.max(this.bestRep, event.score);
    for (const issue of event.issues) {
      this.recentIssues.set(issue, (this.recentIssues.get(issue) ?? 0) + 1);
    }
  }

  get averageLiveScore(): number {
    return this.liveSeconds > 0 ? this.liveQualitySeconds / this.liveSeconds : 0;
  }

  get bestRepScore(): number {
    return this.bestRep;
  }

  /** Technique score for the set: reps dominate, holds fill in the rest. */
  get sessionScore(): number {
    const repAverage = this.reps > 0 ? this.repScoreTotal / this.reps : null;
    const liveAverage = this.liveSeconds > 1 ? this.averageLiveScore : null;
    if (repAverage !== null && liveAverage !== null) {
      return Math.round(repAverage * 0.75 + liveAverage * 0.25);
    }
    return Math.round(repAverage ?? liveAverage ?? 0);
  }

  get frequentIssues(): string[] {
    return [...this.recentIssues.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([issue]) => issue);
  }

  /**
   * Returns the single best cue to display, or null while throttled.
   */
  pickCue(cues: CoachingCue[], now: number): CoachingCue | null {
    if (cues.length === 0) return null;
    if (now - this.cueShownAt < 650) return null;

    const unique = new Map<string, CoachingCue>();
    for (const cue of cues) {
      if (!unique.has(cue.code)) unique.set(cue.code, cue);
    }
    const sorted = [...unique.values()].sort(
      (a, b) => SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity],
    );

    const hasTrouble = sorted.some((cue) => cue.severity === 'error' || cue.severity === 'warning');

    for (const cue of sorted) {
      if (cue.severity === 'success' && (hasTrouble || now - this.lastSuccessAt < 3500)) continue;
      if (cue.severity === 'info' && hasTrouble) continue;
      if (this.lastCueSeverity === 'error' && cue.severity !== 'error' && now - this.cueShownAt < 1800) {
        continue;
      }
      const lastForCode = this.lastByCode.get(cue.code) ?? Number.NEGATIVE_INFINITY;
      if (now - lastForCode < COOLDOWN_MS[cue.severity]) continue;
      this.lastByCode.set(cue.code, now);
      this.cueShownAt = now;
      this.lastCueSeverity = cue.severity;
      if (cue.severity === 'success') this.lastSuccessAt = now;
      return cue;
    }
    return null;
  }
}
