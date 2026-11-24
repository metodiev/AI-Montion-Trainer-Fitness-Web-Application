import clsx from 'clsx';
import type { DemoPose, DemoSpec } from '@/core/skeleton';

const LINES: [keyof DemoPose['joints'], keyof DemoPose['joints']][] = [
  ['head', 'neck'],
  ['neck', 'shoulderL'],
  ['neck', 'shoulderR'],
  ['shoulderL', 'shoulderR'],
  ['shoulderL', 'elbowL'],
  ['elbowL', 'wristL'],
  ['shoulderR', 'elbowR'],
  ['elbowR', 'wristR'],
  ['shoulderL', 'hipL'],
  ['shoulderR', 'hipR'],
  ['hipL', 'hipR'],
  ['hipL', 'kneeL'],
  ['kneeL', 'ankleL'],
  ['ankleL', 'footL'],
  ['hipR', 'kneeR'],
  ['kneeR', 'ankleR'],
  ['ankleR', 'footR'],
];

/** A static, lightweight preview of a demo pose for cards and lists. */
export function DemoThumbnail({
  demo,
  frameIndex = 1,
  className,
}: {
  demo: DemoSpec;
  frameIndex?: number;
  className?: string;
}) {
  const frame = demo.keyframes[Math.min(frameIndex, demo.keyframes.length - 1)] ?? demo.keyframes[0];
  const pose = frame?.pose;
  return (
    <div className={clsx('relative overflow-hidden rounded-2xl border border-white/8 bg-ink-900/60', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(200,255,77,0.14),transparent_65%)]" />
      {pose ? (
        <svg viewBox="0 0 1 1" className="relative h-full w-full" preserveAspectRatio="xMidYMid meet">
          {LINES.map(([from, to]) => {
            const a = pose.joints[from];
            const b = pose.joints[to];
            if (!a || !b) return null;
            return (
              <line
                key={`${from}-${to}`}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="rgba(226,232,240,0.55)"
                strokeWidth={2.4}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {Object.entries(pose.joints).map(([joint, point]) => {
            if (!point || joint === 'neck') return null;
            if (joint === 'head') {
              return (
                <circle
                  key={joint}
                  cx={point[0]}
                  cy={point[1]}
                  r={0.03}
                  fill="rgba(11,15,24,0.9)"
                  stroke="rgba(226,232,240,0.7)"
                  strokeWidth={2.2}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            return <circle key={joint} cx={point[0]} cy={point[1]} r={0.011} fill="#c8ff4d" opacity={0.85} />;
          })}
          <line x1="0.1" y1="0.955" x2="0.9" y2="0.955" stroke="rgba(200,255,77,0.2)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
    </div>
  );
}
