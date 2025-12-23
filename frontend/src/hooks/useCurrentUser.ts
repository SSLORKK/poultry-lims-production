import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

type CurrentUser = {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  profile_picture: string | null;
};

export const useCurrentUser = () => {
  const { data: user, isLoading, error } = useQuery<CurrentUser>({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/me');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors - let the component handle it
      if (error?.response?.status === 401) {
        return false;
      }
      return failureCount < 1;
    },
    // Don't refetch on window focus to prevent logout during critical operations
    refetchOnWindowFocus: false,
  });

  return {
    user,
    isLoading,
    error,
  };
};
