import React from 'react';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleCopy = () => {
    if (!this.state.error) return;
    const text = `${this.state.error.name}: ${this.state.error.message}\n\n${this.state.error.stack}`;
    navigator.clipboard?.writeText(text);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-[#8b1a1a] rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-extrabold text-white">Something went wrong</h2>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              An unexpected error occurred. Please reload the page to continue.
            </p>
            {this.state.error && (
              <details className="text-left">
                <summary className="text-[10px] text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-muted)]">
                  Error details
                </summary>
                <pre className="mt-2 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface)] p-3 rounded-lg max-h-[200px] overflow-auto whitespace-pre-wrap">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
                <button
                  onClick={this.handleCopy}
                  className="mt-2 text-[10px] text-[var(--color-primary)] flex items-center gap-1 hover:text-white transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Copy error details
                </button>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 mx-auto hover:bg-[var(--color-primary)] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
