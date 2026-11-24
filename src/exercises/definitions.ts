import {
  frontFigure,
  groundedSideFigure,
  kneeRaiseFigure,
  lungeFigure,
  mirrorPose,
  plankFigure,
  sideFigure,
  sideLungeFigure,
  twistFigure,
  type DemoSpec,
} from '@/core/skeleton';
import { LM } from '@/core/types';
import type { ExerciseDefinition, ExerciseId } from './types';
import { SquatTracker } from './tracking/squat';
import { KneeRaiseTracker } from './tracking/kneeRaise';
import { ArmRaiseTracker } from './tracking/armRaise';
import { JumpingJackTracker } from './tracking/jumpingJack';
import { WallSitTracker } from './tracking/wallSit';
import { TorsoTwistTracker } from './tracking/torsoTwist';
import { LungeTracker } from './tracking/lunge';
import { PushUpTracker } from './tracking/pushUp';
import { PlankTracker } from './tracking/plank';
import { HighKneesTracker } from './tracking/highKnees';
import { MountainClimbersTracker } from './tracking/mountainClimbers';
import { BurpeeTracker } from './tracking/burpee';
import { JumpSquatTracker } from './tracking/jumpSquat';
import { SideLungeTracker } from './tracking/sideLunge';
import { SingleLegBalanceTracker } from './tracking/balance';
import { PlankShoulderTapTracker } from './tracking/shoulderTap';

const SQ = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle];
const ARMS = [LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist];
const ALL = [...SQ, ...ARMS];

const stand = sideFigure({ rootY: 0.55 });
const frontStand = frontFigure({ rootY: 0.56 });
const deepSquat = groundedSideFigure({
  hipFlex: 95,
  kneeBend: 115,
  lean: 12,
  armFlexL: 88,
  armFlexR: 88,
});
const wallSit = groundedSideFigure({ hipFlex: 78, kneeBend: 88, lean: 0, armFlexL: 88, armFlexR: 88 });
const jump = sideFigure({ rootY: 0.55, lift: 0.075, armFlexL: 160, armFlexR: 160 });
const plankTop = plankFigure({ elbowBend: 0 });
const plankBottom = plankFigure({ elbowBend: 1 });
const pushUpDemo: DemoSpec = {
  view: 'side',
  loop: true,
  keyframes: [
    { pose: plankTop, durationMs: 900, caption: 'Hands under shoulders' },
    { pose: plankBottom, durationMs: 900, caption: 'Chest to the floor' },
    { pose: plankTop, durationMs: 700, caption: 'Press back up' },
  ],
};
const squatDemo: DemoSpec = {
  view: 'side',
  loop: true,
  keyframes: [
    { pose: stand, durationMs: 800, caption: 'Stand tall' },
    { pose: deepSquat, durationMs: 1100, caption: 'Hips back and down' },
    { pose: stand, durationMs: 900, caption: 'Drive through your heels' },
  ],
};
const jackClosed = frontFigure({ rootY: 0.56 });
const jackOpen = frontFigure({ rootY: 0.56, lift: 0.012, armAbductL: 168, armAbductR: 168, legSpreadL: 30, legSpreadR: 30 });
const jumpingJackDemo: DemoSpec = {
  view: 'front',
  loop: true,
  keyframes: [
    { pose: jackClosed, durationMs: 700, caption: 'Feet together' },
    { pose: jackOpen, durationMs: 500, caption: 'Arms overhead, feet wide' },
    { pose: jackOpen, durationMs: 200 },
    { pose: jackClosed, durationMs: 500, caption: 'Close and land softly' },
  ],
};
const burpeeCrouch = groundedSideFigure({
  hipFlex: 100,
  kneeBend: 115,
  lean: 35,
  armFlexL: 35,
  armFlexR: 35,
  elbowL: 10,
  elbowR: 10,
});
const burpeeDemo: DemoSpec = {
  view: 'side',
  loop: true,
  keyframes: [
    { pose: stand, durationMs: 800, caption: 'Stand tall' },
    { pose: burpeeCrouch, durationMs: 900, caption: 'Hands down' },
    { pose: plankTop, durationMs: 900, caption: 'Kick back to plank' },
    { pose: burpeeCrouch, durationMs: 600, caption: 'Feet back in' },
    { pose: jump, durationMs: 700, caption: 'Jump and reach' },
    { pose: stand, durationMs: 600 },
  ],
};

const baseSafety = ['Stop immediately if you feel sharp pain or dizziness.'];

