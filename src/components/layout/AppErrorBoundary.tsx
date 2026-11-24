import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Keeps a rendering failure from blanking the whole app mid-session. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AI Motion Trainer crashed while rendering', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-4">
        <div className="app-panel w-full max-w-lg p-8 text-center">
          <p className="app-label">Something went wrong</p>
          <h1 className="app-title mt-2">The trainer hit a snag</h1>
          <p className="app-muted mt-2 text-sm">
            Your saved progress is safe in this browser. Reload the page to get back to training.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="app-button-primary flex-1"
              onClick={() => window.location.reload()}
            >
              Reload app
            </button>
            <a className="app-button-secondary flex-1" href="/">
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
