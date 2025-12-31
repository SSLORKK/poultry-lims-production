import React from 'react';

interface ApiErrorProps {
  error: any;
  onRetry?: () => void;
  className?: string;
}

/**
 * Component to display API errors with detailed information
 * Handles both standard errors and structured API error responses
 */
const ApiError: React.FC<ApiErrorProps> = ({ error, onRetry, className = '' }) => {
  // Extract error details from various error formats
  const getErrorDetails = () => {
    if (!error) {
      return { message: 'Unknown error occurred', type: 'Error', location: '', path: '' };
    }

    // Handle axios error response
    if (error.response?.data) {
      const data = error.response.data;
      return {
        message: data.message || data.detail || error.message || 'Server error',
        type: data.error_type || 'ServerError',
        location: data.location || '',
        path: data.path || '',
        status: error.response.status,
      };
    }

    // Handle network errors
    if (error.code === 'ERR_NETWORK') {
      return {
        message: 'Cannot connect to server. Please check your connection.',
        type: 'NetworkError',
        location: '',
        path: '',
      };
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      return {
        message: 'Request timed out. The server took too long to respond.',
        type: 'TimeoutError',
        location: '',
        path: '',
      };
    }

    // Handle standard Error objects
    return {
      message: error.message || 'An unexpected error occurred',
      type: error.name || 'Error',
      location: '',
      path: '',
    };
  };

  const details = getErrorDetails();

  return (
    <div className={`bg-red-50 border border-red-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-800">
            {details.status ? `Error ${details.status}` : 'Error'}: {details.type}
          </h4>
          <p className="mt-1 text-sm text-red-600">{details.message}</p>
          
          {details.path && (
            <p className="mt-1 text-xs text-red-500 font-mono">
              Endpoint: {details.path}
            </p>
          )}
          
          {details.location && (
            <p className="mt-1 text-xs text-red-400 font-mono truncate" title={details.location}>
              Location: {details.location}
            </p>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiError;