export const EXERCISE_DEFINITIONS: ExerciseDefinition[] = [
  {
    id: 'squat',
    name: 'Bodyweight Squat',
    difficulty: 'beginner',
    focus: ['lower-body', 'full-body'],
    metric: 'reps',
    targetReps: 12,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 5.5,
    cameraView: 'front',
    cameraHint: 'Face the camera, or turn 30–45° so your knee bend is visible. Keep head and feet in frame.',
    summary: 'The foundation lower-body movement: sit your hips back, then stand tall through your heels.',
    instructions: [
      'Stand with your feet about shoulder-width apart, toes slightly turned out.',
      'Brace your core, lift your chest and reach your arms forward for balance.',
      'Push your hips back and bend your knees, lowering until your thighs are near parallel.',
      'Drive through your whole foot to stand tall, squeezing your glutes at the top.',
    ],
    posture: [
      'Knees track in line with your middle toes.',
      'Chest stays lifted; the torso leans forward only slightly.',
      'Weight stays centred over the middle of each foot.',
    ],
    mistakes: [
      'Hips rising faster than the shoulders on the way up.',
      'Knees collapsing inward.',
      'Heels lifting off the floor.',
    ],
    safety: [
      ...baseSafety,
      'Keep the range comfortable; a shallow squat done well beats a deep one with pain.',
    ],
    requiredLandmarks: SQ,
    trackingNotes:
      'Counts a rep only after the hips descend at least 22% of standing hip height and return to standing. The knee angle confirms the legs are bending. Depth, torso lean, knee tracking and left/right symmetry determine the technique score.',
    demo: squatDemo,
    createTracker: () => new SquatTracker(),
  },
  {
    id: 'knee-raise',
    name: 'Standing Knee Raise',
    difficulty: 'beginner',
    focus: ['lower-body', 'full-body'],
    metric: 'reps',
    targetReps: 16,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 4.5,
    cameraView: 'front',
    cameraHint: 'Face the camera with your hips, knees and feet visible.',
    summary: 'A controlled standing core and hip-flexor drill that teaches balance and knee control.',
    instructions: [
      'Stand tall with your feet hip-width apart and hands on your hips.',
      'Shift your weight onto one leg and lift the other knee toward hip height.',
      'Pause briefly without leaning back, then lower the foot with control.',
      'Alternate legs at a steady, controlled pace.',
    ],
    posture: [
      'Torso stays upright and tall.',
      'Standing leg stays strong with a soft knee.',
      'Knee lifts to roughly hip height.',
    ],
    mistakes: [
      'Leaning the torso backward to lift the knee.',
      'Letting the standing knee collapse inward.',
      'Swinging the leg instead of lifting with control.',
    ],
    safety: [...baseSafety, 'Use a wall or chair for balance if you feel unsteady.'],
    requiredLandmarks: SQ,
    trackingNotes:
      'Each side has its own state machine. A rep counts when the knee rises above 52% of the calibrated thigh lift and then returns below 20%. Torso lean and support-leg flexion reduce the score.',
    demo: {
      view: 'front',
      loop: true,
      keyframes: [
        { pose: frontStand, durationMs: 800, caption: 'Stand tall' },
        { pose: kneeRaiseFigure('left'), durationMs: 900, caption: 'Knee to hip height' },
        { pose: frontStand, durationMs: 600 },
        { pose: kneeRaiseFigure('right'), durationMs: 900, caption: 'Switch sides' },
        { pose: frontStand, durationMs: 600 },
      ],
    },
    createTracker: () => new KneeRaiseTracker(),
  },
  {
    id: 'arm-raise',
    name: 'Standing Arm Raise',
    difficulty: 'beginner',
    focus: ['upper-body', 'mobility'],
    metric: 'reps',
    targetReps: 12,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 3,
    cameraView: 'front',
    cameraHint: 'Face the camera with your arms and shoulders visible.',
    summary: 'A shoulder mobility staple that improves overhead range and posture.',
    instructions: [
      'Stand tall with your arms by your sides and feet hip-width apart.',
      'Keep your elbows straight and raise both arms out and overhead.',
      'Reach for the ceiling without arching your lower back.',
      'Lower slowly back to your sides with control.',
    ],
    posture: [
      'Ribs stay stacked over your hips.',
      'Elbows stay long and straight.',
      'Both hands reach the same height.',
    ],
    mistakes: [
      'Leaning back to fake extra range.',
      'Bending the elbows and shortening the reach.',
      'Raising one arm noticeably higher than the other.',
    ],
    safety: [...baseSafety, 'Keep the range pain-free; stop below shoulder pain.'],
    requiredLandmarks: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip, ...ARMS],
    trackingNotes:
      'Both wrists must rise above the shoulders. Reps count when the lower arm clears 40% of the calibrated reach and both arms return down. Elbow bend, arm asymmetry and torso lean are scored.',
    demo: {
      view: 'front',
      loop: true,
      keyframes: [
        { pose: frontStand, durationMs: 800, caption: 'Arms by your sides' },
        { pose: frontFigure({ rootY: 0.56, armAbductL: 95, armAbductR: 95 }), durationMs: 500 },
        { pose: frontFigure({ rootY: 0.56, armAbductL: 168, armAbductR: 168 }), durationMs: 800, caption: 'Reach overhead' },
        { pose: frontStand, durationMs: 800, caption: 'Lower with control' },
      ],
    },
    createTracker: () => new ArmRaiseTracker(),
  },
  {
    id: 'jumping-jack',
    name: 'Jumping Jacks',
    difficulty: 'beginner',
    focus: ['full-body'],
    metric: 'reps',
    targetReps: 20,
    targetSeconds: 0,
    lowImpact: false,
    caloriesPerMinute: 8,
    cameraView: 'front',
    cameraHint: 'Face the camera with enough room for your arms and legs to open wide.',
    summary: 'A classic full-body cardio move that raises your heart rate and warms up every joint.',
    instructions: [
      'Stand with your feet together and arms at your sides.',
      'Jump your feet wide as you swing both arms overhead.',
      'Jump back to the start with soft knees and arms down.',
      'Keep a steady rhythm and stay light on your feet.',
    ],
    posture: [
      'Arms reach fully overhead, elbows long.',
      'Feet land about one leg-length apart.',
      'Knees stay soft on every landing.',
    ],
    mistakes: [
      'Only doing half the arm swing.',
      'Landing with stiff, locked knees.',
      'Bending the elbows and losing the overhead reach.',
    ],
    safety: [...baseSafety, 'Switch to step-outs if jumping bothers your knees or neighbours.'],
    requiredLandmarks: ALL,
    trackingNotes:
      'A rep requires both the arms overhead and a wide foot stance, then a full return to arms-down/feet-together. A hysteresis gate and minimum cycle time prevent partial reps and noise from double counting.',
    demo: jumpingJackDemo,
    createTracker: () => new JumpingJackTracker(),
  },
  {
    id: 'wall-sit',
    name: 'Wall Sit',
    difficulty: 'beginner',
    focus: ['lower-body'],
    metric: 'time',
    targetReps: 0,
    targetSeconds: 30,
    lowImpact: true,
    caloriesPerMinute: 4,
    cameraView: 'side',
    cameraHint: 'Stand side-on to the camera so your hip and knee angles are visible. Keep your whole body in frame.',
    summary: 'An isometric quad burn: hold a seated position with your back supported by a wall.',
    instructions: [
      'Stand with your back against a wall, feet about a step forward.',
      'Slide down until your thighs are roughly parallel to the floor.',
      'Keep your knees over your ankles and your back flat against the wall.',
      'Breathe steadily and hold; slide up to finish.',
    ],
    posture: [
      'Thighs parallel to the floor, knees near 90°.',
      'Knees stacked over ankles.',
      'Lower back stays in contact with the wall.',
    ],
    mistakes: [
      'Hips too high and thighs sloping downward.',
      'Knees travelling far past the toes.',
      'Holding your breath or rounding your back.',
    ],
    safety: [...baseSafety, 'Come out of the hold if your knees ache rather than burn.'],
    requiredLandmarks: SQ,
    trackingNotes:
      'Time accumulates only while both knees sit between 68° and 112°, feet stay on the calibration ground line, and the torso stays within 32° of vertical. Breaking alignment pauses the hold.',
    demo: {
      view: 'side',
      loop: true,
      wall: true,
      keyframes: [
        { pose: stand, durationMs: 900, caption: 'Back against the wall' },
        { pose: wallSit, durationMs: 1500, caption: 'Thighs parallel — hold' },
        { pose: wallSit, durationMs: 1200, caption: 'Breathe steadily' },
        { pose: stand, durationMs: 800, caption: 'Slide up to finish' },
      ],
    },
    createTracker: () => new WallSitTracker(),
  },
  {
    id: 'torso-twist',
    name: 'Standing Torso Twists',
    difficulty: 'beginner',
    focus: ['mobility', 'core'],
    metric: 'reps',
    targetReps: 16,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 3.5,
    cameraView: 'front',
    cameraHint: 'Face the camera directly so shoulder rotation is measurable.',
    summary: 'A gentle rotational mobility drill for the spine, hips and shoulders.',
    instructions: [
      'Stand with feet hip-width apart, knees soft and arms bent at your sides.',
      'Keep your hips facing forward and rotate your ribcage to one side.',
      'Move smoothly to the other side, leading with the shoulders.',
      'Keep the range comfortable and breathe throughout.',
    ],
    posture: [
      'Hips remain square to the camera.',
      'Head follows the chest with a long neck.',
      'Torso stays upright through the rotation.',
    ],
    mistakes: [
      'Spinning the hips instead of the ribcage.',
      'Leaning the torso to one side while twisting.',
      'Forcing the rotation with momentum.',
    ],
    safety: [...baseSafety, 'Reduce range if you have a history of low-back pain.'],
    requiredLandmarks: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    trackingNotes:
      'Rotation is measured from the projected shoulder width. Twists reduce shoulder width by at least 15% and must return to facing the camera before the next rep. Hip rotation is detected separately to keep the twist in the ribcage.',
    demo: {
      view: 'front',
      loop: true,
      keyframes: [
        { pose: twistFigure(0), durationMs: 800, caption: 'Hips square' },
        { pose: twistFigure(1), durationMs: 900, caption: 'Rotate through the ribcage' },
        { pose: twistFigure(0), durationMs: 600 },
        { pose: twistFigure(1), durationMs: 900, caption: 'Sweep to the other side' },
        { pose: twistFigure(0), durationMs: 600 },
      ],
    },
    createTracker: () => new TorsoTwistTracker(),
  },
  {
    id: 'lunge',
    name: 'Forward Lunges',
    difficulty: 'intermediate',
    focus: ['lower-body', 'full-body'],
    metric: 'reps',
    targetReps: 12,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 5.5,
    cameraView: 'angled',
    cameraHint: 'Stand side-on or at 45° to the camera with both legs visible. Angle the laptop so your whole body fits.',
    summary: 'A single-leg strength move that builds quads, glutes and balance.',
    instructions: [
      'Start tall with feet hip-width apart and hands on your hips.',
      'Take a comfortable step forward and lower until both knees are near 90°.',
      'Keep the front knee over your ankle and the back knee pointing down.',
      'Push through the front foot to return to standing, then alternate.',
    ],
    posture: [
      'Torso upright with a braced core.',
      'Front knee tracks over the middle of the front foot.',
      'Back knee lowers toward the floor without slamming.',
    ],
    mistakes: [
      'Front knee snapping inward.',
      'Torso collapsing forward.',
      'A step so short the front knee travels far past the toes.',
    ],
    safety: [...baseSafety, 'Hold a chair for balance if needed; work one side at a time.'],
    requiredLandmarks: SQ,
    trackingNotes:
      'Tracks the more-bent knee through a hysteresis cycle (deep at ≤112°, standing at ≥155°) and counts once both knees return to standing — one rep per lunge, not one per leg. Depth, torso lean, knee-over-toe travel and stance length are scored.',
    demo: {
      view: 'side',
      loop: true,
      keyframes: [
        { pose: stand, durationMs: 700, caption: 'Stand tall' },
        { pose: lungeFigure(1), durationMs: 1200, caption: 'Both knees toward 90°' },
        { pose: stand, durationMs: 700, caption: 'Switch legs each rep' },
      ],
    },
    createTracker: () => new LungeTracker(),
  },
  {
    id: 'push-up',
    name: 'Push-Ups',
    difficulty: 'intermediate',
    focus: ['upper-body', 'full-body'],
    metric: 'reps',
    targetReps: 10,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 6,
    cameraView: 'side',
    cameraHint: 'Place the laptop low and to your side so the camera sees your whole plank. Hands and shoulders must be visible.',
    summary: 'The essential upper-body pressing movement, also training core and glute strength.',
    instructions: [
      'Set your hands under your shoulders and extend your legs into a plank.',
      'Brace your core and glutes so your body forms one straight line.',
      'Lower your chest toward the floor with elbows at about 45°.',
      'Press the floor away to return to the top without sagging.',
    ],
    posture: [
      'Shoulders, hips and heels form a straight line.',
      'Hands stay under the shoulders.',
      'Elbows track back at roughly 45°, not flared wide.',
    ],
    mistakes: [
      'Hips sagging or piking upward.',
      'Only lowering halfway.',
      'Hands creeping forward of the shoulders.',
    ],
    safety: [...baseSafety, 'Do the movement on your knees if a full plank is too much.'],
    requiredLandmarks: [...SQ, ...ARMS, LM.nose],
    trackingNotes:
      'Only counts while your body is horizontal with hands below the shoulders. Elbow angle must pass below 105° and return above 150°; body-line angle, hip sag/pike, hand stacking and hand spacing adjust the score. Presses from standing are ignored.',
    demo: pushUpDemo,
    createTracker: () => new PushUpTracker('standard'),
  },
  {
    id: 'wide-push-up',
    name: 'Wide Push-Ups',
    difficulty: 'advanced',
    focus: ['upper-body'],
    metric: 'reps',
    targetReps: 10,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 6,
    cameraView: 'side',
    cameraHint: 'Same side-on plank setup as a push-up; the game checks hand width in 3D.',
    summary: 'A wider hand placement that shifts emphasis to the chest.',
    instructions: [
      'Set your hands wider than shoulder-width with fingers pointing forward.',
      'Brace your core and form a straight plank line.',
      'Lower your chest between your hands, elbows out around 60°.',
      'Press back up without letting your hips sag.',
    ],
    posture: [
      'Hands roughly 1.3–1.6× shoulder-width apart.',
      'Body stays in one line.',
      'Shoulders stay stacked over the hands.',
    ],
    mistakes: ['Hands so wide the shoulders complain.', 'Hips sagging.', 'Half-range pressing.'],
    safety: [...baseSafety, 'Use a narrower stance if your shoulders feel pinched.'],
    requiredLandmarks: [...SQ, ...ARMS, LM.nose],
    trackingNotes:
      'Shares the push-up state machine with the wide hand-width target. Deviation from the wide target, body line, hip position and depth affect the technique score.',
    demo: {
      ...pushUpDemo,
      keyframes: pushUpDemo.keyframes.map((frame) => ({ ...frame, caption: frame.caption ? `${frame.caption} · hands wide` : undefined })),
    },
    createTracker: () => new PushUpTracker('wide'),
  },
  {
    id: 'diamond-push-up',
    name: 'Diamond Push-Ups',
    difficulty: 'advanced',
    focus: ['upper-body'],
    metric: 'reps',
    targetReps: 8,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 6.5,
    cameraView: 'side',
    cameraHint: 'Side-on plank setup with hands close together under your chest.',
    summary: 'A close-grip push-up variation with extra triceps demand.',
    instructions: [
      'Place your hands close together under your chest, index fingers and thumbs forming a diamond.',
      'Hold a strong plank with your core and glutes braced.',
      'Lower your chest toward your hands, keeping elbows close to your ribs.',
      'Press up powerfully without locking your elbows harshly.',
    ],
    posture: ['Hands within about half a shoulder-width.', 'Elbows close to the body.', 'Body in one straight line.'],
    mistakes: ['Elbows flaring wide.', 'Hips rising to make the press easier.', 'Wrists collapsing inward.'],
    safety: [...baseSafety, 'Skip this variation if your wrists are sensitive.'],
    requiredLandmarks: [...SQ, ...ARMS, LM.nose],
    trackingNotes:
      'Push-up state machine with a narrow hand-width target. Hand width, depth, body line and hip position contribute to the score.',
    demo: {
      ...pushUpDemo,
      keyframes: pushUpDemo.keyframes.map((frame) => ({ ...frame, caption: frame.caption ? `${frame.caption} · hands close` : undefined })),
    },
    createTracker: () => new PushUpTracker('diamond'),
  },
  {
    id: 'plank',
    name: 'Plank',
    difficulty: 'intermediate',
    focus: ['core', 'full-body'],
    metric: 'time',
    targetReps: 0,
    targetSeconds: 30,
    lowImpact: true,
    caloriesPerMinute: 4,
    cameraView: 'side',
    cameraHint: 'Place the laptop low and to your side so your shoulders, hips and feet are all visible.',
    summary: 'A full-body isometric hold that teaches core bracing and shoulder stability.',
    instructions: [
      'Set your forearms or hands under your shoulders.',
      'Extend your legs and squeeze your glutes so your body is one long line.',
      'Brace your core, tuck your ribs down and keep your neck long.',
      'Breathe steadily and hold until the timer ends.',
    ],
    posture: ['Shoulders, hips and heels in one line.', 'Hips neither sagging nor piking.', 'Shoulders stacked over the hands.'],
    mistakes: ['Hips dropping toward the floor.', 'Hips piking up.', 'Shoulders drifting behind the hands.'],
    safety: [...baseSafety, 'Drop to your knees as soon as the lower back starts to arch.'],
    requiredLandmarks: [...SQ, ...ARMS],
    trackingNotes:
      'Hold time accumulates only while the body is horizontal, the shoulder–hip–ankle line stays above 160°, the hip offset from that line is under 0.1 body units, and shoulders stack over the hands. Sagging or piking pauses the timer.',
    demo: {
      view: 'side',
      loop: true,
      keyframes: [
        { pose: plankTop, durationMs: 1400, caption: 'One long line' },
        { pose: plankFigure({ elbowBend: 0, lift: 0.004 }), durationMs: 1200, caption: 'Breathe, don’t sag' },
        { pose: plankTop, durationMs: 1000 },
      ],
    },
    createTracker: () => new PlankTracker(),
  },
  {
    id: 'high-knees',
    name: 'High Knees',
    difficulty: 'intermediate',
    focus: ['full-body'],
    metric: 'reps',
    targetReps: 30,
    targetSeconds: 0,
    lowImpact: false,
    caloriesPerMinute: 8,
    cameraView: 'front',
    cameraHint: 'Face the camera with enough room to run in place. Keep both legs visible.',
    summary: 'A fast, low-space cardio burst that lifts the heart rate quickly.',
    instructions: [
      'Run in place with quick, light feet.',
      'Drive each knee up toward hip height.',
      'Pump your arms naturally and stay tall.',
      'Land softly through the middle of each foot.',
    ],
    posture: ['Torso upright.', 'Knees reach roughly hip height.', 'Quick, light ground contacts.'],
    mistakes: ['Leaning back.', 'Knees barely lifting.', 'Heavy, loud landings.'],
    safety: [...baseSafety, 'March in place instead if the impact bothers your joints.'],
    requiredLandmarks: SQ,
    trackingNotes:
      'Two independent side counters with a fast 250 ms minimum cycle. Each knee must reach 56% lift and return below 22% before the next rep. Torso lean and lift height set the technique score; cadence is reported separately.',
    demo: {
      view: 'front',
      loop: true,
      keyframes: [
        { pose: frontStand, durationMs: 500, caption: 'Light feet' },
        { pose: kneeRaiseFigure('left', { armAbductL: 35, elbowL: 80, armAbductR: 12, elbowR: 75 }), durationMs: 500, caption: 'Knee to hip height' },
        { pose: frontStand, durationMs: 350 },
        { pose: kneeRaiseFigure('right', { armAbductL: 12, elbowL: 75, armAbductR: 35, elbowR: 80 }), durationMs: 500, caption: 'Quick rhythm' },
        { pose: frontStand, durationMs: 350 },
      ],
    },
    createTracker: () => new HighKneesTracker(),
  },
  {
    id: 'mountain-climbers',
    name: 'Mountain Climbers',
    difficulty: 'intermediate',
    focus: ['full-body', 'core'],
    metric: 'reps',
    targetReps: 24,
    targetSeconds: 0,
    lowImpact: false,
    caloriesPerMinute: 8,
    cameraView: 'angled',
    cameraHint: 'Place the laptop low, side-on or at 45°, so your plank and knees are visible.',
    summary: 'A dynamic plank variation that combines core stability with a cardio burst.',
    instructions: [
      'Start in a high plank with shoulders over hands.',
      'Drive one knee toward your chest without lifting your hips.',
      'Return the foot and switch immediately to the other side.',
      'Keep your torso level and your hips quiet.',
    ],
    posture: ['Shoulders stacked over hands.', 'Hips low and steady.', 'Knee drives toward the chest.'],
    mistakes: ['Hips bouncing up and down.', 'Feet not returning fully.', 'Shoulders drifting behind the hands.'],
    safety: [...baseSafety, 'Slow the pace before your lower back starts to round.'],
    requiredLandmarks: [...SQ, ...ARMS],
    trackingNotes:
      'Counts each knee drive while you hold a plank: the knee must move ahead of the hip toward the chest, then retreat. Hips stability, torso level and plank line reduce the score when they drift. Requires a horizontal plank, so standing movements are ignored.',
    demo: {
      view: 'side',
      loop: true,
      keyframes: [
        { pose: plankTop, durationMs: 700, caption: 'Strong plank' },
        { pose: plankFigure({ drive: 'left' }), durationMs: 550, caption: 'Knee to chest' },
        { pose: plankTop, durationMs: 450 },
        { pose: plankFigure({ drive: 'right' }), durationMs: 550, caption: 'Switch fast' },
        { pose: plankTop, durationMs: 450 },
      ],
    },
    createTracker: () => new MountainClimbersTracker(),
  },
  {
    id: 'burpee',
    name: 'Burpees',
    difficulty: 'intermediate',
    focus: ['full-body'],
    metric: 'reps',
    targetReps: 8,
    targetSeconds: 0,
    lowImpact: false,
    caloriesPerMinute: 10,
    cameraView: 'side',
    cameraHint: 'Give yourself space and place the laptop low and side-on so standing and plank positions are both visible.',
    summary: 'A full-body sequence that builds conditioning and power.',
    instructions: [
      'Squat down and place your hands on the floor in front of your feet.',
      'Kick your feet back into a strong plank.',
      'Jump or step your feet back under you.',
      'Explode upward into a jump, then land softly and stand tall.',
    ],
    posture: ['Hips follow the shoulders in the squat.', 'Plank stays straight.', 'Land with soft knees.'],
    mistakes: ['Sagging hips in the plank.', 'Skipping the jump.', 'Rounding the back in the crouch.'],
    safety: [
      ...baseSafety,
      'Use the step-back version or do the push-up on your knees if needed.',
    ],
    requiredLandmarks: [...SQ, ...ARMS],
    trackingNotes:
      'A five-stage machine (stand → crouch → plank → return → jump) with stage timeouts. A rep only counts after the full sequence and a genuine airborne jump, detected from the calibrated floor line. Plank alignment, crouch depth and jump height are scored.',
    demo: burpeeDemo,
    createTracker: () => new BurpeeTracker(),
  },
  {
    id: 'jump-squat',
    name: 'Jump Squats',
    difficulty: 'advanced',
    focus: ['lower-body', 'full-body'],
    metric: 'reps',
    targetReps: 12,
    targetSeconds: 0,
    lowImpact: false,
    caloriesPerMinute: 8.5,
    cameraView: 'side',
    cameraHint: 'Stand side-on with head and feet in frame so jumps are measurable.',
    summary: 'A power-focused squat variation that trains explosiveness.',
    instructions: [
      'Lower into a comfortable squat with your chest up.',
      'Explode upward, extending your hips and swinging your arms.',
      'Leave the floor and land softly on the middle of your feet.',
      'Absorb the landing with bent knees, then repeat.',
    ],
    posture: ['Chest up in the squat.', 'Knees track over toes.', 'Soft, quiet landings.'],
    mistakes: ['Squatting shallow and just hopping.', 'Landing stiff-legged.', 'Knees collapsing inward on take-off or landing.'],
    safety: [...baseSafety, 'Skip this exercise if you have knee or ankle pain; plain squats are a good swap.'],
    requiredLandmarks: SQ,
    trackingNotes:
      'Uses the squat depth cycle plus the calibrated floor line. A rep counts only when the squat reaches depth and the feet actually leave the ground. Depth, jump height, knee tracking and torso lean set the score.',
    demo: {
      view: 'side',
      loop: true,
      keyframes: [
        { pose: stand, durationMs: 700, caption: 'Stand tall' },
        { pose: deepSquat, durationMs: 900, caption: 'Load the squat' },
        { pose: jump, durationMs: 600, caption: 'Explode upward' },
        { pose: groundedSideFigure({ hipFlex: 55, kneeBend: 65, lean: 12, armFlexL: 40, armFlexR: 40 }), durationMs: 500, caption: 'Land softly' },
        { pose: stand, durationMs: 600 },
      ],
    },
    createTracker: () => new JumpSquatTracker(),
  },
  {
    id: 'side-lunge',
    name: 'Lateral Lunges',
    difficulty: 'advanced',
    focus: ['lower-body'],
    metric: 'reps',
    targetReps: 12,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 5.5,
    cameraView: 'front',
    cameraHint: 'Face the camera with a wide area so your lateral step fits in frame.',
    summary: 'A side-to-side lunge that trains the inner thighs, glutes and hip stability.',
    instructions: [
      'Stand tall with feet together.',
      'Take a wide step to one side and shift your hips back into that leg.',
      'Keep the other leg straight and your chest lifted.',
      'Push through the working foot to return to centre and switch sides.',
    ],
    posture: ['Knee stays over the working foot.', 'Chest lifted, hips back.', 'Trailing leg stays long.'],
    mistakes: ['Knee collapsing inward.', 'Bending the trailing leg.', 'Shallow step with no hip shift.'],
    safety: [...baseSafety, 'Keep the step within a range your hips can control.'],
    requiredLandmarks: SQ,
    trackingNotes:
      'Detects a wide lateral stance plus a hip drop. The cycle counts after you return to standing, so each side counts once. Step width, depth, knee tracking, other-leg straightness and torso position are scored.',
    demo: {
      view: 'front',
      loop: true,
      keyframes: [
        { pose: frontStand, durationMs: 700, caption: 'Feet under hips' },
        { pose: sideLungeFigure(1), durationMs: 1100, caption: 'Step wide, sit into the leg' },
        { pose: frontStand, durationMs: 500 },
        { pose: mirrorPose(sideLungeFigure(1)), durationMs: 1100, caption: 'Switch sides' },
        { pose: frontStand, durationMs: 500 },
      ],
    },
    createTracker: () => new SideLungeTracker(),
  },
  {
    id: 'single-leg-balance',
    name: 'Single-Leg Balance',
    difficulty: 'advanced',
    focus: ['lower-body', 'mobility'],
    metric: 'time',
    targetReps: 0,
    targetSeconds: 30,
    lowImpact: true,
    caloriesPerMinute: 3,
    cameraView: 'front',
    cameraHint: 'Face the camera with your feet visible. Step back so a lifted foot stays in frame.',
    summary: 'Builds ankle, knee and hip stability with a controlled single-leg hold.',
    instructions: [
      'Stand tall with feet hip-width apart.',
      'Shift your weight onto one leg and lift the other foot off the floor.',
      'Keep your hips level and find a fixed point for your gaze.',
      'Hold, then switch sides and match the time.',
    ],
    posture: ['Hips level.', 'Torso tall and quiet.', 'Support knee softly bent, not locked.'],
    mistakes: ['Hip hiking or dropping.', 'Holding your breath.', 'Leaning the torso to balance.'],
    safety: [...baseSafety, 'Stand near a wall or chair in case you lose balance.'],
    requiredLandmarks: SQ,
    trackingNotes:
      'Hold time accumulates only when exactly one foot is lifted off the calibrated floor line, the support foot is down, hips are level within 0.08 body units, the torso is upright and hip sway stays under 0.12. Per-side time is tracked.',
    demo: {
      view: 'front',
      loop: true,
      keyframes: [
        { pose: frontStand, durationMs: 700, caption: 'Find a focal point' },
        { pose: kneeRaiseFigure('left', { armAbductL: 65, armAbductR: 65 }), durationMs: 1600, caption: 'Lift one foot, hips level' },
        { pose: frontStand, durationMs: 600 },
        { pose: kneeRaiseFigure('right', { armAbductL: 65, armAbductR: 65 }), durationMs: 1600, caption: 'Swap sides' },
        { pose: frontStand, durationMs: 600 },
      ],
    },
    createTracker: () => new SingleLegBalanceTracker(),
  },
  {
    id: 'plank-shoulder-tap',
    name: 'Plank Shoulder Taps',
    difficulty: 'advanced',
    focus: ['core', 'upper-body'],
    metric: 'reps',
    targetReps: 16,
    targetSeconds: 0,
    lowImpact: true,
    caloriesPerMinute: 5,
    cameraView: 'angled',
    cameraHint: 'Place the laptop low and slightly in front so your hands and shoulders are visible in the plank.',
    summary: 'An anti-rotation core challenge layered on a plank.',
    instructions: [
      'Start in a strong high plank with feet slightly wider than hip-width.',
      'Shift weight into one hand and tap the opposite shoulder.',
      'Return the hand and repeat on the other side.',
      'Keep your hips as still as if a glass of water were on your back.',
    ],
    posture: ['Hips stay square and level.', 'Shoulders stay stacked over the hands.', 'Core and glutes braced.'],
    mistakes: ['Hips rocking side to side.', 'Sagging lower back.', 'Rushing the taps.'],
    safety: [...baseSafety, 'Widen your feet for more stability, or do the taps on your knees.'],
    requiredLandmarks: [...SQ, ...ARMS],
    trackingNotes:
      'Counts a tap when a wrist comes within 0.5 body units of the opposite shoulder while in a horizontal plank, then must retreat before the next tap. Hip rocking, shoulder tilt and plank line are scored.',
    demo: {
      view: 'side',
      loop: true,
      keyframes: [
        { pose: plankTop, durationMs: 800, caption: 'Strong plank' },
        { pose: plankFigure({ tap: 'left' }), durationMs: 700, caption: 'Tap opposite shoulder' },
        { pose: plankTop, durationMs: 500 },
        { pose: plankFigure({ tap: 'right' }), durationMs: 700, caption: 'Keep hips square' },
        { pose: plankTop, durationMs: 500 },
      ],
    },
    createTracker: () => new PlankShoulderTapTracker(),
  },
];

export const EXERCISES_BY_ID: Record<ExerciseId, ExerciseDefinition> = Object.fromEntries(
  EXERCISE_DEFINITIONS.map((exercise) => [exercise.id, exercise]),
) as Record<ExerciseId, ExerciseDefinition>;

export function getExercise(id: ExerciseId): ExerciseDefinition {
  const exercise = EXERCISES_BY_ID[id];
  if (!exercise) throw new Error(`Unknown exercise: ${id}`);
  return exercise;
}

export const EXERCISE_IDS = EXERCISE_DEFINITIONS.map((exercise) => exercise.id);
