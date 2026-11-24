import type { PoseBaseline, PoseFrame, Side } from '@/core/types';
import type {
  CoachingCue,
  ExerciseDefinition,
  ExerciseTracker,
  TrackerChip,
  TrackerResult,
} from '@/exercises/types';
import type { ExerciseId } from '@/exercises/types';
import { RepetitionCounter } from './RepetitionCounter';
import { TechniqueEvaluator } from './TechniqueEvaluator';

export interface EngineSnapshot {
  ready: boolean;
  tracking: boolean;
  armed: boolean;
  reps: number;
  cleanReps: number;
  points: number;
  xp: number;
  formScore: number;
  averageScore: number;
  progress: number;
  stateLabel: string;
  holdSeconds: number;
  side: Side | null;
  cue: CoachingCue | null;
  cues: CoachingCue[];
  chips: TrackerChip[];
  metrics: Record<string, number>;
  repEvent?: TrackerResult['repEvent'];
  bodyLost: boolean;
}

export interface EngineSetResult {
  exerciseId: ExerciseId;
  reps: number;
  cleanReps: number;
  holdSeconds: number;
  averageScore: number;
  bestRepScore: number;
  points: number;
  xp: number;
  perSide: Record<Side, number>;
  issues: string[];
  durationSec: number;
}

export interface ExerciseEngineOptions {
  definition: ExerciseDefinition;
  baseline: PoseBaseline;
  armDelayMs?: number;
  loseDelayMs?: number;
}

const EMPTY_RESULT: TrackerResult = {
  ready: false,
  reps: 0,
  stateLabel: 'Waiting for camera',
  formScore: 0,
  progress: 0,
  cues: [],
  holdSeconds: 0,
  side: null,
  metrics: {},
  chips: [],
};

/**
 * Ties a tracker, the repetition ledger and the coaching evaluator together.
 *
 * The engine keeps the game honest: no repetition or hold credit is accepted
 * until the pose has been reliably visible for a short arming period, and it
 * pauses again when the body leaves the frame.
 */
export class ExerciseEngine {
  readonly definition: ExerciseDefinition;
  private readonly tracker: ExerciseTracker;
  private readonly counter = new RepetitionCounter();
  private readonly evaluator = new TechniqueEvaluator();
  private readonly baseline: PoseBaseline;
  private readonly armDelayMs: number;
  private readonly loseDelayMs: number;
  private lastResult: TrackerResult = EMPTY_RESULT;
  private lastFrameAt: number | null = null;
  private readySince: number | null = null;
  private lostSince: number | null = null;
  private armed = false;
  private lastHoldCredited = 0;
  private cues: CoachingCue[] = [];
  private bodyLost = false;
  private startedAt: number | null = null;
  private lastNow = 0;
  private repEvents: TrackerResult['repEvent'][] = [];

  constructor(options: ExerciseEngineOptions) {
    this.definition = options.definition;
    this.baseline = options.baseline;
    this.tracker = options.definition.createTracker();
    this.armDelayMs = options.armDelayMs ?? 500;
    this.loseDelayMs = options.loseDelayMs ?? 650;
  }

  update(frame: PoseFrame | null, now: number): EngineSnapshot {
    if (this.startedAt === null) this.startedAt = now;
    const dt = this.lastFrameAt === null ? 0 : Math.max(0, Math.min(250, now - this.lastFrameAt));
    this.lastFrameAt = now;
    this.lastNow = now;

    let result: TrackerResult;
    if (!frame) {
      result = {
        ...this.lastResult,
        ready: false,
        cues: [
          {
            code: 'body-lost',
            message: 'Step into the camera view so I can see you.',
            severity: 'warning',
          },
        ],
      };
      this.bodyLost = true;
    } else {
      result = this.tracker.update(frame, { baseline: this.baseline, now, dtMs: dt });
      this.bodyLost = false;
    }
    this.lastResult = result;

    if (result.ready) {
      this.lostSince = null;
      if (this.readySince === null) this.readySince = now;
      if (!this.armed && now - this.readySince >= this.armDelayMs) {
        this.armed = true;
      }
    } else {
      this.readySince = null;
      if (this.lostSince === null) this.lostSince = now;
      if (this.armed && now - this.lostSince >= this.loseDelayMs) {
        this.armed = false;
      }
    }

    if (result.repEvent && this.armed) {
      const accepted = this.counter.add(result.repEvent);
      if (accepted !== null) {
        this.evaluator.registerRep(result.repEvent);
        this.repEvents.push(result.repEvent);
      }
    }

    if (this.armed && result.holdSeconds > this.lastHoldCredited) {
      const delta = result.holdSeconds - this.lastHoldCredited;
      this.counter.addHoldDelta(delta, result.formScore);
      this.lastHoldCredited = result.holdSeconds;
    }
    // Keep the watermark current even when disarmed so a pause cannot grant
    // retroactive hold credit when tracking resumes.
    if (result.holdSeconds > this.lastHoldCredited) {
      this.lastHoldCredited = result.holdSeconds;
    }

    if (result.ready) {
      this.evaluator.addLiveSample(result.formScore, dt);
    }

    const engineCues: CoachingCue[] = [];
    if (!frame) {
      engineCues.push({
        code: 'body-lost',
        message: 'Step into the camera view so I can see you.',
        severity: 'warning',
      });
    } else if (!this.armed) {
      engineCues.push({
        code: result.ready ? 'arming' : 'tracking-paused',
        message: result.ready
          ? 'Hold still for a moment — locking on.'
          : 'Tracking paused. Show your whole body to resume.',
        severity: result.ready ? 'info' : 'warning',
      });
    }
    this.cues = [...engineCues, ...result.cues];
    const cue = this.evaluator.pickCue(this.cues, now);

    const stats = this.counter.stats;
    return {
      ready: result.ready,
      tracking: this.armed && result.ready,
      armed: this.armed,
      reps: stats.reps,
      cleanReps: stats.cleanReps,
      points: stats.points,
      xp: stats.xp,
      formScore: result.formScore,
      averageScore: this.evaluator.sessionScore,
      progress: result.progress,
      stateLabel: this.armed ? result.stateLabel : result.ready ? 'Locking on' : 'Paused',
      holdSeconds: stats.holdSeconds,
      side: result.side,
      cue,
      cues: this.cues,
      chips: result.chips,
      metrics: result.metrics,
      repEvent: result.repEvent && this.armed ? result.repEvent : undefined,
      bodyLost: this.bodyLost,
    };
  }

  finish(): EngineSetResult {
    const stats = this.counter.stats;
    const now = this.lastNow || Date.now();
    return {
      exerciseId: this.definition.id,
      reps: stats.reps,
      cleanReps: stats.cleanReps,
      holdSeconds: Math.round(stats.holdSeconds * 10) / 10,
      averageScore: this.evaluator.sessionScore,
      bestRepScore: stats.bestRepScore,
      points: stats.points,
      xp: stats.xp,
      perSide: stats.perSide,
      issues: this.evaluator.frequentIssues,
      durationSec: this.startedAt ? Math.max(0, Math.round((now - this.startedAt) / 1000)) : 0,
    };
  }

  get armedForCounting(): boolean {
    return this.armed;
  }
}
