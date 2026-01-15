/**
 * Secure API client singleton for query operations
 * Prevents unnecessary recreation and provides secure token handling
 */
import axios, { AxiosInstance } from 'axios';
import { TokenManager } from '../utils/tokenManager';

class QueryApiClient {
  private static instance: AxiosInstance | null = null;
  private static readonly BASE_URL = '/api/v1';

  /**
   * Get singleton API client instance with automatic token management
   * @param autoRedirect - Whether to automatically redirect to login on 401 errors
   */
  static getInstance(autoRedirect: boolean = false): AxiosInstance {
    if (!this.instance || this.instance.defaults.headers['X-Auto-Redirect'] !== autoRedirect.toString()) {
      this.createInstance(autoRedirect);
    }
    return this.instance!;
  }

  /**
   * Create new API client instance with current token
   */
  private static createInstance(autoRedirect: boolean = false): void {
    const token = TokenManager.getValidToken();
    if (!token) {
      throw new Error('Authentication required - please login again');
    }

    this.instance = axios.create({
      baseURL: this.BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Auto-Redirect': autoRedirect.toString()
      }
    });

    // Add response interceptor to handle token expiration conditionally
    this.instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && autoRedirect) {
          TokenManager.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Refresh the instance when token changes
   */
  static refreshInstance(): void {
    this.instance = null;
    this.createInstance();
  }

  /**
   * Clear the instance (for logout)
   */
  static clearInstance(): void {
    this.instance = null;
  }
}

export { QueryApiClient };
