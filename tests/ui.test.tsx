import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { AppErrorBoundary } from '@/components/layout/AppErrorBoundary';
import { AppDataProvider } from '@/store/AppDataProvider';
import type { StorageLike } from '@/services/storage';
import { EXERCISE_DEFINITIONS } from '@/exercises/definitions';

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function renderRoute(route: string) {
  return render(
    <AppDataProvider storageOverride={memoryStorage()}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </AppDataProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('app shell routes', () => {
  it('renders the dashboard with the primary call to action', () => {
    renderRoute('/');
    expect(screen.getByText(/your body is the/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /choose your run/i })).toBeTruthy();
    expect(screen.getAllByText(/daily challenge/i).length).toBeGreaterThan(0);
  });

  it('lists every exercise in the library', () => {
    renderRoute('/exercises');
    expect(EXERCISE_DEFINITIONS.length).toBe(18);
    expect(screen.getByLabelText(/search exercises/i)).toBeTruthy();
    for (const exercise of EXERCISE_DEFINITIONS) {
      expect(screen.getAllByText(exercise.name).length).toBeGreaterThan(0);
    }
  });

  it('shows coaching details on an exercise page', () => {
    renderRoute('/exercises/squat');
    const squat = EXERCISE_DEFINITIONS.find((entry) => entry.id === 'squat');
    expect(squat).toBeDefined();
    expect(screen.getByRole('heading', { name: squat!.name })).toBeTruthy();
    expect(screen.getByText(/how to perform it/i)).toBeTruthy();
    expect(screen.getByText(/common mistakes/i)).toBeTruthy();
    expect(screen.getByText(/safety/i)).toBeTruthy();
  });

  it.each([
    ['/adventure', /fitness adventure/i],
    ['/planner', /workout planner/i],
    ['/progress', /your training story/i],
    ['/achievements', /achievements/i],
    ['/settings', /settings|camera/i],
  ])('renders %s without crashing', (route, expected) => {
    renderRoute(route);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });
});

describe('workout player', () => {
  it('starts the camera and surfaces a permission error instead of counting reps', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    renderRoute('/train/free?exercise=squat');
    expect(screen.getByRole('heading', { name: /free training/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /enable camera/i }));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/camera permission was denied/i)).toBeTruthy());
    expect(screen.queryByText(/^0$/)).toBeNull();
  });

  it('deep-links a precision session with its target copy', () => {
    renderRoute('/train/precision?exercise=jumping_jack&reps=12&accuracy=90');
    expect(screen.getByRole('heading', { name: /precision/i })).toBeTruthy();
    expect(screen.getByText(/12 reps/i)).toBeTruthy();
  });
});

describe('error boundary', () => {
  it('shows a recovery screen instead of a blank page', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('boom');
    };
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByText(/the trainer hit a snag/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /reload app/i })).toBeTruthy();
    spy.mockRestore();
  });
});
