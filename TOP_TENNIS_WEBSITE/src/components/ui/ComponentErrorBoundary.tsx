import React from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/utils/logger";

type ComponentErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  componentName?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type ComponentErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export const ComponentErrorBoundary: React.FC<ComponentErrorBoundaryProps> = ({
  children,
  fallback,
  componentName = "Component",
  onError,
}) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    // Create a custom error boundary for this component
    const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
      logger.error(`Component error in ${componentName}`, {
        error,
        errorMessage: error.message,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });

      setError(error);
      setHasError(true);
      
      if (onError) {
        onError(error, errorInfo);
      }
    };

    // Store original console.error to avoid infinite loops
    const originalConsoleError = console.error;
    
    // Override console.error temporarily to catch component errors
    console.error = (...args) => {
      const firstArg = args[0];
      if (typeof firstArg === 'string' && 
          (firstArg.includes('Warning:') || 
           firstArg.includes('Error:') || 
           firstArg.includes('Uncaught'))) {
        // Log the error but don't crash the component
        logger.error(`Console error in ${componentName}`, { args });
      } else {
        originalConsoleError.apply(console, args);
      }
    };

    return () => {
      // Restore original console.error
      console.error = originalConsoleError;
    };
  }, [componentName, onError]);

  const handleRetry = () => {
    logger.info(`User retrying ${componentName} after error`);
    setHasError(false);
    setError(null);
  };

  if (hasError) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/10">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              {componentName} Error
            </h3>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
              {error?.message || 'Something went wrong'}
            </p>
            {import.meta.env.DEV && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-red-700">Error Details</summary>
                <pre className="mt-1 whitespace-pre-wrap text-red-600">
                  {error?.stack || 'No stack trace available'}
                </pre>
              </details>
            )}
          </div>
          <Button 
            onClick={handleRetry} 
            variant="outline" 
            size="sm"
            className="text-xs"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// HOC for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => (
    <ComponentErrorBoundary componentName={componentName || Component.name}>
      <Component {...props} />
    </ComponentErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${componentName || Component.name})`;
  
  return WrappedComponent;
};
