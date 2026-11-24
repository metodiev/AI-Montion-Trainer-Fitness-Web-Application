import { createPoseFrame } from '@/core/pose';
import type { PoseFrame } from '@/core/types';

export const WASM_PATH = '/wasm';
export const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
export const MODEL_PATH = '/models/pose_landmarker_lite.task';
export const MODEL_CDN =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export type PoseServiceStatus = 'idle' | 'loading' | 'ready' | 'error';

type Landmarker = import('@mediapipe/tasks-vision').PoseLandmarker;

/**
 * Local-only pose estimation. The model and WASM runtime are served from
 * `public/` (or a CDN fallback) and every frame is processed on this device.
 * No image data is ever uploaded.
 */
export class PoseDetectionService {
  private landmarker: Landmarker | null = null;
  private status: PoseServiceStatus = 'idle';
  private error: string | null = null;
  private loading: Promise<void> | null = null;
  private lastTimestamp = 0;
  private frameCount = 0;
  private fpsWindowStart = 0;
  private fps = 0;
  private delegate: 'GPU' | 'CPU' | null = null;

  getStatus(): { status: PoseServiceStatus; error: string | null; delegate: string | null; fps: number } {
    return { status: this.status, error: this.error, delegate: this.delegate, fps: Math.round(this.fps) };
  }

  isReady(): boolean {
    return this.status === 'ready' && !!this.landmarker;
  }

  async init(): Promise<void> {
    if (this.status === 'ready' && this.landmarker) return;
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.error = null;
    this.loading = this.load()
      .then(() => {
        this.status = 'ready';
      })
      .catch((error: unknown) => {
        this.status = 'error';
        this.landmarker = null;
        this.error = error instanceof Error ? error.message : String(error);
        throw error;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  private async load(): Promise<void> {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');

    let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null = null;
    for (const wasmPath of [WASM_PATH, WASM_CDN]) {
      try {
        vision = await FilesetResolver.forVisionTasks(wasmPath);
        break;
      } catch {
        vision = null;
      }
    }
    if (!vision) {
      throw new Error('Could not load the pose runtime. Check your connection or reinstall dependencies.');
    }

    const options = {
      runningMode: 'VIDEO' as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    };

    for (const modelAssetPath of [MODEL_PATH, MODEL_CDN]) {
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          this.landmarker = await PoseLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: { modelAssetPath, delegate },
          });
          this.delegate = delegate;
          return;
        } catch {
          this.landmarker = null;
        }
      }
    }
    throw new Error('Could not load the pose model. Run `npm run prepare:assets` and reload.');
  }

  /**
   * Runs inference on the current video frame. Returns null when the model is
   * not ready, the video has no frame, or no person is detected.
   */
  detect(video: HTMLVideoElement, timestampMs: number): PoseFrame | null {
    if (!this.landmarker || this.status !== 'ready') return null;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    const timestamp = Math.max(timestampMs, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;
    try {
      const result = this.landmarker.detectForVideo(video, timestamp);
      const landmarks = result.landmarks?.[0];
      if (!landmarks || landmarks.length < 33) return null;
      const aspect = video.videoWidth / Math.max(1, video.videoHeight);
      const frame = createPoseFrame(landmarks, aspect, timestamp);
      this.countFrame();
      return frame;
    } catch {
      return null;
    }
  }

  private countFrame(): void {
    this.frameCount += 1;
    const now = performance.now();
    if (this.fpsWindowStart === 0) this.fpsWindowStart = now;
    const elapsed = now - this.fpsWindowStart;
    if (elapsed >= 1000) {
      this.fps = (this.frameCount * 1000) / elapsed;
      this.frameCount = 0;
      this.fpsWindowStart = now;
    }
  }

  dispose(): void {
    try {
      this.landmarker?.close();
    } catch {
      // ignore
    }
    this.landmarker = null;
    this.status = 'idle';
    this.error = null;
    this.delegate = null;
    this.lastTimestamp = 0;
    this.fps = 0;
  }
}

let singleton: PoseDetectionService | null = null;

export function getPoseDetectionService(): PoseDetectionService {
  if (!singleton) singleton = new PoseDetectionService();
  return singleton;
}
