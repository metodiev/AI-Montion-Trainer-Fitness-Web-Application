import { LM, type Landmark } from './types';
export type DemoJoint =
  | 'head'
  | 'neck'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR'
  | 'footL'
  | 'footR';

export type DemoPoint = [number, number];

export interface DemoPose {
  joints: Record<DemoJoint, DemoPoint>;
}

export interface DemoKeyframe {
  pose: DemoPose;
  durationMs: number;
  caption?: string;
}

export interface DemoSpec {
  view: 'front' | 'side';
  loop: boolean;
  keyframes: DemoKeyframe[];
  /** Draw a support wall behind the figure (wall sits). */
  wall?: boolean;
}

const RAD = Math.PI / 180;
const polar = (angleDeg: number, length: number): DemoPoint => [
  Math.sin(angleDeg * RAD) * length,
  Math.cos(angleDeg * RAD) * length,
];

const offset = (base: DemoPoint, delta: DemoPoint): DemoPoint => [
  base[0] + delta[0],
  base[1] + delta[1],
];

const mirrorX = (point: DemoPoint): DemoPoint => [-point[0], point[1]];

function finalize(
  root: DemoPoint,
  joints: Record<DemoJoint, DemoPoint>,
  lift = 0,
): DemoPose {
  const shifted = Object.fromEntries(
    Object.entries(joints).map(([key, value]) => [
      key,
      [root[0] + value[0], root[1] + value[1] - lift] as DemoPoint,
    ]),
  ) as Record<DemoJoint, DemoPoint>;
  return { joints: shifted };
}

export interface FrontFigureOptions {
  x?: number;
  rootY?: number;
  lift?: number;
  lean?: number;
  torso?: number;
  armAbductL?: number;
  armAbductR?: number;
  elbowL?: number;
  elbowR?: number;
  legSpreadL?: number;
  legSpreadR?: number;
  kneeBendL?: number;
  kneeBendR?: number;
  footLiftL?: number;
  footLiftR?: number;
  headTilt?: number;
}

/** A front-facing stick figure. Angles are in degrees. */
export function frontFigure(options: FrontFigureOptions = {}): DemoPose {
  const x = options.x ?? 0.5;
  const rootY = options.rootY ?? 0.56;
  const torsoLen = options.torso ?? 0.24;
  const lean = options.lean ?? 0;
  const lift = options.lift ?? 0;

  const shoulders: DemoPoint = [Math.sin(lean * RAD) * torsoLen, -Math.cos(lean * RAD) * torsoLen];
  const headAngle = lean + (options.headTilt ?? 0);
  const head: DemoPoint = offset(shoulders, [Math.sin(headAngle * RAD) * 0.11, -0.115]);
  const neck = offset(shoulders, [0, -0.045]);

  const shoulderHalf = 0.105;
  const hipHalf = 0.075;
  const thighLen = 0.21;
  const shinLen = 0.195;
  const upperArm = 0.155;
  const forearm = 0.145;

  const shoulderL: DemoPoint = [shoulders[0] - shoulderHalf, shoulders[1] + 0.006];
  const shoulderR: DemoPoint = [shoulders[0] + shoulderHalf, shoulders[1] - 0.006];
  const hipL: DemoPoint = [-hipHalf, 0.012];
  const hipR: DemoPoint = [hipHalf, 0.006];

  const armSide = (abduct: number, elbow: number, sign: -1 | 1, shoulder: DemoPoint) => {
    const upper = offset(shoulder, [Math.sin(abduct * RAD) * upperArm * sign, Math.cos(abduct * RAD) * upperArm]);
    const foreAngle = abduct - elbow;
    const wrist = offset(upper, [Math.sin(foreAngle * RAD) * forearm * sign, Math.cos(foreAngle * RAD) * forearm]);
    return { elbow: upper, wrist };
  };

  const armL = armSide(options.armAbductL ?? 8, options.elbowL ?? 0, -1, shoulderL);
  const armR = armSide(options.armAbductR ?? 8, options.elbowR ?? 0, 1, shoulderR);

  const legSide = (
    spread: number,
    kneeBend: number,
    sign: -1 | 1,
    hip: DemoPoint,
    footLift: number,
    side: 'L' | 'R',
  ) => {
    const knee = offset(hip, [Math.sin(spread * RAD) * thighLen * sign, Math.cos(spread * RAD) * thighLen]);
    const shinAngle = spread - kneeBend;
    const ankle = offset(knee, [Math.sin(shinAngle * RAD) * shinLen * sign, Math.cos(shinAngle * RAD) * shinLen]);
    ankle[1] -= footLift;
    const foot: DemoPoint = [ankle[0] + (side === 'L' ? -0.055 : 0.055), ankle[1] + 0.012 - footLift * 0.2];
    return { knee, ankle, foot };
  };

  const legL = legSide(
    options.legSpreadL ?? 7,
    options.kneeBendL ?? 0,
    -1,
    hipL,
    options.footLiftL ?? 0,
    'L',
  );
  const legR = legSide(
    options.legSpreadR ?? 7,
    options.kneeBendR ?? 0,
    1,
    hipR,
    options.footLiftR ?? 0,
    'R',
  );

  return finalize(
    [x, rootY],
    {
      head,
      neck,
      shoulderL,
      shoulderR,
      elbowL: armL.elbow,
      wristL: armL.wrist,
      elbowR: armR.elbow,
      wristR: armR.wrist,
      hipL,
      hipR,
      kneeL: legL.knee,
      ankleL: legL.ankle,
      footL: legL.foot,
      kneeR: legR.knee,
      ankleR: legR.ankle,
      footR: legR.foot,
    },
    lift,
  );
}

