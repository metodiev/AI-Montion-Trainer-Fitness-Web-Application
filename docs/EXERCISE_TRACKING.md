# Exercise tracking

How the app turns MediaPipe landmarks into counted repetitions, technique scores and
coaching cues — and how to add a new exercise safely.

- [1. Pipeline](#1-pipeline)
- [2. The normalised pose frame](#2-the-normalised-pose-frame)
- [3. Calibration and the baseline](#3-calibration-and-the-baseline)
- [4. Repetition primitives](#4-repetition-primitives)
- [5. Technique scoring](#5-technique-scoring)
- [6. Trackers](#6-trackers)
- [7. Engine integration](#7-engine-integration)
- [8. Adding an exercise](#8-adding-an-exercise)
- [9. Testing trackers](#9-testing-trackers)
- [10. Known constraints](#10-known-constraints)

---

## 1. Pipeline

```
<video> ──▶ PoseDetectionService.detect() ──▶ createPoseFrame()
                                                │
                                     PoseSmoother (velocity-aware EMA)
                                                │
                              ┌─────────────────┴─────────────────┐
                              ▼                                   ▼
                        skeleton overlay                   ExerciseEngine
                                                       │ arming / gating
                                                       ▼
                                             definition.createTracker()
                                                       │
                                               tracker.update(frame, ctx)
                                                       │
                                        TrackerResult (reps, cues, score…)
                                                       │
                              SessionStage HUD + TechniqueEvaluator + audio
```

- Landmark indices follow the MediaPipe Pose model (`src/core/types.ts#LM`).
- Inference runs at ≤30 fps; the render loop draws every animation frame but only
  re-runs inference when the frame budget allows.
- A tracker is a pure state machine: `reset()`, `update(frame, context)`, no DOM, no
  storage, no timers. `context.now` is monotonic milliseconds.

## 2. The normalised pose frame

`createPoseFrame(landmarks, aspect, timestamp)` produces two coordinate sets:

| Field | Coordinates | Use |
| --- | --- | --- |
| `imageLandmarks` | MediaPipe normalised 0–1, original aspect | drawing only |
| `points` | aspect-corrected, hip-centred, divided by torso length | all measurements |

`aspect` comes from `video.videoWidth / videoHeight`; x and z are multiplied by it so a
normalised x delta and y delta represent the same physical distance. The torso length
is the distance from the mid-shoulder to the mid-hip. Everything downstream is in
**torso units**, so a user standing 1.5 m or 3 m from the camera produces comparable
thresholds, and different body proportions are divided out.

Derived measures (`src/core/pose.ts`):

| Measure | Definition |
| --- | --- |
| `kneeAngle(side)` | 3D angle hip–knee–ankle, 180° = straight |
| `elbowAngle(side)` | 3D angle shoulder–elbow–wrist |
| `torsoLean(frame)` | shoulder-mid → hip-mid angle from vertical |
| `squatDepth(frame, baseline.hipAnkle)` | `1 − hipToAnkle / baseline.hipAnkle`, clamped 0–1.25 |
| `kneeLift(frame, side, baseline.thighVertical)` | `1 − verticalHipKnee / baseline.thighVertical`, 0 = standing, 1 = hip height |
| `shoulderDistance`, `ankleDistance` | 3D widths in torso units |
| `wristAboveShoulder` | + when the wrist is above the shoulder |
| `rawAnkleY` | original image y; used only for jump detection with a fixed camera |

## 3. Calibration and the baseline

`PoseCalibration` runs before any set and returns a `CalibrationSnapshot`. It must
report `phase === 'complete'` with a `baseline` before `SessionStage` can mount.

Checks (each with a progress value and a human-readable hint):

1. **Camera running** – the video element has a live stream.
2. **Head visible** – nose/shoulders above the confidence floor.
3. **Feet visible** – ankles inside the frame with sufficient confidence.
4. **Body centred and full height** – head-to-ankle span and horizontal centre.
5. **Lighting / confidence** – mean landmark visibility.

Once the checks pass, the neutral stance must be held for ~2.4 s. The captured
`PoseBaseline` stores medians of `hipAnkle`, `thighVertical`, `shoulderWidth`,
`ankleWidth`, `torsoLean`, `groundY`, `headY`, plus the sample count. Holding still
matters: a baseline captured mid-movement would make depth and lift measurements wrong.

If landmarks cannot be detected reliably, calibration stalls and the engine never arms
— the app cannot count reps from noise.

## 4. Repetition primitives

### `CycleCounter` — hysteresis state machine

```ts
new CycleCounter({
  mode: 'high' | 'low',
  enter: 0.22,       // activate when value crosses this
  exit: 0.075,       // complete when value returns past this
  countOn: 'exit' | 'enter',
  minActiveMs: 180,  // must stay active this long
  minCycleMs: 520,   // full cycle cannot be faster than this
  cooldownMs: 280,   // ignores new activations after a rep
})
```

- `mode: 'high'` activates when `value ≥ enter` and completes when `value ≤ exit`
  (depth, lift, openness).
- `mode: 'low'` activates when `value ≤ enter` and completes when `value ≥ exit`
  (knee flexion, elbow extension).
- The gap between `enter` and `exit` is hysteresis: jitter around a single threshold
  cannot produce double counts.
- `minActiveMs` rejects twitches, `minCycleMs` rejects bouncing, `cooldownMs` adds a
  dead zone after a counted rep, and the counter re-arms only from the "closed" side.
- A cycle that starts but never reaches the closed side does not count.

### `HoldAccumulator` — time under tension

Adds only the elapsed time between consecutive updates while the pose is valid,
ignores gaps, and exposes `seconds`, `holding`, and a best-streak value. The engine
keeps a credit watermark so pausing cannot retroactively award time.

### `RepIssues` — bounded penalties

Each tracker flags issues with a code, message and weight (e.g. shallow depth −32).
The rep score starts at 100 and subtracts weights, clamped to 0–100. Issues also feed
the cue evaluator, which deduplicates and rate-limits messages.

## 5. Technique scoring

- Per rep: `100 − Σ issue weights` with hard gates for incomplete movements (for
  example a squat with no knee bend is rejected, not scored).
- Live form score: a continuous penalty from the current frame (depth, lean, valgus)
  so the HUD responds before a rep completes.
- Set score: rep-weighted average plus hold quality; the engine blends them only for
  the duration actually spent in the set.
- Points reward quality quadratically — see the README's scoring section.

Cue severity maps to colour: `success` green, `warning` amber, `error` red,
`info` neutral. Cues are prioritised (errors first) and rate-limited per code.

## 6. Trackers

Confidence floors are landmark visibility thresholds (0.3–0.4). When a required joint
is missing, trackers return `bodyLost(...)`, keep the rep count and emit an amber
"stay in frame" cue; the engine treats the frame as invalid for arming.

### Squat — `tracking/squat.ts`

- Signal: `squatDepth`.
- Cycle: high mode, enter `0.22`, exit `0.075`, `minActiveMs 180`,
  `minCycleMs 520`, cooldown `280`.
- Rep valid only when peak knee flexion ≥ 18° and peak depth ≥ 0.22.
- Issues: peak depth < 0.30 ("go deeper") −32 or < 0.45 −14; lean > 40° −18 or
  > 28° −8; knee valgus > 0.075 (frontal view only) −18 or > 0.045 −8; knee
  asymmetry > 22° −10; narrow stance −6. Live cues warn earlier (lean > 24°,
  valgus > 0.045, depth < 0.4) and praise "beautiful depth" when depth ≥ 0.45
  with lean ≤ 20° and valgus ≤ 0.04.
- Camera: front-45° so both the knee bend and hip travel are visible.

### Standing knee raise — `tracking/kneeRaise.ts`

- Signal: `kneeLift` of the active leg. The other leg must stay below 0.4 lift, which
  selects the working side automatically.
- Cycle: high, enter `0.52`, exit `0.20`, `minActiveMs 100`, `minCycleMs 420`.
- Issues: peak lift < 0.62 −24 or < 0.80 −10; knee flexion at the top < 25° −14
  (a straight-leg raise); lean > 25° −14 or > 16° −6; supporting knee flex > 30° −10.
- Side alternation is tracked so `perSide` stats are meaningful; the working leg is
  selected by whichever knee lifts, with the other leg gated below 0.4.

### Jumping jacks — `tracking/jumpingJack.ts`

- Signal: `openness = min(armNorm, legNorm)` where
  `armNorm = (min(wristAboveShoulder) − 0.05) / 0.5` and
  `legNorm = (ankleDistance/shoulderDistance − 1.1) / 0.75`.
- Cycle: high, enter `0.80`, exit `0.32`, `minActiveMs 90`, `minCycleMs 380`.
- Issues: peak openness < 0.86 −12, feet < 0.88 of the target width −12, arms
  < 0.88 of the target reach −12, elbow flex > 32° −10, arm asymmetry > 0.25 −10,
  knee flex > 30° −6. A partial opening held > 400 ms triggers "open all the way".
- Both arms and both legs must open; one-sided movement does not count.

### Forward lunge — `tracking/lunge.ts`

- Signals: lead-leg knee flexion, stance width, knee-over-toe, torso lean.
- Cycle: low mode on lead knee angle — enter `112°`, exit `155°`, `minActiveMs 200`,
  `minCycleMs 620`.
- The working leg is the one with the larger flexion; `perSide` increments.
- A rep whose peak flexion never reaches 40° is rejected as "not a lunge" (−22).
- Issues: peak flexion < 70° −18 or < 82° −8; lean > 35° −15 or > 25° −7;
  knee-over-toe > 0.5 −12 or > 0.38 −6; stance < 0.8 torso units −8; trailing knee
  flexion < 25° −8.
- Camera: side-on or slightly angled, so the lead knee is not foreshortened.

### Arm raise — `tracking/armRaise.ts`

- Signal: elevation of both wrists above the shoulders (torso units, normalised).
- Cycle: high, enter `0.40`, exit `0.06`, `minCycleMs 520`.
- Issues: peak elevation < 0.45 −24 or < 0.58 −10; elbow flex > 30° −12;
  asymmetry > 0.22 −12; lean > 22° −8.

### Wall sit — `tracking/wallSit.ts`

- Hold accumulator; valid while both knees are bent to 68–112°, ankles under the
  baseline ground line, knees even within 20°, lean ≤ 32°.
- Cues while holding: knees above 112° ("sit lower"), below 68° ("do not over-bend"),
  heels lifted, uneven knees. A perfect hold needs knees at 68–112°, heels down,
  knees even within 20° and lean ≤ 32°.
- Time credit only accrues while valid; the engine watermark prevents pause abuse.

### Torso twists — `tracking/torsoTwist.ts`

- Signal: projected shoulder width ratio `|L.x − R.x| / baseline.shoulderWidth`; a
  rotation away from the camera narrows the projected width.
- Requires a frontal baseline (`shoulderWidth ≥ 0.45`), otherwise it asks the user to
  face the camera.
- Cycle: high, enter `0.50`, exit `0.15`, `minCycleMs 600`.
- Issues: peak twist < 0.70 −18 or < 0.85 −8; hips rotating with the shoulders
  (hip width ratio < 0.6) −14; lean > 25° −10.
- Direction is inferred from the z difference and reported per side.

### Push-ups (standard / wide / diamond) — `tracking/pushUp.ts`

- Guard: `horizontalPosture()` must report horizontal; a standing user is rejected.
- Signals: 2D elbow angles (image plane only — using z made lateral hand spacing look
  like elbow bend), body-line angle, hip offset from the shoulder–ankle line, hand
  width deviation for the variant.
- Cycle: low mode on the lower elbow angle — enter `105°`, exit `150°`,
  `minActiveMs 250`, `minCycleMs 500`.
- Issues: elbows do not reach 125° −22 (incomplete), body line < 155° −18,
  hips sag > 0.08 −14, hips pike < −0.10 −12, hands more than 0.3 torso units in
  front of the shoulders −10, hand width off the variant target −8.
- Variants: wide requires wrist separation ≥ 1.28 torso units; diamond ≤ 0.62;
  standard 0.65–1.55 with a deviation allowance.

### Plank — `tracking/plank.ts`

- Valid hold: body line ≥ 160°, `|hipOffset| ≤ 0.10`, wrists within 0.45 of the
  shoulders.
- Cues: hips sagging (`hipOffset > 0.06`), hips piked (`< −0.08`), body line < 155°,
  shoulders behind wrists.
- Time only accrues while valid; a 2 s minimum prevents instant credit.

### High knees — `tracking/highKnees.ts`

- Signal: `kneeLift` with automatic side selection; faster cycle than knee raises.
- Cycle: high, enter `0.56`, exit `0.22`, `minActiveMs 50`, `minCycleMs 250`,
  cooldown `80`.
- Issues: peak lift < 0.66 −24 or < 0.82 −10; lean > 25° −12 or > 17° −6;
  supporting knee flex > 35° −6. Three same-side reps in a row prompts a switch;
  cadence is reported in reps/min and rewarded above 60/min.

### Mountain climbers — `tracking/mountainClimbers.ts`

- Guard: horizontal posture plus hip level within 0.4 torso units.
- Signal: alternating knee drive relative to the hip, with the other leg gated below
  0.4 drive. A 900 ms hip-history window measures hip stability.
- Cycle: high, enter `0.15`, exit `−0.15`, `minCycleMs 300`, cooldown `100`.
- Issues: hips bouncing (`hipRange > 0.12`) −14, hips too high −12, body line < 160° −10.

### Burpees — `tracking/burpee.ts`

Five phases with timeouts and explicit transitions:

```
stand ──(depth>0.24 & hands low)──▶ crouch ──(horizontal & bodyLine>140)──▶ plank
  ▲                                                                          │
  └──(land & depth<0.1)── jump ◀──(stand with depth>0.2)── return ◀──────────┘
```

- `stand → crouch`: squat depth > 0.24 and wrists near the ankles.
- `crouch → plank`: horizontal posture with body line > 140°; 3 s timeout.
- `plank → return`: standing tall again; 5 s timeout.
- `return → jump`: airborne for > 120 ms; 2.2 s timeout flags "no jump" −20.
- A rep completes on landing. Issues: shallow squat −20, sagging plank −18, no jump
  −20, slow transition −8. The plank phase stops accumulating line/hip penalties once
  posture is left, so a normal stand-up does not poison the score.

### Jump squats — `tracking/jumpSquat.ts`

- Phase machine: `ready → squat → awaitJump → landing`.
- Enters squat at depth > 0.22 while grounded; completes only when both feet leave the
  ground (`bothFeetAirborne`: raw ankle lift > 0.012 and `jumpHeight` above baseline).
- Reps are credited only when both feet leave the ground; landing returns to ready.
- Issues: depth < 0.30 −20 or < 0.42 −8; jump height < 0.02 −16 or < 0.035 −6;
  lean > 35° −12; valgus > 0.07 −12. Cues encourage a deeper load and a soft landing.

### Lateral lunges — `tracking/sideLunge.ts`

- Signals: lateral step distance of the working ankle from the mid-hip, depth of the
  working side, other-leg extension, knee valgus on the working leg, lateral torso
  shift.
- Cycle: high, enter `0.20`, exit `0.06`, `minCycleMs 550`.
- A rep with step width < 0.7 torso units or depth < 0.18 is rejected before scoring.
- Issues: depth < 0.30 −12; step < 0.95 −8; trailing knee flexed below 150° −12;
  valgus > 0.07 −15; leaning too far over the working leg (shift > 0.45) −10;
  leaning away (shift < −0.15) −8.

### Single-leg balance — `tracking/balance.ts`

- Exactly one foot lifted, the other grounded, hip tilt < 0.08, lean < 18°, and
  horizontal sway over a 1 s window < 0.12.
- Time accumulates per side; switching sides resets the current side's validity.
- Cues: hip drop > 0.06, lean > 16°, sway > 0.09. Seconds are credited per side only
  while the pose stays valid; switching support resets the current side.

### Plank shoulder taps — `tracking/shoulderTap.ts`

- Guard: horizontal and body line ≥ 140°.
- Signal: alternate wrist distance from its shoulder; each tap is one rep.
- Cycle: low mode — enter `0.50`, exit `0.78`, `minCycleMs 300`.
- A 1.1 s hip window checks stability (range > 0.10) and tilt > 0.18.
- Issues: body line < 155° −16; hip range > 0.10 −12; shoulder tilt > 0.20 −10.
  Live cues warn at body line < 160°, hip range > 0.10 and tilt > 0.18.

## 7. Engine integration

`ExerciseEngine` wraps a tracker and owns session-level policy:

- **Arming**: requires ~500 ms of continuous `ready: true` frames. Until armed, rep
  events are ignored and the HUD shows "finding you".
- **Disarming**: ~650 ms without a usable pose (body lost, camera off, tab hidden).
- **Hold credit**: a watermark on accumulated hold seconds; pausing and resuming never
  awards gap time.
- **Scoring**: sums rep scores and hold quality, tracks best rep, clean reps
  (`score ≥ 70`), points/XP via `RepetitionCounter`, and per-side counts.
- **Finish**: `finish()` produces an `EngineSetResult` with reps, clean reps, hold
  seconds, average/best score, points, XP, per-side counts, issues, duration.

`useSessionRunner` sequences blocks, enforces duration limits, detects target
completion (with a short delay so the last rep paints), handles rest blocks, pause,
skip and "end session", and reports all set results to the workout summary.

## 8. Adding an exercise

1. Create `src/exercises/tracking/myExercise.ts` exporting a class that implements
   `ExerciseTracker` (`reset()` + `update()`).
2. Reuse `CycleCounter`/`HoldAccumulator`/`RepIssues`; choose `enter`/`exit` with a
   clear hysteresis gap and set `minActiveMs`/`minCycleMs` from real movement timing.
3. Normalise every threshold: torso units or degrees. Never use raw pixels.
4. Return `bodyLost()` when required landmarks are below the visibility floor.
5. Add the metadata in `src/exercises/definitions.ts` (instructions, posture, mistakes,
   safety, demo, `createTracker`). The library, planner, HUD and adventure automatically
   pick it up.
6. Add a tracker test with synthetic poses (see below), including a negative case.
7. Update this document with the thresholds.

## 9. Testing trackers

`tests/helpers/pose.ts` builds bodies from the demo skeleton and drives trackers
frame-by-frame at 30 fps:

```ts
import { baselineFrom, drive, frameOf, sideStanding, squatPose } from '../helpers/pose';

const tracker = new SquatTracker();
const run = drive(
  tracker,
  [
    { pose: sideStanding(), ms: 600 },
    { pose: squatPose({ hipFlex: 95, kneeBend: 100 }), ms: 900 },
    { pose: sideStanding(), ms: 600 },
  ],
  { baseline: baselineFrom(sideStanding()) },
);
expect(run.lastResult.reps).toBe(1);
```

Every suite should cover:

- a valid rep / hold,
- an incomplete or shallow attempt that must not count,
- a missing-landmark frame,
- the state transition timings (too fast, cooldown),
- side-specific counting where relevant.

Run `npm test`; a tracker is not "supported" until its suite passes.

## 10. Known constraints

- Occlusion is not inferred. If a wrist or ankle is hidden, the rep is not counted
  rather than guessed.
- 2D knee/elbow angles are view-dependent. The app suggests a camera angle per
  exercise; extreme angles reduce accuracy.
- Jump detection compares raw ankle y against the calibration ground line, so it
  assumes a fixed camera between calibration and set.
- Push-up variants share depth/body-line scoring and differ only by hand width.
- Feedback is heuristic and educational, not medical advice.
