import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';

export interface DropdownItem {
  id: number;
  name: string;
  department_id?: number;
  company_id?: number;
  is_active: boolean;
}

export const useCompanies = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'companies'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/companies');
      return response.data;
    },
  });
};

export const useFarms = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'farms'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/farms');
      return response.data;
    },
  });
};

export const useFlocks = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'flocks'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/flocks');
      return response.data;
    },
  });
};

export const useCycles = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'cycles'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/cycles');
      return response.data;
    },
  });
};

export const useStatuses = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'statuses'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/statuses');
      return response.data;
    },
  });
};

export const useHouses = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'houses'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/houses');
      return response.data;
    },
  });
};

export const useSources = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'sources'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/sources');
      return response.data;
    },
  });
};

export const useTechnicians = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'technicians'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/technicians');
      return response.data;
    },
  });
};

export const useSampleTypes = (departmentId?: number) => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'sample-types', departmentId],
    queryFn: async () => {
      const url = departmentId
        ? `/controls/sample-types?department_id=${departmentId}`
        : '/controls/sample-types';
      const response = await apiClient.get(url);
      return response.data;
    },
    enabled: !!departmentId,
  });
};

export const useDiseases = (departmentId?: number) => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'diseases', departmentId],
    queryFn: async () => {
      const url = departmentId
        ? `/controls/diseases?department_id=${departmentId}`
        : '/controls/diseases';
      const response = await apiClient.get(url);
      return response.data;
    },
    enabled: !!departmentId,
  });
};

export const useKitTypes = (departmentId?: number) => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'kit-types', departmentId],
    queryFn: async () => {
      const url = departmentId
        ? `/controls/kit-types?department_id=${departmentId}`
        : '/controls/kit-types';
      const response = await apiClient.get(url);
      console.log('Kit Types API Response:', response.data, 'for department:', departmentId);
      return response.data;
    },
    enabled: !!departmentId,
    staleTime: 0,
    gcTime: 0,
  });
};

export const useExtractionMethods = () => {
  return useQuery<DropdownItem[]>({
    queryKey: ['controls', 'extraction-methods'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/extraction-methods');
      return response.data;
    },
  });
};