export interface SideFigureOptions {
  x?: number;
  rootY?: number;
  lift?: number;
  lean?: number;
  torso?: number;
  armFlexL?: number;
  armFlexR?: number;
  elbowL?: number;
  elbowR?: number;
  hipFlexL?: number;
  hipFlexR?: number;
  kneeBendL?: number;
  kneeBendR?: number;
  footLiftL?: number;
  footLiftR?: number;
  stride?: number;
  headTilt?: number;
}

/**
 * A side-facing figure used for squats, lunges, wall sits and jumps.
 * `x` is forward, `y` is down. Arms: 0 = hanging, 90 = forward, 180 = overhead.
 * Hips: 0 = straight down, 90 = thigh horizontal forward.
 */
export function sideFigure(options: SideFigureOptions = {}): DemoPose {
  const x = options.x ?? 0.5;
  const rootY = options.rootY ?? 0.55;
  const torsoLen = options.torso ?? 0.24;
  const lean = options.lean ?? 0;
  const lift = options.lift ?? 0;

  const torsoDir: DemoPoint = [Math.sin(lean * RAD), -Math.cos(lean * RAD)];
  const shoulderCenter: DemoPoint = [torsoDir[0] * torsoLen, torsoDir[1] * torsoLen];
  const head = offset(shoulderCenter, [
    Math.sin((lean + (options.headTilt ?? 0)) * RAD) * 0.115,
    -Math.cos((lean + (options.headTilt ?? 0)) * RAD) * 0.115,
  ]);
  const neck = offset(shoulderCenter, [0, -0.04]);

  const upperArm = 0.15;
  const forearm = 0.14;
  const thighLen = 0.215;
  const shinLen = 0.2;

  const shoulderL: DemoPoint = [shoulderCenter[0] - 0.012, shoulderCenter[1] + 0.008];
  const shoulderR: DemoPoint = [shoulderCenter[0] + 0.012, shoulderCenter[1] - 0.002];
  const hipL: DemoPoint = [-0.014, 0.012];
  const hipR: DemoPoint = [0.014, 0.004];

  const arm = (flex: number, elbow: number, shoulder: DemoPoint) => {
    const upperDir = polar(flex, upperArm);
    const elbowPoint = offset(shoulder, upperDir);
    const foreDir = polar(flex + elbow, forearm);
    const wrist = offset(elbowPoint, foreDir);
    return { elbow: elbowPoint, wrist, shoulder };
  };

  const armL = arm(options.armFlexL ?? 5, options.elbowL ?? 0, shoulderL);
  const armR = arm(options.armFlexR ?? 5, options.elbowR ?? 0, shoulderR);

  const stride = options.stride ?? 0;
  const leg = (
    hipFlex: number,
    kneeBend: number,
    hip: DemoPoint,
    footLift: number,
    strideOffset: number,
  ) => {
    const thighDir = polar(hipFlex, thighLen);
    const knee = offset(hip, thighDir);
    const shinDir = polar(hipFlex - kneeBend, shinLen);
    const ankle = offset(knee, [shinDir[0] + strideOffset, shinDir[1]]);
    ankle[1] -= footLift;
    const foot: DemoPoint = [ankle[0] + 0.075, ankle[1] + 0.005];
    return { knee, ankle, foot };
  };

  const legL = leg(
    options.hipFlexL ?? 2,
    options.kneeBendL ?? 0,
    hipL,
    options.footLiftL ?? 0,
    -stride,
  );
  const legR = leg(
    options.hipFlexR ?? 2,
    options.kneeBendR ?? 0,
    hipR,
    options.footLiftR ?? 0,
    stride,
  );

  return finalize(
    [x, rootY],
    {
      head,
      neck,
      shoulderL,
      shoulderR,
      elbowL: armL.elbow,
      wristL: armL.wrist,
      elbowR: armR.elbow,
      wristR: armR.wrist,
      hipL,
      hipR,
      kneeL: legL.knee,
      ankleL: legL.ankle,
      footL: legL.foot,
      kneeR: legR.knee,
      ankleR: legR.ankle,
      footR: legR.foot,
    },
    lift,
  );
}

