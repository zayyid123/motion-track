'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Keeps a rendering failure in one editor panel from blanking the whole app.
 * The project draft is already in localStorage, so recovering is safe.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[motion-track] render error:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 p-6 font-mono">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
          <div className="mb-3 flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-sm font-bold">The studio hit an unexpected error</h1>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-600">
            Your autosaved draft is still on this device. Reload to reopen the last stable project.
          </p>
          <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Reload studio
          </button>
        </div>
      </div>
    );
  }
}
