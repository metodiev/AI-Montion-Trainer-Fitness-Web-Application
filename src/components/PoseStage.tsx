import clsx from 'clsx';
import { Camera, CameraOff, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import type { CameraStatus, PoseCameraError } from '@/hooks/usePoseCamera';

export function PoseStage({
  videoRef,
  canvasRef,
  status,
  error,
  mirror,
  detected,
  fps,
  onRetry,
  onStart,
  children,
  className,
  overlayClassName,
  hidePlaceholder = false,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  error: PoseCameraError | null;
  mirror: boolean;
  detected: boolean;
  fps: number;
  onRetry?: () => void;
  onStart?: () => void;
  children?: ReactNode;
  className?: string;
  overlayClassName?: string;
  hidePlaceholder?: boolean;
}) {
  const showVideo = status === 'running' || status === 'starting';
  return (
    <div
      className={clsx(
        'relative isolate overflow-hidden rounded-3xl border border-white/10 bg-ink-950',
        className,
      )}
    >
      <video
        ref={videoRef}
        className={clsx(
          'absolute inset-0 h-full w-full object-cover transition-opacity duration-500',
          mirror && '-scale-x-100',
          showVideo ? 'opacity-100' : 'opacity-0',
        )}
        playsInline
        muted
        autoPlay
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-ink-950/25" />

      {status !== 'running' && !hidePlaceholder ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse-ring rounded-full bg-lime-400/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lime-300">
              {error ? <CameraOff size={26} /> : <Camera size={26} />}
            </div>
          </div>
          {error ? (
            <>
              <div className="max-w-sm">
                <p className="font-display text-lg font-semibold text-white">{error.message}</p>
                <p className="mt-1 text-sm text-slate-400">{error.hint}</p>
              </div>
              <button type="button" onClick={onRetry} className="app-button-secondary text-xs" disabled={!onRetry}>
                <RefreshCw size={14} /> Try again
              </button>
            </>
          ) : status === 'starting' ? (
            <p className="text-sm text-slate-400">Starting camera and loading pose tracking…</p>
          ) : (
            <>
              <div className="max-w-sm">
                <p className="font-display text-lg font-semibold text-white">Camera is off</p>
                <p className="mt-1 text-sm text-slate-400">
                  Enable your camera to start tracking. Frames stay on this device.
                </p>
              </div>
              {onStart ? (
                <button type="button" onClick={onStart} className="app-button-primary text-xs">
                  <Camera size={14} /> Enable camera
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {status === 'running' && !detected ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <span className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-amber-200 uppercase">
            <TriangleAlert size={12} /> Searching for your body
          </span>
        </div>
      ) : null}

      {status === 'running' ? (
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-950/70 px-2.5 py-1 text-[10px] font-semibold text-slate-300 backdrop-blur">
            <span className={clsx('h-1.5 w-1.5 rounded-full', detected ? 'bg-lime-400' : 'bg-amber-400')} />
            {detected ? 'Tracking' : 'No body'}
          </span>
          {fps > 0 ? (
            <span className="rounded-full border border-white/10 bg-ink-950/70 px-2 py-1 font-mono text-[10px] text-slate-400 backdrop-blur">
              {fps} fps
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={clsx('pointer-events-none absolute inset-0', overlayClassName)}>{children}</div>
    </div>
  );
}
