import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface QueryErrorHandlerOptions {
  onError?: (error: any) => void;
  showToast?: boolean;
}

export const useQueryErrorHandler = (options: QueryErrorHandlerOptions = {}) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.state.status === 'error') {
        const error = event.query.state.error;
        
        // Handle 401 errors globally - redirect to login
        if ((error as any)?.response?.status === 401) {
          const currentPath = window.location.pathname;
          if (currentPath !== '/login') {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }
        }

        // Call custom error handler if provided
        if (options.onError) {
          options.onError(error);
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient, options]);
};

// Custom hook for mutation error handling
export const useMutationErrorHandler = () => {
  const handleMutationError = (error: any): string => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;

    if (error?.code === 'ERR_NETWORK') {
      return 'Connection failed. Please check your internet connection.';
    }

    if (status >= 500) {
      return 'Server error. Please try again later.';
    }

    if (status === 401) {
      return 'Session expired. Please log in again.';
    }

    if (status === 403) {
      return 'You do not have permission to perform this action.';
    }

    if (status === 404) {
      return 'The requested resource was not found.';
    }

    if (status === 409) {
      return detail || 'A conflict occurred. The data may have been modified.';
    }

    if (status === 400) {
      return detail || 'Invalid data provided. Please check your input.';
    }

    return detail || error?.message || 'An unexpected error occurred.';
  };

  return { handleMutationError };
};

export default useQueryErrorHandler;