export interface PlankFigureOptions {
  x?: number;
  y?: number;
  hipSag?: number;
  elbowBend?: number;
  drive?: 'left' | 'right' | null;
  tap?: 'left' | 'right' | null;
  lift?: number;
  headDrop?: number;
}

/** A side-on plank / push-up figure with the head facing image-right. */
export function plankFigure(options: PlankFigureOptions = {}): DemoPose {
  const x = options.x ?? 0.5;
  const y = options.y ?? 0.58;
  const lift = options.lift ?? 0;
  const elbowBend = options.elbowBend ?? 0;
  const ground = 0.88;

  const shoulder: DemoPoint = [x + 0.16, y];
  const hip: DemoPoint = [x - 0.08, y + 0.015 + (options.hipSag ?? 0)];
  const head: DemoPoint = [shoulder[0] + 0.115, shoulder[1] - 0.005 + (options.headDrop ?? 0)];
  const neck: DemoPoint = [shoulder[0] + 0.045, shoulder[1]];

  const shoulderL: DemoPoint = [shoulder[0], shoulder[1] - 0.018];
  const shoulderR: DemoPoint = [shoulder[0], shoulder[1] + 0.018];
  const hipL: DemoPoint = [hip[0], hip[1] - 0.02];
  const hipR: DemoPoint = [hip[0], hip[1] + 0.02];

  const armDown = (sign: -1 | 1, tap: boolean, otherShoulder?: DemoPoint) => {
    const shoulderPoint = sign === -1 ? shoulderL : shoulderR;
    const elbowPoint: DemoPoint = [
      shoulderPoint[0] - 0.09 * (0.4 + elbowBend * 0.6),
      shoulderPoint[1] + 0.11,
    ];
    let wrist: DemoPoint = [shoulderPoint[0] + 0.02, ground - 0.015];
    if (tap && otherShoulder) {
      wrist = [otherShoulder[0] - 0.025, otherShoulder[1] - 0.02];
    }
    return { elbow: elbowPoint, wrist };
  };

  const leftTaps = options.tap === 'left';
  const rightTaps = options.tap === 'right';
  const armL = armDown(-1, leftTaps, shoulderR);
  const armR = armDown(1, rightTaps, shoulderL);

  const leg = (sign: -1 | 1, footLift: number, drive: boolean) => {
    const hipPoint = sign === -1 ? hipL : hipR;
    const baseKnee: DemoPoint = [hipPoint[0] - 0.2, hipPoint[1] + 0.02];
    const baseAnkle: DemoPoint = [hipPoint[0] - 0.4, hipPoint[1] + 0.06];
    const knee: DemoPoint = drive ? [hipPoint[0] + 0.13, hipPoint[1] - 0.06] : baseKnee;
    const ankle: DemoPoint = drive ? [hipPoint[0] + 0.02, hipPoint[1] + 0.12] : baseAnkle;
    ankle[1] -= footLift;
    const foot: DemoPoint = [ankle[0] - 0.06, ankle[1] + 0.005];
    return { knee, ankle, foot };
  };

  const legL = leg(-1, 0, options.drive === 'left');
  const legR = leg(1, 0, options.drive === 'right');

  return finalize(
    [0, 0],
    {
      head: [head[0] - x, head[1]],
      neck: [neck[0] - x, neck[1]],
      shoulderL: [shoulderL[0] - x, shoulderL[1]],
      shoulderR: [shoulderR[0] - x, shoulderR[1]],
      elbowL: [armL.elbow[0] - x, armL.elbow[1]],
      wristL: [armL.wrist[0] - x, armL.wrist[1]],
      elbowR: [armR.elbow[0] - x, armR.elbow[1]],
      wristR: [armR.wrist[0] - x, armR.wrist[1]],
      hipL: [hipL[0] - x, hipL[1]],
      hipR: [hipR[0] - x, hipR[1]],
      kneeL: [legL.knee[0] - x, legL.knee[1]],
      ankleL: [legL.ankle[0] - x, legL.ankle[1]],
      footL: [legL.foot[0] - x, legL.foot[1]],
      kneeR: [legR.knee[0] - x, legR.knee[1]],
      ankleR: [legR.ankle[0] - x, legR.ankle[1]],
      footR: [legR.foot[0] - x, legR.foot[1]],
    },
    lift,
  );
}

