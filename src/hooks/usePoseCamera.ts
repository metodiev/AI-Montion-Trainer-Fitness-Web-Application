import { useCallback, useEffect, useRef, useState } from 'react';
import { PoseSmoother } from '@/core/smoothing';
import type { PoseFrame } from '@/core/types';
import { CameraManager, cameraErrorMessage, type CameraErrorCode } from '@/services/CameraManager';
import { getPoseDetectionService } from '@/services/PoseDetectionService';

export type CameraStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopped';

export interface PoseCameraError {
  code: CameraErrorCode;
  message: string;
  hint: string;
}

export interface UsePoseCameraOptions {
  enabled?: boolean;
  deviceId?: string | null;
  mirror?: boolean;
  showSkeleton?: boolean;
  onFrame?: (frame: PoseFrame | null, now: number) => void;
  targetFps?: number;
}

export interface PoseCameraApi {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  error: PoseCameraError | null;
  poseStatus: string;
  fps: number;
  detected: boolean;
  start: () => Promise<void>;
  stop: () => void;
  retry: () => Promise<void>;
}

const CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
  [0, 11],
  [0, 12],
];

const LEFT_LANDMARKS = new Set([11, 13, 15, 23, 25, 27, 29, 31]);
const RIGHT_LANDMARKS = new Set([12, 14, 16, 24, 26, 28, 30, 32]);
const DRAWN_JOINTS = new Set([0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]);

const COLORS = {
  left: '#38bdf8',
  right: '#a78bfa',
  center: '#e2e8f0',
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
};

/**
 * Owns the camera lifecycle plus the render/inference loop and draws the
 * skeleton overlay. Inference is capped so the browser stays responsive, and
 * drawing accounts for letterboxing so bones stay glued to the body whether the
 * video is `object-cover` or `object-contain`.
 */
export function usePoseCamera(options: UsePoseCameraOptions = {}): PoseCameraApi {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef(new CameraManager());
  const smootherRef = useRef(new PoseSmoother(65));
  const poseServiceRef = useRef(getPoseDetectionService());
  const rafRef = useRef<number | null>(null);
  const lastInferenceRef = useRef(0);
  const lastFrameRef = useRef<PoseFrame | null>(null);
  const severityRef = useRef<'good' | 'warn' | 'bad'>('good');
  const runningRef = useRef(false);
  const generationRef = useRef(0);

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<PoseCameraError | null>(null);
  const [poseStatus, setPoseStatus] = useState<string>('idle');
  const [fps, setFps] = useState(0);
  const [detected, setDetected] = useState(false);

  const drawSkeleton = useCallback((frame: PoseFrame | null) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const current = optionsRef.current;
    if (!current.showSkeleton || !frame) return;

    // The <video> is centred inside its box. Mirror the same letterbox maths
    // used by CSS object-fit so landmarks land on the right body parts.
    const boxAspect = width / height;
    const videoAspect =
      video && video.videoWidth > 0 && video.videoHeight > 0
        ? video.videoWidth / video.videoHeight
        : frame.aspect;
    let drawW: number;
    let drawH: number;
    if (videoAspect >= boxAspect) {
      drawW = width;
      drawH = width / videoAspect;
    } else {
      drawH = height;
      drawW = height * videoAspect;
    }
    const offsetX = (width - drawW) / 2;
    const offsetY = (height - drawH) / 2;
    const mirror = current.mirror !== false;
    const toCanvas = (index: number) => {
      const landmark = frame.imageLandmarks[index];
      const x = offsetX + (mirror ? 1 - landmark.x : landmark.x) * drawW;
      const y = offsetY + landmark.y * drawH;
      return { x, y };
    };
    const confidence = (index: number) => frame.visibility[index] ?? 0;
    const baseColor =
      severityRef.current === 'bad'
        ? COLORS.bad
        : severityRef.current === 'warn'
          ? COLORS.warn
          : COLORS.good;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 12;
    ctx.shadowColor = baseColor;
    for (const [a, b] of CONNECTIONS) {
      const visibility = Math.min(confidence(a), confidence(b));
      if (visibility < 0.25) continue;
      const from = toCanvas(a);
      const to = toCanvas(b);
      const isLeft = LEFT_LANDMARKS.has(a) || LEFT_LANDMARKS.has(b);
      const isRight = RIGHT_LANDMARKS.has(a) || RIGHT_LANDMARKS.has(b);
      ctx.strokeStyle = isLeft ? COLORS.left : isRight ? COLORS.right : COLORS.center;
      ctx.globalAlpha = Math.min(1, visibility + 0.15);
      ctx.lineWidth = Math.max(2, width * 0.004);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    for (const index of DRAWN_JOINTS) {
      if (confidence(index) < 0.35) continue;
      const point = toCanvas(index);
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(3, width * 0.006), 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const service = poseServiceRef.current;
    const now = performance.now();
    const current = optionsRef.current;
    const targetFps = current.targetFps ?? 30;

    if (video && service.isReady()) {
      const minInterval = 1000 / Math.max(5, targetFps);
      if (now - lastInferenceRef.current >= minInterval) {
        lastInferenceRef.current = now;
        const raw = service.detect(video, now);
        const frame = raw
          ? { ...raw, imageLandmarks: smootherRef.current.smooth(raw.imageLandmarks, now) }
          : null;
        lastFrameRef.current = frame;
        setDetected((previous) => (previous === !!frame ? previous : !!frame));
        const stats = service.getStatus();
        setFps((previous) => (previous === Math.round(stats.fps) ? previous : Math.round(stats.fps)));
        if (frame) {
          severityRef.current =
            frame.quality > 0.72 ? 'good' : frame.quality > 0.5 ? 'warn' : 'bad';
        }
        current.onFrame?.(frame, now);
      }
    }

    drawSkeleton(lastFrameRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, [drawSkeleton]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setStatus('starting');
    setError(null);
    try {
      await cameraRef.current.start(video, optionsRef.current.deviceId ?? null);
      if (generationRef.current !== generation) return;
      setStatus('running');
      runningRef.current = true;
      setPoseStatus('loading');
      try {
        await poseServiceRef.current.init();
        if (generationRef.current !== generation) return;
        setPoseStatus('ready');
      } catch (poseError) {
        if (generationRef.current !== generation) return;
        setPoseStatus('error');
        setError({
          code: 'unknown',
          message: 'Pose tracking could not start.',
          hint:
            poseError instanceof Error
              ? poseError.message
              : 'Check your connection or run `npm run prepare:assets` and reload.',
        });
        setStatus('error');
        runningRef.current = false;
        cameraRef.current.stop();
        return;
      }
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } catch (cameraError) {
      if (generationRef.current !== generation) return;
      const info = cameraErrorMessage(cameraError);
      setError({ code: info.code, message: info.message, hint: info.hint });
      setStatus('error');
      runningRef.current = false;
    }
  }, [loop]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    cameraRef.current.stop();
    lastFrameRef.current = null;
    smootherRef.current.reset();
    setDetected(false);
    setFps(0);
    setStatus('stopped');
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    optionsRef.current.onFrame?.(null, performance.now());
  }, []);

  const retry = useCallback(async () => {
    stop();
    await start();
  }, [start, stop]);

  useEffect(() => {
    if (options.enabled) {
      void start();
    }
    return () => {
      generationRef.current += 1;
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      cameraRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    poseStatus,
    fps,
    detected,
    start,
    stop,
    retry,
  };
}
