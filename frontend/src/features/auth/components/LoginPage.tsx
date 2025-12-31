import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<{ title: string; message: string; code: string } | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { login, isLoading } = useAuth();
  
  // Check if user was redirected due to session expiration
  useEffect(() => {
    const expired = localStorage.getItem('session_expired');
    if (expired === 'true') {
      setSessionExpired(true);
      localStorage.removeItem('session_expired');
    }
  }, []);

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setError(null); // Clear error when user types
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setError(null); // Clear error when user types
  };

  const getErrorMessage = (err: any): { title: string; message: string; code: string } => {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    
    // Network/Connection errors
    if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
      return {
        title: 'Connection Failed',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
        code: 'NET_ERR'
      };
    }
    
    // Server errors (5xx)
    if (status >= 500) {
      return {
        title: 'Service Unavailable',
        message: 'Our servers are experiencing technical difficulties. Please try again in a few moments.',
        code: `SRV_${status}`
      };
    }
    
    // Authentication errors
    if (status === 401) {
      return {
        title: 'Authentication Failed',
        message: detail || 'Invalid username or password. Please verify your credentials and try again.',
        code: 'AUTH_401'
      };
    }
    
    // Too many requests
    if (status === 429) {
      return {
        title: 'Too Many Attempts',
        message: 'You have exceeded the maximum number of login attempts. Please wait a few minutes before trying again.',
        code: 'RATE_429'
      };
    }
    
    // Account locked/disabled
    if (status === 403) {
      return {
        title: 'Access Denied',
        message: detail || 'Your account has been locked or disabled. Please contact your system administrator.',
        code: 'ACCESS_403'
      };
    }
    
    // Timeout
    if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
      return {
        title: 'Request Timeout',
        message: 'The server took too long to respond. Please check your connection and try again.',
        code: 'TIMEOUT'
      };
    }
    
    // Default error
    return {
      title: 'Login Failed',
      message: detail || 'An unexpected error occurred. Please try again or contact support if the problem persists.',
      code: 'UNKNOWN'
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors

    try {
      await login(username, password, rememberMe);
      // If successful, login will navigate away
    } catch (err: any) {
      // Get professional error message
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
      </div>

      {/* Floating Orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute top-40 right-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo & Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-purple-400 via-pink-400 to-indigo-400 shadow-2xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Poultry LIMS
          </h1>
          <p className="text-purple-200 text-sm font-medium">
            Laboratory Information Management System
          </p>
        </div>

        {/* Glassmorphism Login Card */}
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8 transition-all duration-300 hover:shadow-purple-500/20">
          <h2 className="text-2xl font-bold text-white text-center mb-6">
            Sign In
          </h2>

          {sessionExpired && !error && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/20 border border-amber-400/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-amber-500/30 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-200" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-amber-100 font-semibold text-sm">Session Expired</h4>
                  <p className="text-amber-200/80 text-xs mt-1">Your session has expired. Please sign in again to continue.</p>
                </div>
                <button 
                  onClick={() => setSessionExpired(false)}
                  className="flex-shrink-0 text-amber-300/70 hover:text-amber-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-400/30 backdrop-blur-sm animate-shake">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-500/30 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-200" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-red-100 font-semibold text-sm">{error.title}</h4>
                  <p className="text-red-200/80 text-xs mt-1 leading-relaxed">{error.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-red-500/30 text-red-200/70">
                      {error.code}
                    </span>
                    <span className="text-red-300/50 text-xs">•</span>
                    <span className="text-red-300/50 text-xs">{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setError(null)}
                  className="flex-shrink-0 text-red-300/70 hover:text-red-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div className="group">
              <label className="block text-purple-100 text-sm font-semibold mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="group">
              <label className="block text-purple-100 text-sm font-semibold mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-200 backdrop-blur-sm"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 bg-white/10 border-white/20 rounded text-purple-500 focus:ring-2 focus:ring-purple-400 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-purple-100 cursor-pointer select-none">
                Remember me on this device
              </label>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 py-3 px-4 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 text-white font-bold rounded-lg shadow-lg hover:shadow-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </span>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-center text-purple-200/70 text-xs">
              Access is restricted to authorized personnel only
            </p>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="text-center mt-6">
          <p className="text-purple-200/50 text-xs">
            © 2025 Poultry LIMS. All rights reserved.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};
