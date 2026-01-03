import axios, { AxiosError } from 'axios';

// API URL configuration - uses VITE_API_URL from .env, falls back to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Server status tracking - prevents logout during server downtime
export const serverStatus = {
  isDown: false,
  lastCheck: 0,
  downSince: 0,
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  paramsSerializer: {
    // Properly serialize array parameters for FastAPI
    // This converts ['item1', 'item2'] into ?param=item1&param=item2
    serialize: (params) => {
      const parts: string[] = [];
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // Send array items as separate parameters
          value.forEach((item) => {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
          });
        } else if (value !== null && value !== undefined) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
      });
      return parts.join('&');
    }
  }
});

// Request interceptor - just add token, NO auto-redirect
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-retry configuration for transient errors
const RETRY_STATUS_CODES = [502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const SERVER_DOWN_GRACE_PERIOD = 120000; // 2 minutes grace period when server is down

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mark server as down
const markServerDown = () => {
  if (!serverStatus.isDown) {
    serverStatus.downSince = Date.now();
  }
  serverStatus.isDown = true;
  serverStatus.lastCheck = Date.now();
};

// Mark server as up
const markServerUp = () => {
  serverStatus.isDown = false;
  serverStatus.downSince = 0;
  serverStatus.lastCheck = Date.now();
};

// Check if we should suppress auth errors (server recently went down)
export const isServerDownGracePeriod = (): boolean => {
  if (!serverStatus.isDown) return false;
  return (Date.now() - serverStatus.downSince) < SERVER_DOWN_GRACE_PERIOD;
};

// Response interceptor - Handle server restarts gracefully
apiClient.interceptors.response.use(
  (response) => {
    // Server is responding - mark as up
    markServerUp();
    
    // Reset 401 counter on any successful response
    if (typeof window !== 'undefined' && (window as any).__resetAuth401Counter) {
      (window as any).__resetAuth401Counter();
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as any;
    if (!config) {
      return Promise.reject(error);
    }
    
    // Initialize retry count
    config.__retryCount = config.__retryCount || 0;
    
    // Handle network errors (server unavailable/restarting) - AUTO RETRY
    if (!error.response) {
      // Mark server as down
      markServerDown();
      
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount++;
        console.info(`Network error, retrying (${config.__retryCount}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * config.__retryCount);
        return apiClient(config);
      }
      console.warn('Network error - server may be unavailable:', error.message);
      (error as any).isNetworkError = true;
      (error as any).isServerDown = true;
      (error as any).userMessage = 'Server is temporarily unavailable. Please wait and try again.';
    }
    // Handle 502/503/504 errors (server restarting) - AUTO RETRY
    else if (RETRY_STATUS_CODES.includes(error.response?.status)) {
      // Mark server as down
      markServerDown();
      
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount++;
        console.info(`Server error ${error.response.status}, retrying (${config.__retryCount}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * config.__retryCount);
        return apiClient(config);
      }
      console.warn('Server error - may be restarting:', error.response?.status);
      (error as any).isServerError = true;
      (error as any).isServerDown = true;
      (error as any).userMessage = 'Server is restarting. Please wait and try again.';
    }
    // Handle 401 errors - distinguish from server down and try token refresh
    else if (error.response?.status === 401) {
      // If server was recently down, this might be a false 401
      if (isServerDownGracePeriod()) {
        console.info('401 during server recovery - suppressing logout');
        (error as any).isServerRecovering = true;
        (error as any).userMessage = 'Server is recovering. Please wait...';
      } else {
        // Server is up - try to refresh the token if we have a refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        const isRefreshRequest = config?.url?.includes('/auth/refresh');
        
        // Don't try to refresh if this IS the refresh request (avoid infinite loop)
        if (refreshToken && !isRefreshRequest && !config?.__tokenRefreshAttempted) {
          config.__tokenRefreshAttempted = true;
          
          try {
            console.info('Access token expired, attempting refresh...');
            const refreshResponse = await apiClient.post('/auth/refresh', {
              refresh_token: refreshToken
            });
            
            // Update the access token
            const newAccessToken = refreshResponse.data.access_token;
            localStorage.setItem('token', newAccessToken);
            
            // Retry the original request with new token
            config.headers.Authorization = `Bearer ${newAccessToken}`;
            console.info('Token refreshed successfully, retrying request');
            return apiClient(config);
          } catch (refreshError) {
            console.warn('Token refresh failed:', refreshError);
            // Let the 401 error propagate - will trigger logout
          }
        }
        
        console.warn('API returned 401 Unauthorized:', config?.url);
        markServerUp();
      }
    } else {
      // Any other response means server is up
      markServerUp();
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