export const DEMO_JOINT_TO_LANDMARK: Record<DemoJoint, number> = {
  head: LM.nose,
  neck: LM.nose,
  shoulderL: LM.leftShoulder,
  shoulderR: LM.rightShoulder,
  elbowL: LM.leftElbow,
  elbowR: LM.rightElbow,
  wristL: LM.leftWrist,
  wristR: LM.rightWrist,
  hipL: LM.leftHip,
  hipR: LM.rightHip,
  kneeL: LM.leftKnee,
  kneeR: LM.rightKnee,
  ankleL: LM.leftAnkle,
  ankleR: LM.rightAnkle,
  footL: LM.leftFootIndex,
  footR: LM.rightFootIndex,
};

/**
 * Converts a demo pose into a synthetic landmark array. Used by tests to feed
 * deterministic body positions through the real tracking pipeline.
 */
export function demoPoseToLandmarks(pose: DemoPose, visibility = 1): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0,
  }));
  for (const [joint, index] of Object.entries(DEMO_JOINT_TO_LANDMARK)) {
    const [x, y] = pose.joints[joint as DemoJoint];
    landmarks[index] = { x, y, z: 0, visibility };
  }
  // MediaPipe face landmarks are not needed for any tracker; keep them near the head.
  const head = pose.joints.head;
  landmarks[LM.leftEye] = { x: head[0] - 0.01, y: head[1] - 0.01, z: 0, visibility };
  landmarks[LM.rightEye] = { x: head[0] + 0.01, y: head[1] - 0.01, z: 0, visibility };
  landmarks[LM.leftEar] = { x: head[0] - 0.03, y: head[1], z: 0, visibility };
  landmarks[LM.rightEar] = { x: head[0] + 0.03, y: head[1], z: 0, visibility };
  landmarks[LM.leftHeel] = { ...landmarks[LM.leftAnkle] };
  landmarks[LM.rightHeel] = { ...landmarks[LM.rightAnkle] };
  return landmarks;
}

