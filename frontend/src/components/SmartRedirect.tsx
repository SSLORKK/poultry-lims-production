import { Navigate, useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Smart redirect component that redirects users to the first screen they have permission to access.
 * This is used as the default route after login.
 */
export function SmartRedirect() {
  const { hasAnyPermission, isLoading, isError, permissions } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    localStorage.removeItem('token');
    queryClient.clear();
    navigate('/login');
  };

  // Show loading while permissions are being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading permissions...</p>
        </div>
      </div>
    );
  }

  // Helper function to find first allowed route
  const getFirstAllowedRoute = (): string | null => {
    if (hasAnyPermission('Dashboard')) return '/dashboard';
    if (hasAnyPermission('All Samples')) return '/all-samples';
    if (hasAnyPermission('Register Sample')) return '/register-sample';
    if (hasAnyPermission('PCR Samples')) return '/pcr/samples';
    if (hasAnyPermission('Serology Samples')) return '/serology/samples';
    if (hasAnyPermission('Microbiology Samples')) return '/microbiology/samples';
    if (hasAnyPermission('Database - PCR') || hasAnyPermission('Database - Serology') || hasAnyPermission('Database - Microbiology')) return '/database';
    if (hasAnyPermission('Controls')) return '/controls';
    return null;
  };

  const firstAllowedRoute = getFirstAllowedRoute();

  // If user has at least one allowed route, redirect there
  if (firstAllowedRoute) {
    return <Navigate to={firstAllowedRoute} replace />;
  }

  // If there was an error fetching permissions OR no permissions set up, show error with logout
  // This prevents infinite redirect loops
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
        <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No Access</h2>
        {isError ? (
          <p className="text-gray-600 mb-4">Failed to load your permissions. Please try logging in again.</p>
        ) : permissions.length === 0 ? (
          <p className="text-gray-600 mb-4">Your account has no permissions configured yet. Please contact your administrator.</p>
        ) : (
          <p className="text-gray-600 mb-4">You don't have permission to access any screens. Please contact your administrator.</p>
        )}
        <button
          onClick={handleLogout}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 mx-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}
