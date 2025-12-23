import React from 'react';

interface ApiError {
  title: string;
  message: string;
  code: string;
  status?: number;
  timestamp?: string;
}

interface ApiErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export const parseApiError = (error: any): ApiError => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  const timestamp = new Date().toLocaleTimeString();

  // Network/Connection errors
  if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
    return {
      title: 'Connection Failed',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      code: 'NET_ERR',
      status: 0,
      timestamp
    };
  }

  // Server errors (5xx)
  if (status >= 500) {
    return {
      title: 'Service Unavailable',
      message: 'Our servers are experiencing technical difficulties. Please try again in a few moments.',
      code: `SRV_${status}`,
      status,
      timestamp
    };
  }

  // Bad Gateway
  if (status === 502) {
    return {
      title: 'Service Temporarily Unavailable',
      message: 'The server is currently unable to handle your request. This is usually temporary.',
      code: 'SRV_502',
      status,
      timestamp
    };
  }

  // Not Found
  if (status === 404) {
    return {
      title: 'Resource Not Found',
      message: detail || 'The requested resource could not be found. It may have been moved or deleted.',
      code: 'NOT_FOUND',
      status,
      timestamp
    };
  }

  // Unauthorized
  if (status === 401) {
    return {
      title: 'Authentication Required',
      message: 'Your session has expired or you are not logged in. Please log in again.',
      code: 'AUTH_401',
      status,
      timestamp
    };
  }

  // Forbidden
  if (status === 403) {
    return {
      title: 'Access Denied',
      message: detail || 'You do not have permission to access this resource.',
      code: 'ACCESS_403',
      status,
      timestamp
    };
  }

  // Bad Request
  if (status === 400) {
    return {
      title: 'Invalid Request',
      message: detail || 'The request could not be processed due to invalid data.',
      code: 'BAD_REQ',
      status,
      timestamp
    };
  }

  // Conflict
  if (status === 409) {
    return {
      title: 'Conflict Detected',
      message: detail || 'The request could not be completed due to a conflict with the current state.',
      code: 'CONFLICT',
      status,
      timestamp
    };
  }

  // Too Many Requests
  if (status === 429) {
    return {
      title: 'Too Many Requests',
      message: 'You have exceeded the rate limit. Please wait a moment before trying again.',
      code: 'RATE_429',
      status,
      timestamp
    };
  }

  // Timeout
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return {
      title: 'Request Timeout',
      message: 'The server took too long to respond. Please check your connection and try again.',
      code: 'TIMEOUT',
      status: 0,
      timestamp
    };
  }

  // Default error
  return {
    title: 'Operation Failed',
    message: detail || error?.message || 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN',
    status: status || 0,
    timestamp
  };
};

export const ApiErrorDisplay: React.FC<ApiErrorDisplayProps> = ({ 
  error, 
  onRetry, 
  compact = false,
  className = ''
}) => {
  const parsedError = parseApiError(error);

  if (compact) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-red-800">{parsedError.title}</h4>
            <p className="text-sm text-red-600 mt-1">{parsedError.message}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-red-100 text-red-600">
                {parsedError.code}
              </span>
              {parsedError.timestamp && (
                <>
                  <span className="text-red-300 text-xs">•</span>
                  <span className="text-red-400 text-xs">{parsedError.timestamp}</span>
                </>
              )}
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="ml-auto text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Error Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-6 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">{parsedError.title}</h2>
          </div>

          {/* Error Body */}
          <div className="p-6">
            <p className="text-gray-600 text-sm text-center mb-4">
              {parsedError.message}
            </p>

            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-gray-100 text-gray-600">
                Error Code: {parsedError.code}
              </span>
              {parsedError.status !== undefined && parsedError.status > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-gray-100 text-gray-600">
                  HTTP {parsedError.status}
                </span>
              )}
            </div>

            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
            )}

            <p className="text-center text-gray-400 text-xs mt-4">
              {parsedError.timestamp && `Occurred at ${parsedError.timestamp}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Screen-level error component for when entire screens fail to load
export const ScreenError: React.FC<{
  title?: string;
  error: any;
  onRetry?: () => void;
}> = ({ title = 'Unable to Load', error, onRetry }) => {
  const parsedError = parseApiError(error);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 bg-gray-50">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <h2 className="text-lg font-semibold text-red-600 mb-3">{parsedError.title}</h2>
        
        {/* Message */}
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          {parsedError.message}
        </p>

        {/* Error Details */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <span className="text-xs font-mono text-gray-500">Error Code:</span>
          <span className="text-xs font-mono font-semibold text-red-600">{parsedError.code}</span>
          {parsedError.status !== undefined && parsedError.status > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-xs font-mono text-gray-500">HTTP:</span>
              <span className="text-xs font-mono font-semibold text-gray-600">{parsedError.status}</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          )}
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
        </div>

        {/* Help Text */}
        <p className="text-gray-400 text-xs mt-8">
          If this problem persists, please contact your system administrator.
          <br />
          Reference: {parsedError.code} at {parsedError.timestamp}
        </p>
      </div>
    </div>
  );
};

export default ApiErrorDisplay;
