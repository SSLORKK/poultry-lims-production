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

// Response interceptor - NEVER auto-redirect to login
// Let components handle 401 errors gracefully
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log 401 errors for debugging but NEVER redirect
    if (error.response?.status === 401) {
      console.warn('API returned 401 Unauthorized:', error.config?.url);
      // DO NOT redirect - let the component handle the error
    }
    return Promise.reject(error);
  }
);

export default apiClient;
