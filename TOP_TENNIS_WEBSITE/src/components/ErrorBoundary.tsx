import React from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/utils/logger";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    // Enhanced error logging with full context
    logger.error("Unhandled UI error caught by ErrorBoundary", {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : null,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // Update state with error details
    this.setState({
      error: error instanceof Error ? error : new Error(String(error)),
      errorInfo,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    logger.info('User attempting to reset error boundary');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `Error: ${error?.message}\n\nComponent Stack:\n${errorInfo?.componentStack}\n\nError Stack:\n${error?.stack}\n\nTimestamp: ${new Date().toISOString()}\n\nURL: ${window.location.href}`;
    
    navigator.clipboard.writeText(errorText).then(() => {
      logger.info('Error details copied to clipboard');
    }).catch(() => {
      logger.error('Failed to copy error details to clipboard');
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-lg w-full text-center space-y-6">
            <div className="space-y-2">
              <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
              <p className="text-muted-foreground">
                The app hit an unexpected error. The error has been logged and our team will investigate.
              </p>
            </div>
            
            {/* Error details in development */}
            {isDevelopment && error && (
              <div className="text-left bg-muted/50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm">Error Details (Development Only)</h3>
                <div className="text-xs font-mono bg-background p-2 rounded border">
                  <div className="text-red-600 font-semibold">{error.message}</div>
                  {error.stack && (
                    <div className="mt-2 text-gray-600 whitespace-pre-wrap">
                      {error.stack.substring(0, 500)}...
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Recovery options */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={this.handleReset} variant="outline">
                Try Again
              </Button>
              <Button onClick={this.handleReload}>
                Reload Page
              </Button>
              {isDevelopment && (
                <Button onClick={this.handleCopyError} variant="secondary" size="sm">
                  Copy Error
                </Button>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              If this problem persists, please contact support.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
