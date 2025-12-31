import axios from 'axios';

// API URL configuration - uses VITE_API_URL from .env, falls back to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Response interceptor - Handle server restarts gracefully
apiClient.interceptors.response.use(
  (response) => {
    // Reset 401 counter on any successful response
    if (typeof window !== 'undefined' && (window as any).__resetAuth401Counter) {
      (window as any).__resetAuth401Counter();
    }
    return response;
  },
  async (error) => {
    const config = error.config;
    
    // Initialize retry count
    config.__retryCount = config.__retryCount || 0;
    
    // Handle network errors (server unavailable/restarting) - AUTO RETRY
    if (!error.response) {
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount++;
        console.info(`Network error, retrying (${config.__retryCount}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * config.__retryCount);
        return apiClient(config);
      }
      console.warn('Network error - server may be unavailable:', error.message);
      error.isNetworkError = true;
      error.userMessage = 'Server is temporarily unavailable. Please reload the page to try again.';
    }
    // Handle 502/503/504 errors (server restarting) - AUTO RETRY
    else if (RETRY_STATUS_CODES.includes(error.response?.status)) {
      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount++;
        console.info(`Server error ${error.response.status}, retrying (${config.__retryCount}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY * config.__retryCount);
        return apiClient(config);
      }
      console.warn('Server error - may be restarting:', error.response?.status);
      error.isServerError = true;
      error.userMessage = 'Server is restarting. Please reload the page to continue.';
    }
    // Log 401 errors for debugging but NEVER redirect
    else if (error.response?.status === 401) {
      console.warn('API returned 401 Unauthorized:', config?.url);
      // DO NOT redirect - let useQueryErrorHandler handle it
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
