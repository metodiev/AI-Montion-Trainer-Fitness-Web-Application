import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionStage } from '@/components/workout/SessionStage';
import type { PoseCameraApi } from '@/hooks/usePoseCamera';
import type { PoseFrame } from '@/core/types';
import type { WorkoutSessionConfig } from '@/services/sessionTypes';
import { AppDataProvider } from '@/store/AppDataProvider';
import { baselineFrom, frameOf, sideStanding, squatPose } from './helpers/pose';

afterEach(cleanup);

const camera: PoseCameraApi = {
  videoRef: { current: null },
  canvasRef: { current: null },
  status: 'running',
  error: null,
  poseStatus: 'ready',
  fps: 30,
  detected: true,
  start: async () => {},
  stop: () => {},
  retry: async () => {},
};

const config: WorkoutSessionConfig = {
  mode: 'free',
  title: 'Squat test',
  difficulty: 'beginner',
  estimatedMinutes: 1,
  blocks: [
    {
      id: 'squat-set',
      kind: 'exercise',
      exerciseId: 'squat',
      targetReps: 1,
      durationSec: 30,
      label: 'Squat',
    },
  ],
};

describe('SessionStage integration', () => {
  it('counts a real rep from pose frames and finishes the set', async () => {
    const baseline = baselineFrom(sideStanding());
    const standing = frameOf(sideStanding());
    const deep = frameOf(squatPose({ hipFlex: 95, kneeBend: 100, lean: 12 }));
    const onComplete = vi.fn();
    const frameSink: { current: ((frame: PoseFrame | null, now: number) => void) | null } = {
      current: null,
    };

    render(
      <AppDataProvider storageOverride={null}>
        <MemoryRouter>
          <SessionStage
            config={config}
            baseline={baseline}
            camera={camera}
            frameSink={frameSink}
            mirror={false}
            showMetrics={false}
            onComplete={onComplete}
          />
        </MemoryRouter>
      </AppDataProvider>,
    );

    await waitFor(() => expect(frameSink.current).toBeTruthy());

    let now = 1000;
    const feed = (frame: PoseFrame, ms: number) => {
      const end = now + ms;
      while (now < end) {
        const at = now;
        act(() => frameSink.current?.(frame, at));
        now += 33;
      }
    };

    feed(standing, 800);
    feed(deep, 1000);
    feed(standing, 900);

    await waitFor(() => expect(screen.getByTestId('rep-count').textContent).toBe('1'));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 2500 });
    const [performances, , completed] = onComplete.mock.calls[0];
    expect(completed).toBe(true);
    expect(performances[0].result.reps).toBe(1);
    expect(performances[0].result.averageScore).toBeGreaterThan(60);
  });

  it('never counts reps when frames are missing', async () => {
    const baseline = baselineFrom(sideStanding());
    const onComplete = vi.fn();
    const frameSink: { current: ((frame: PoseFrame | null, now: number) => void) | null } = {
      current: null,
    };

    render(
      <AppDataProvider storageOverride={null}>
        <MemoryRouter>
          <SessionStage
            config={config}
            baseline={baseline}
            camera={camera}
            frameSink={frameSink}
            mirror={false}
            showMetrics={false}
            onComplete={onComplete}
          />
        </MemoryRouter>
      </AppDataProvider>,
    );

    await waitFor(() => expect(frameSink.current).toBeTruthy());
    let now = 1000;
    for (let index = 0; index < 60; index += 1) {
      const at = now;
      act(() => frameSink.current?.(null, at));
      now += 33;
    }
    expect(screen.getByTestId('rep-count').textContent).toBe('0');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