/** Linear interpolation between two demo poses, used by the animated demo. */
export function interpolatePose(from: DemoPose, to: DemoPose, t: number): DemoPose {
  const joints = {} as Record<DemoJoint, DemoPoint>;
  for (const key of Object.keys(from.joints) as DemoJoint[]) {
    const a = from.joints[key];
    const b = to.joints[key];
    joints[key] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  return { joints };
}

export { mirrorX };

export const STANDING_ANKLE_Y = 0.973;
const SIDE_THIGH = 0.215;
const SIDE_SHIN = 0.2;

/** Side figure whose feet stay pinned to the ground at a given squat angle. */
export function groundedSideFigure(
  options: SideFigureOptions & { hipFlex: number; kneeBend: number },
): DemoPose {
  const ankleOffset =
    Math.cos((options.hipFlex * Math.PI) / 180) * SIDE_THIGH +
    Math.cos(((options.hipFlex - options.kneeBend) * Math.PI) / 180) * SIDE_SHIN;
  return sideFigure({
    ...options,
    hipFlexL: options.hipFlex,
    hipFlexR: options.hipFlex,
    kneeBendL: options.kneeBend,
    kneeBendR: options.kneeBend,
    rootY: STANDING_ANKLE_Y - ankleOffset,
  });
}

/** Front-facing figure with one knee raised for knee-raise/high-knee demos. */
export function kneeRaiseFigure(
  side: 'left' | 'right',
  options: FrontFigureOptions = {},
): DemoPose {
  const pose = frontFigure(options);
  const direction = side === 'left' ? -1 : 1;
  const hip = pose.joints[side === 'left' ? 'hipL' : 'hipR'];
  pose.joints[side === 'left' ? 'kneeL' : 'kneeR'] = [hip[0] + direction * 0.07, hip[1] - 0.02];
  pose.joints[side === 'left' ? 'ankleL' : 'ankleR'] = [hip[0] + direction * 0.05, hip[1] + 0.17];
  pose.joints[side === 'left' ? 'footL' : 'footR'] = [hip[0] + direction * 0.11, hip[1] + 0.18];
  return pose;
}

/** Deep forward lunge, front foot on image-right. */
export function lungeFigure(depth = 1): DemoPose {
  const t = Math.max(0, Math.min(1, depth));
  const standing = sideFigure({ rootY: 0.55 });
  const deep: DemoPose = {
    joints: {
      head: [0.52, 0.3],
      neck: [0.51, 0.37],
      shoulderL: [0.49, 0.42],
      shoulderR: [0.52, 0.42],
      elbowL: [0.49, 0.515],
      wristL: [0.49, 0.61],
      elbowR: [0.52, 0.515],
      wristR: [0.52, 0.61],
      hipL: [0.49, 0.66],
      hipR: [0.47, 0.66],
      kneeL: [0.63, 0.72],
      ankleL: [0.64, 0.945],
      footL: [0.71, 0.95],
      kneeR: [0.35, 0.76],
      ankleR: [0.27, 0.945],
      footR: [0.21, 0.95],
    },
  };
  return interpolatePose(standing, deep, t);
}

/** Front view wide side lunge, working leg toward image-left. */
export function sideLungeFigure(depth = 1): DemoPose {
  const t = Math.max(0, Math.min(1, depth));
  const standing = frontFigure({ rootY: 0.56 });
  const deep: DemoPose = {
    joints: {
      head: [0.44, 0.24],
      neck: [0.45, 0.3],
      shoulderL: [0.37, 0.38],
      shoulderR: [0.51, 0.38],
      elbowL: [0.35, 0.48],
      wristL: [0.37, 0.58],
      elbowR: [0.53, 0.48],
      wristR: [0.55, 0.58],
      hipL: [0.4, 0.62],
      hipR: [0.52, 0.62],
      kneeL: [0.28, 0.72],
      ankleL: [0.25, 0.94],
      footL: [0.18, 0.95],
      kneeR: [0.58, 0.74],
      ankleR: [0.64, 0.94],
      footR: [0.7, 0.95],
    },
  };
  return interpolatePose(standing, deep, t);
}

/** A shoulder-width torso twist for demos. */
export function twistFigure(amount = 0): DemoPose {
  const pose = frontFigure({
    rootY: 0.56,
    armAbductL: 25,
    armAbductR: 25,
    elbowL: 75,
    elbowR: 75,
  });
  const clamped = Math.max(0, Math.min(1, amount));
  const squash = 1 - 0.45 * clamped;
  const upper: DemoJoint[] = [
    'head',
    'neck',
    'shoulderL',
    'shoulderR',
    'elbowL',
    'wristL',
    'elbowR',
    'wristR',
  ];
  for (const joint of upper) {
    const point = pose.joints[joint];
    pose.joints[joint] = [0.5 + (point[0] - 0.5) * squash, point[1]];
  }
  return pose;
}

/** Mirror a pose across the vertical centre line. */
export function mirrorPose(pose: DemoPose): DemoPose {
  const joints = {} as Record<DemoJoint, DemoPoint>;
  for (const key of Object.keys(pose.joints) as DemoJoint[]) {
    const point = pose.joints[key];
    joints[key] = [1 - point[0], point[1]];
  }
  return { joints };
}

/** Simple standing stretch poses used for warm-ups and cool-downs. */
export function stretchFigure(kind: 'hamstring' | 'chest' | 'breath'): DemoPose {
  if (kind === 'hamstring') {
    return sideFigure({
      rootY: 0.56,
      lean: 48,
      hipFlexL: 35,
      hipFlexR: -8,
      kneeBendL: 25,
      kneeBendR: 8,
      armFlexL: 65,
      armFlexR: 65,
      elbowL: 15,
      elbowR: 15,
    });
  }
  if (kind === 'chest') {
    return frontFigure({
      rootY: 0.56,
      armAbductL: 118,
      armAbductR: 118,
      elbowL: 18,
      elbowR: 18,
      legSpreadL: 10,
      legSpreadR: 10,
    });
  }
  return frontFigure({
    rootY: 0.56,
    armAbductL: 78,
    armAbductR: 78,
    legSpreadL: 9,
    legSpreadR: 9,
  });
}
