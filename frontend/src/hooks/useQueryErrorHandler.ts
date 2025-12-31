import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface QueryErrorHandlerOptions {
  onError?: (error: any) => void;
  showToast?: boolean;
}

// Track consecutive 401 errors to distinguish real auth failures from transient issues
const auth401State = {
  count: 0,
  lastTime: 0,
  threshold: 5, // Require 5 consecutive 401s within 60 seconds (more forgiving)
  timeWindow: 60000, // 60 seconds
};

// Check if token is expired by decoding JWT
const isTokenExpired = (): boolean => {
  const token = localStorage.getItem('token');
  if (!token) return true;
  
  try {
    // Decode JWT payload (middle part)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const buffer = 60000; // 1 minute buffer
    return now >= (exp - buffer);
  } catch {
    return true; // If we can't decode, assume expired
  }
};

// Reset 401 counter on successful requests
export const resetAuth401Counter = () => {
  auth401State.count = 0;
  auth401State.lastTime = 0;
};

// Register globally for apiClient to access
if (typeof window !== 'undefined') {
  (window as any).__resetAuth401Counter = resetAuth401Counter;
}

export const useQueryErrorHandler = (options: QueryErrorHandlerOptions = {}) => {
  const queryClient = useQueryClient();
  const handledRef = useRef(false);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event.query.state.status === 'error') {
        const error = event.query.state.error;
        
        // Handle 401 errors with smart retry logic
        if ((error as any)?.response?.status === 401) {
          const currentPath = window.location.pathname;
          if (currentPath !== '/login' && !handledRef.current) {
            const now = Date.now();
            
            // Check if token is actually expired
            if (isTokenExpired()) {
              console.info('Token expired, redirecting to login');
              handledRef.current = true;
              localStorage.removeItem('token');
              localStorage.setItem('session_expired', 'true');
              window.location.href = '/login';
              return;
            }
            
            // Reset counter if outside time window
            if (now - auth401State.lastTime > auth401State.timeWindow) {
              auth401State.count = 0;
            }
            
            auth401State.count++;
            auth401State.lastTime = now;
            
            // Only logout after multiple consecutive 401s (indicates real auth issue)
            if (auth401State.count >= auth401State.threshold) {
              console.warn(`Multiple 401 errors (${auth401State.count}), session likely invalid`);
              handledRef.current = true;
              localStorage.removeItem('token');
              localStorage.setItem('session_expired', 'true');
              window.location.href = '/login';
            } else {
              console.info(`401 error ${auth401State.count}/${auth401State.threshold}, may be transient`);
            }
          }
        } else {
          // Any non-401 response resets the counter (server is working)
          resetAuth401Counter();
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
