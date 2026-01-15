/**
 * Secure token management utility for authentication
 * Handles token validation, expiration checking, and cleanup
 */
export class TokenManager {
  private static readonly TOKEN_KEY = 'token';

  /**
   * Validates JWT token structure and expiration
   */
  private static validateToken(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      return payload.exp && payload.exp > currentTime;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Retrieves a valid token from localStorage
   * @returns Valid token or null if expired/invalid
   */
  static getValidToken(): string | null {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (!token) return null;

      if (!this.validateToken(token)) {
        this.clearToken();
        return null;
      }

      return token;
    } catch (error) {
      console.error('Error retrieving token:', error);
      this.clearToken();
      return null;
    }
  }

  /**
   * Stores a new token after validation
   */
  static setToken(token: string): boolean {
    if (!this.validateToken(token)) {
      console.error('Attempted to store invalid token');
      return false;
    }

    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      return true;
    } catch (error) {
      console.error('Failed to store token:', error);
      return false;
    }
  }

  /**
   * Clears token and redirects to login
   */
  static clearToken(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }

  /**
   * Checks if user is authenticated with valid token
   */
  static isAuthenticated(): boolean {
    return this.getValidToken() !== null;
  }
}
