import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

type Permission = {
  screen_name: string;
  can_read: boolean;
  can_write: boolean;
};

type UserPermissionsResponse = {
  user_id: number;
  permissions: Permission[];
};

export const usePermissions = () => {
  const { data: permissionsData, isLoading, isError } = useQuery<UserPermissionsResponse>({
    queryKey: ['currentUserPermissions'],
    queryFn: async () => {
      try {
        // Get current user first
        const userResponse = await apiClient.get('/auth/me');
        const userId = userResponse.data.id;
        
        // Then get their permissions
        const permissionsResponse = await apiClient.get(`/users/${userId}/permissions`);
        return permissionsResponse.data;
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 1;
    },
    refetchOnWindowFocus: false,
  });

  const canRead = (screenName: string): boolean => {
    if (!permissionsData?.permissions) return false;
    const permission = permissionsData.permissions.find(
      (p) => p.screen_name === screenName
    );
    return permission?.can_read || false;
  };

  const canWrite = (screenName: string): boolean => {
    if (!permissionsData?.permissions) return false;
    const permission = permissionsData.permissions.find(
      (p) => p.screen_name === screenName
    );
    return permission?.can_write || false;
  };

  const hasAnyPermission = (screenName: string): boolean => {
    return canRead(screenName) || canWrite(screenName);
  };

  return {
    permissions: permissionsData?.permissions || [],
    canRead,
    canWrite,
    hasAnyPermission,
    isLoading,
    isError,
  };
};
