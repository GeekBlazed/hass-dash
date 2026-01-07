import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });
  }

  private handleRetry = (): void => {
    this.props.onRetry?.();
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-4 px-6 py-10">
        <div className="border-panel-border bg-panel-card text-text-primary w-full rounded-xl border p-6">
          <h1 className="text-lg font-semibold">Something went wrong.</h1>
          <p className="text-text-secondary mt-1 text-sm">
            An unexpected error occurred. You can try again.
          </p>

          {import.meta.env.DEV && this.state.error && (
            <pre
              className="border-panel-border bg-panel-surface text-text-muted mt-4 max-h-40 overflow-auto rounded-md border p-3 text-xs"
              role="alert"
            >
              {this.state.error.message}
            </pre>
          )}

          <div className="mt-6 flex">
            <button
              type="button"
              className="bg-primary hover:bg-primary-dark focus:ring-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-black transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
              onClick={this.handleRetry}
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }
}
