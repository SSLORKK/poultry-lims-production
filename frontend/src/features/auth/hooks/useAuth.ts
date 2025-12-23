import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';

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
      localStorage.setItem('token', response.data.access_token);

      // Store remember me preference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        // Remove any session expiration
        localStorage.removeItem('sessionExpiry');
      } else {
        localStorage.removeItem('rememberMe');
        // Set session to expire in 8 hours if not remembered (matches backend JWT expiration)
        const expiryTime = Date.now() + (8 * 60 * 60 * 1000);
        localStorage.setItem('sessionExpiry', expiryTime.toString());
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
      localStorage.setItem('token', response.data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('sessionExpiry');
    navigate('/login');
  };

  return { login, register, logout, isLoading, error };
};
