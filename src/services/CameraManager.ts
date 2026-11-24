export type CameraErrorCode =
  | 'unsupported'
  | 'insecure-context'
  | 'permission-denied'
  | 'not-found'
  | 'not-readable'
  | 'overconstrained'
  | 'aborted'
  | 'unknown';

export class CameraError extends Error {
  readonly code: CameraErrorCode;
  readonly hint: string;

  constructor(code: CameraErrorCode, message: string, hint: string) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
    this.hint = hint;
  }
}

const MESSAGES: Record<CameraErrorCode, { message: string; hint: string }> = {
  unsupported: {
    message: 'This browser cannot access a camera.',
    hint: 'Use a recent version of Chrome, Edge, Safari or Firefox on desktop.',
  },
  'insecure-context': {
    message: 'Camera access needs a secure page.',
    hint: 'Open the app on localhost or over HTTPS, then try again.',
  },
  'permission-denied': {
    message: 'Camera permission was denied.',
    hint: 'Click the camera icon in your browser address bar, allow access, then retry.',
  },
  'not-found': {
    message: 'No camera was found.',
    hint: 'Connect a camera or check that it is not disabled, then retry.',
  },
  'not-readable': {
    message: 'The camera is busy or unreadable.',
    hint: 'Close other apps using the camera (Zoom, Meet, Photo Booth) and retry.',
  },
  overconstrained: {
    message: 'The camera could not provide the requested video format.',
    hint: 'Try a different camera or reload the page.',
  },
  aborted: {
    message: 'Camera start was interrupted.',
    hint: 'Try starting the camera again.',
  },
  unknown: {
    message: 'The camera could not be started.',
    hint: 'Reload the page and allow camera access when prompted.',
  },
};

export function describeCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) return error;
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
  const detail =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  let code: CameraErrorCode = 'unknown';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      code = 'permission-denied';
      break;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      code = 'not-found';
      break;
    case 'NotReadableError':
    case 'TrackStartError':
      code = 'not-readable';
      break;
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      code = 'overconstrained';
      break;
    case 'AbortError':
      code = 'aborted';
      break;
    case 'TypeError':
      code = 'unsupported';
      break;
    default:
      code = 'unknown';
  }
  const info = MESSAGES[code];
  return new CameraError(code, detail ? `${info.message} (${detail})` : info.message, info.hint);
}

export function cameraErrorMessage(error: unknown): { message: string; hint: string; code: CameraErrorCode } {
  const cameraError = describeCameraError(error);
  return { message: cameraError.message, hint: cameraError.hint, code: cameraError.code };
}

const waitForMetadata = (video: HTMLVideoElement, timeoutMs = 4000): Promise<void> =>
  new Promise((resolve) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('loadedmetadata', finish);
      video.removeEventListener('loadeddata', finish);
      resolve();
    };
    video.addEventListener('loadedmetadata', finish, { once: true });
    video.addEventListener('loadeddata', finish, { once: true });
    window.setTimeout(finish, timeoutMs);
  });

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // A track may already be ended; stopping is best-effort.
    }
  }
}

/**
 * Owns the webcam stream. Frames never leave the browser; the stream is only
 * attached to the local <video> element and read by local pose inference.
 */
export class CameraManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private currentDeviceId: string | null = null;
  private epoch = 0;

  get active(): boolean {
    return !!this.stream && this.stream.getVideoTracks().some((track) => track.readyState === 'live');
  }

  get deviceId(): string | null {
    return this.currentDeviceId;
  }

  get mediaStream(): MediaStream | null {
    return this.stream;
  }

  static supported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  async start(video: HTMLVideoElement, deviceId?: string | null): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !CameraManager.supported()) {
      throw new CameraError('unsupported', MESSAGES.unsupported.message, MESSAGES.unsupported.hint);
    }
    if (
      typeof window !== 'undefined' &&
      'isSecureContext' in window &&
      !window.isSecureContext &&
      !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    ) {
      throw new CameraError(
        'insecure-context',
        MESSAGES['insecure-context'].message,
        MESSAGES['insecure-context'].hint,
      );
    }

    this.stop();
    const token = this.epoch;
    this.video = video;

    const baseVideoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: baseVideoConstraints,
      });
    } catch (error) {
      const name =
        typeof error === 'object' && error !== null && 'name' in error
          ? String((error as { name?: unknown }).name)
          : '';
      if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        } catch (retryError) {
          throw describeCameraError(retryError);
        }
      } else {
        throw describeCameraError(error);
      }
    }

    if (token !== this.epoch) {
      stopStream(stream);
      throw new CameraError('aborted', MESSAGES.aborted.message, MESSAGES.aborted.hint);
    }
    this.stream = stream;
    this.currentDeviceId = deviceId ?? null;

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await waitForMetadata(video);
    if (token !== this.epoch) {
      stopStream(stream);
      if (video.srcObject === stream) video.srcObject = null;
      throw new CameraError('aborted', MESSAGES.aborted.message, MESSAGES.aborted.hint);
    }
    try {
      await video.play();
    } catch {
      // Autoplay may be blocked until the user interacts. The UI exposes a
      // retry button; the stream is still attached.
    }
    return stream;
  }

  stop(): void {
    this.epoch += 1;
    if (this.stream) stopStream(this.stream);
    this.stream = null;
    if (this.video) {
      try {
        this.video.srcObject = null;
      } catch {
        // ignore
      }
    }
    this.video = null;
    this.currentDeviceId = null;
  }

  async listDevices(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'videoinput');
    } catch {
      return [];
    }
  }
}
