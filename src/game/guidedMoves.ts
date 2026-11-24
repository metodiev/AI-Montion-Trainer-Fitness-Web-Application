import {
  frontFigure,
  groundedSideFigure,
  kneeRaiseFigure,
  lungeFigure,
  stretchFigure,
  type DemoSpec,
} from '@/core/skeleton';

export interface GuidedMove {
  id: string;
  name: string;
  cue: string;
  demo: DemoSpec;
}

const marchDemo: DemoSpec = {
  view: 'front',
  loop: true,
  keyframes: [
    { pose: frontFigure({ rootY: 0.56 }), durationMs: 600, caption: 'March in place' },
    { pose: kneeRaiseFigure('left', { armAbductL: 25, elbowL: 75, armAbductR: 12, elbowR: 75 }), durationMs: 550 },
    { pose: frontFigure({ rootY: 0.56 }), durationMs: 400 },
    { pose: kneeRaiseFigure('right', { armAbductL: 12, elbowL: 75, armAbductR: 25, elbowR: 75 }), durationMs: 550 },
    { pose: frontFigure({ rootY: 0.56 }), durationMs: 400 },
  ],
};

const armCircleDemo: DemoSpec = {
  view: 'front',
  loop: true,
  keyframes: [
    { pose: frontFigure({ rootY: 0.56, armAbductL: 88, armAbductR: 88 }), durationMs: 900, caption: 'Small arm circles' },
    { pose: frontFigure({ rootY: 0.56, armAbductL: 128, armAbductR: 128 }), durationMs: 900 },
    { pose: frontFigure({ rootY: 0.56, armAbductL: 88, armAbductR: 88 }), durationMs: 900 },
  ],
};

const squatWarmupDemo: DemoSpec = {
  view: 'side',
  loop: true,
  keyframes: [
    { pose: frontFigure({ rootY: 0.56 }), durationMs: 700, caption: 'Easy bodyweight squats' },
    { pose: groundedSideFigure({ hipFlex: 60, kneeBend: 70, lean: 8, armFlexL: 70, armFlexR: 70 }), durationMs: 1000 },
    { pose: frontFigure({ rootY: 0.56 }), durationMs: 700 },
  ],
};

const shoulderRollDemo: DemoSpec = {
  view: 'front',
  loop: true,
  keyframes: [
    { pose: frontFigure({ rootY: 0.56, armAbductL: 18, armAbductR: 18 }), durationMs: 1000, caption: 'Shoulder rolls' },
    { pose: frontFigure({ rootY: 0.56, armAbductL: 30, elbowL: 20, armAbductR: 30, elbowR: 20 }), durationMs: 1000 },
    { pose: frontFigure({ rootY: 0.56, armAbductL: 18, armAbductR: 18 }), durationMs: 1000 },
  ],
};

const hamstringDemo: DemoSpec = {
  view: 'side',
  loop: false,
  keyframes: [
    { pose: stretchFigure('hamstring'), durationMs: 2200, caption: 'Hinge forward, keep your back long' },
    { pose: groundedSideFigure({ hipFlex: 10, kneeBend: 10, lean: 55, armFlexL: 45, armFlexR: 45 }), durationMs: 2200 },
  ],
};

const chestDemo: DemoSpec = {
  view: 'front',
  loop: false,
  keyframes: [
    { pose: stretchFigure('chest'), durationMs: 2200, caption: 'Open your chest, breathe in' },
    { pose: frontFigure({ rootY: 0.56, armAbductL: 70, armAbductR: 70 }), durationMs: 2200 },
  ],
};

const breathDemo: DemoSpec = {
  view: 'front',
  loop: true,
  keyframes: [
    { pose: stretchFigure('breath'), durationMs: 1800, caption: 'Breathe in through your nose' },
    { pose: frontFigure({ rootY: 0.56, armAbductL: 95, armAbductR: 95 }), durationMs: 1800, caption: 'Breathe out slowly' },
  ],
};

const lungeStretchDemo: DemoSpec = {
  view: 'side',
  loop: false,
  keyframes: [
    { pose: lungeFigure(0.65), durationMs: 2400, caption: 'Low lunge — breathe into the hip' },
    { pose: lungeFigure(0.8), durationMs: 1800 },
  ],
};

export const WARMUP_MOVES: GuidedMove[] = [
  { id: 'march', name: 'March in Place', cue: 'Loosen up your hips and swing your arms.', demo: marchDemo },
  { id: 'arm-circles', name: 'Arm Circles', cue: 'Circle your arms and open your shoulders.', demo: armCircleDemo },
  { id: 'bodyweight-squats', name: 'Easy Squats', cue: 'Warm up your legs with a half-range squat.', demo: squatWarmupDemo },
  { id: 'shoulder-rolls', name: 'Shoulder Rolls', cue: 'Roll your shoulders back and down.', demo: shoulderRollDemo },
];

export const COOLDOWN_MOVES: GuidedMove[] = [
  { id: 'hamstring', name: 'Hamstring Stretch', cue: 'Hinge at the hips and keep your back long.', demo: hamstringDemo },
  { id: 'chest', name: 'Chest Opener', cue: 'Open your arms wide and take a slow breath.', demo: chestDemo },
  { id: 'breathing', name: 'Box Breathing', cue: 'Inhale for four, exhale for four.', demo: breathDemo },
  { id: 'lunge-stretch', name: 'Hip Flexor Stretch', cue: 'Sink gently into a low lunge.', demo: lungeStretchDemo },
];
