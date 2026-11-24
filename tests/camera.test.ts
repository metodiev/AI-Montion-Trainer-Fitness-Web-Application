import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CameraError,
  CameraManager,
  cameraErrorMessage,
  describeCameraError,
} from '@/services/CameraManager';

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).mediaDevices;
  }
});

const namedError = (name: string) => Object.assign(new Error(name), { name });

describe('camera error mapping', () => {
  it('maps browser permission errors to actionable messages', () => {
    const denied = describeCameraError(namedError('NotAllowedError'));
    expect(denied).toBeInstanceOf(CameraError);
    expect(denied.code).toBe('permission-denied');
    expect(denied.hint).toMatch(/address bar/i);
    expect(describeCameraError(namedError('NotFoundError')).code).toBe('not-found');
    expect(describeCameraError(namedError('NotReadableError')).code).toBe('not-readable');
    expect(describeCameraError(namedError('OverconstrainedError')).code).toBe('overconstrained');
    expect(describeCameraError(namedError('AbortError')).code).toBe('aborted');
    expect(describeCameraError(namedError('TypeError')).code).toBe('unsupported');
    expect(describeCameraError('weird').code).toBe('unknown');
  });

  it('passes through an existing CameraError unchanged', () => {
    const error = new CameraError('not-found', 'No camera', 'Connect one');
    expect(describeCameraError(error)).toBe(error);
    const message = cameraErrorMessage(error);
    expect(message).toEqual({ message: 'No camera', hint: 'Connect one', code: 'not-found' });
  });

  it('reports the unsupported state when mediaDevices is missing', async () => {
    setMediaDevices(undefined);
    expect(CameraManager.supported()).toBe(false);
    const manager = new CameraManager();
    const video = document.createElement('video');
    await expect(manager.start(video)).rejects.toMatchObject({ code: 'unsupported' });
    expect(await manager.listDevices()).toEqual([]);
  });

  it('surfaces a denied permission from getUserMedia', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(namedError('NotAllowedError'));
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });
    expect(CameraManager.supported()).toBe(true);
    const manager = new CameraManager();
    const video = document.createElement('video');
    await expect(manager.start(video)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(manager.active).toBe(false);
  });

  it('retries with a bare video constraint when the device is overconstrained', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(namedError('OverconstrainedError'))
      .mockRejectedValueOnce(namedError('NotReadableError'));
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });
    const manager = new CameraManager();
    await expect(manager.start(document.createElement('video'))).rejects.toMatchObject({
      code: 'not-readable',
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('stops cleanly when never started', () => {
    const manager = new CameraManager();
    expect(() => manager.stop()).not.toThrow();
    expect(manager.active).toBe(false);
    expect(manager.deviceId).toBeNull();
  });

  it('lists only video input devices', async () => {
    setMediaDevices({
      getUserMedia: vi.fn(),
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam-1', label: 'FaceTime HD' },
        { kind: 'audioinput', deviceId: 'mic-1', label: 'Microphone' },
      ]),
    });
    const devices = await new CameraManager().listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].deviceId).toBe('cam-1');
  });
});

describe('camera concurrency', () => {
  const fakeVideo = () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { configurable: true, value: 1 });
    Object.defineProperty(video, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    return video;
  };

  const fakeStream = (label: string) => {
    const track = { label, readyState: 'live', stop: vi.fn() };
    return {
      label,
      track,
      stream: {
        getTracks: () => [track],
        getVideoTracks: () => [track],
      } as unknown as MediaStream,
    };
  };

  it('stops a stale stream when two starts race', async () => {
    let resolveFirst: ((stream: MediaStream) => void) | null = null;
    const first = fakeStream('first');
    const second = fakeStream('second');
    const getUserMedia = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<MediaStream>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce(second.stream);
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const manager = new CameraManager();
    const video = fakeVideo();
    const firstStart = manager.start(video);
    const secondStart = manager.start(video);

    await secondStart;
    expect(manager.mediaStream).toBe(second.stream);
    expect(video.srcObject).toBe(second.stream);

    resolveFirst!(first.stream);
    await expect(firstStart).rejects.toMatchObject({ code: 'aborted' });
    expect(first.track.stop).toHaveBeenCalled();
    expect(second.track.stop).not.toHaveBeenCalled();
    expect(manager.mediaStream).toBe(second.stream);
  });

  it('stops a stream that resolves after the camera was switched off', async () => {
    let resolveStream: ((stream: MediaStream) => void) | null = null;
    const pending = fakeStream('pending');
    const getUserMedia = vi.fn().mockImplementation(
      () => new Promise<MediaStream>((resolve) => {
        resolveStream = resolve;
      }),
    );
    setMediaDevices({ getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) });

    const manager = new CameraManager();
    const video = fakeVideo();
    const starting = manager.start(video);
    manager.stop();
    resolveStream!(pending.stream);

    await expect(starting).rejects.toMatchObject({ code: 'aborted' });
    expect(pending.track.stop).toHaveBeenCalled();
    expect(manager.mediaStream).toBeNull();
    expect(manager.active).toBe(false);
    expect(video.srcObject === pending.stream).toBe(false);
  });
});
