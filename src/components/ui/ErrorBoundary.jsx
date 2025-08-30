/**
 * ErrorBoundary.jsx
 * 
 * Error boundary component for lazy loaded AI features
 */

import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log to performance monitoring if available
    if (window.performance && window.performance.mark) {
      window.performance.mark('ai-feature-load-error');
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleDisableFeature = () => {
    // Call parent callback to disable AI features
    if (this.props.onDisableFeature) {
      this.props.onDisableFeature();
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div className="border border-red-200 bg-red-50 rounded-lg p-6 m-4">
          <div className="flex items-center space-x-2 mb-4">
            <div className="text-red-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-red-800">
              AI Feature Loading Failed
            </h3>
          </div>

          <div className="text-red-700 mb-4">
            {this.props.userFriendlyMessage || 'There was an error loading the AI features. The core application will continue to work normally.'}
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-4">
              <summary className="cursor-pointer text-red-600 text-sm font-medium mb-2">
                Technical Details (Development)
              </summary>
              <div className="bg-red-100 border border-red-200 rounded p-3 text-xs font-mono text-red-800 overflow-auto max-h-32">
                <div className="font-semibold mb-1">Error:</div>
                <div className="mb-2">{this.state.error && this.state.error.toString()}</div>
                {this.state.errorInfo && this.state.errorInfo.componentStack && (
                  <>
                    <div className="font-semibold mb-1">Component Stack:</div>
                    <div>{this.state.errorInfo.componentStack}</div>
                  </>
                )}
              </div>
            </details>
          )}

          <div className="flex space-x-3">
            {this.state.retryCount < 3 && (
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {this.state.retryCount === 0 ? 'Retry' : `Retry (${3 - this.state.retryCount} attempts left)`}
              </button>
            )}
            
            <button
              onClick={this.handleDisableFeature}
              className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Continue Without AI
            </button>
            
            {this.props.onReportError && (
              <button
                onClick={() => this.props.onReportError(this.state.error, this.state.errorInfo)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Report Issue
              </button>
            )}
          </div>

          {this.state.retryCount >= 3 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <div className="text-yellow-800 text-sm">
                <strong>Multiple failures detected.</strong> AI features may be incompatible with your browser or device. 
                The application will continue to work without AI assistance.
              </div>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for easier usage with hooks
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  const WrappedComponent = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Simple error fallback component
export const SimpleErrorFallback = ({ error, retry, disable }) => (
  <div className="text-center py-8 px-4 bg-gray-50 border border-gray-200 rounded-lg">
    <div className="text-gray-600 mb-4">
      <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      Something went wrong loading this feature
    </div>
    <div className="space-x-2">
      {retry && (
        <button
          onClick={retry}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      )}
      {disable && (
        <button
          onClick={disable}
          className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
        >
          Skip
        </button>
      )}
    </div>
  </div>
);

export default ErrorBoundary;