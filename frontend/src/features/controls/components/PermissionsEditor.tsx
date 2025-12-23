import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';

type Permission = {
  screen_name: string;
  can_read: boolean;
  can_write: boolean;
};

type PermissionsEditorProps = {
  userId: number;
  onClose: () => void;
};

const SCREENS = [
  'Dashboard',
  'All Samples',
  'Register Sample',
  'PCR Samples',
  'Serology Samples',
  'Microbiology Samples',
  'Database - PCR',
  'Database - Serology',
  'Database - Microbiology',
  'Controls'
];

const PermissionsEditor = ({ userId, onClose }: PermissionsEditorProps) => {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Fetch permissions for the user
  const { data: permissionsData, isLoading } = useQuery({
    queryKey: ['userPermissions', userId],
    queryFn: async () => {
      const response = await apiClient.get(`/users/${userId}/permissions`);
      return response.data;
    },
  });

  // Initialize permissions state when data loads
  useEffect(() => {
    if (permissionsData?.permissions) {
      setPermissions(permissionsData.permissions);
    }
  }, [permissionsData]);

  // Mutation to update permissions
  const updateMutation = useMutation({
    mutationFn: async (updatedPermissions: Permission[]) => {
      const response = await apiClient.put(`/users/${userId}/permissions`, {
        permissions: updatedPermissions
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPermissions', userId] });
      alert('Permissions updated successfully!');
      onClose();
    },
    onError: (error: any) => {
      alert(error.response?.data?.detail || 'Failed to update permissions');
    },
  });

  const handlePermissionChange = (screenName: string, field: 'can_read' | 'can_write', value: boolean) => {
    setPermissions(prevPermissions => {
      const updatedPermissions = prevPermissions.map(perm => {
        if (perm.screen_name === screenName) {
          const updated = { ...perm, [field]: value };
          // If can_write is checked, auto-check can_read
          if (field === 'can_write' && value) {
            updated.can_read = true;
          }
          // If can_read is unchecked, auto-uncheck can_write
          if (field === 'can_read' && !value) {
            updated.can_write = false;
          }
          return updated;
        }
        return perm;
      });
      return updatedPermissions;
    });
  };

  const handleSave = () => {
    updateMutation.mutate(permissions);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Manage Screen Permissions
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Control what this user can see and do on each screen
          </p>
        </div>

        {/* Permissions Table */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border border-gray-300">
                    Screen
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border border-gray-300 w-24">
                    Read
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border border-gray-300 w-24">
                    Write
                  </th>
                </tr>
              </thead>
              <tbody>
                {SCREENS.map(screenName => {
                  const permission = permissions.find(p => p.screen_name === screenName);
                  if (!permission) return null;

                  return (
                    <tr key={screenName} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900 border border-gray-300 font-medium">
                        {screenName}
                      </td>
                      <td className="px-4 py-3 text-center border border-gray-300">
                        <input
                          type="checkbox"
                          checked={permission.can_read}
                          onChange={(e) => handlePermissionChange(screenName, 'can_read', e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-center border border-gray-300">
                        <input
                          type="checkbox"
                          checked={permission.can_write}
                          onChange={(e) => handlePermissionChange(screenName, 'can_write', e.target.checked)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Info Box */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Permission Rules:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Read:</strong> User can view the screen and its data</li>
                  <li><strong>Write:</strong> User can create, edit, and delete (automatically includes Read)</li>
                  <li>Unchecking Read will automatically uncheck Write</li>
                  <li>Checking Write will automatically check Read</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionsEditor;
