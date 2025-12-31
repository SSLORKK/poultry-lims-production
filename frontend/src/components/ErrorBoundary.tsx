import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child
 * component tree and displays a fallback UI instead of crashing the whole app.
 * 
 * Usage:
 * <ErrorBoundary componentName="SamplesList">
 *   <SamplesList />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-lg w-full">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800">
                  {this.props.componentName 
                    ? `Error in ${this.props.componentName}` 
                    : 'Something went wrong'}
                </h3>
                <p className="mt-1 text-sm text-red-600">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                {this.state.error?.name && (
                  <p className="mt-1 text-xs text-red-500 font-mono">
                    Type: {this.state.error.name}
                  </p>
                )}
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={this.handleRetry}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Reload Page
                  </button>
                </div>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <details className="mt-4">
                    <summary className="text-xs text-red-500 cursor-pointer hover:text-red-700">
                      Show technical details
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
