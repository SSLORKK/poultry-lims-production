import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';

// Token storage keys
const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const REMEMBER_ME_KEY = 'rememberMe';

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
        remember_me: rememberMe,
      });
      
      // Store both access and refresh tokens
      localStorage.setItem(TOKEN_KEY, response.data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh_token);

      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
      }

      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
      setIsLoading(false);
      throw err; // Re-throw so component can catch it
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string, fullName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/register', {
        username,
        email,
        password,
        full_name: fullName,
        role: 'technician',
      });
      
      // Store both tokens
      localStorage.setItem(TOKEN_KEY, response.data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh_token);
      
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to log on server
      await apiClient.post('/auth/logout');
    } catch (err) {
      // Ignore errors - we still want to clear local storage
      console.warn('Logout API call failed:', err);
    }
    
    // Clear all auth-related storage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    localStorage.removeItem('sessionExpiry');
    localStorage.removeItem('session_expired');
    
    navigate('/login');
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken,
      });
      
      // Update only the access token
      localStorage.setItem(TOKEN_KEY, response.data.access_token);
      return true;
    } catch (err) {
      console.warn('Token refresh failed:', err);
      return false;
    }
  };

  const isAuthenticated = (): boolean => {
    return !!localStorage.getItem(TOKEN_KEY);
  };

  const getAccessToken = (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  };

  return { 
    login, 
    register, 
    logout, 
    refreshAccessToken,
    isAuthenticated,
    getAccessToken,
    isLoading, 
    error 
  };
};

// Export token keys for use in apiClient
export { TOKEN_KEY, REFRESH_TOKEN_KEY };
