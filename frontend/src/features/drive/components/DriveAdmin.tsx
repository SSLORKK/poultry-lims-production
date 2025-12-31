import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../../../services/apiClient';
import { useCurrentUser } from '../../../hooks/useCurrentUser';

interface DrivePermission {
  id: number;
  user_id: number;
  has_access: boolean;
  permission_level: string;
  folder_access: number[] | null;
  created_at: string;
  updated_at: string;
  username: string;
  full_name: string;
  role: string;
}

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
}

interface UserWithoutAccess {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

export const DriveAdmin = () => {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === 'admin';

  const [permissions, setPermissions] = useState<DrivePermission[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [usersWithoutAccess, setUsersWithoutAccess] = useState<UserWithoutAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; type: 'success' | 'error'; message: string }>>([]);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<DrivePermission | null>(null);
  
  // Form states
  const [formUserId, setFormUserId] = useState<number | ''>('');
  const [formHasAccess, setFormHasAccess] = useState(true);
  const [formPermissionLevel, setFormPermissionLevel] = useState('read');
  const [formFolderAccess, setFormFolderAccess] = useState<number[]>([]);
  const [formAllFolders, setFormAllFolders] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Redirect non-admin users
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [permRes, folderRes, usersRes] = await Promise.all([
        apiClient.get('/drive-admin/permissions'),
        apiClient.get('/drive-admin/folders'),
        apiClient.get('/drive-admin/permissions/users-without-access')
      ]);
      setPermissions(permRes.data);
      setFolders(folderRes.data);
      setUsersWithoutAccess(usersRes.data);
    } catch (err) {
      console.error('Failed to fetch drive admin data:', err);
      addToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddPermission = async () => {
    if (!formUserId) {
      addToast('error', 'Please select a user');
      return;
    }

    try {
      setSaving(true);
      await apiClient.post('/drive-admin/permissions', {
        user_id: formUserId,
        has_access: formHasAccess,
        permission_level: formPermissionLevel,
        folder_access: formAllFolders ? null : formFolderAccess
      });
      addToast('success', 'Permission added successfully');
      setShowAddModal(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('Failed to add permission:', err);
      addToast('error', err.response?.data?.detail || 'Failed to add permission');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePermission = async () => {
    if (!selectedPermission) return;

    try {
      setSaving(true);
      await apiClient.put(`/drive-admin/permissions/${selectedPermission.user_id}`, {
        has_access: formHasAccess,
        permission_level: formPermissionLevel,
        folder_access: formAllFolders ? null : formFolderAccess
      });
      addToast('success', 'Permission updated successfully');
      setShowEditModal(false);
      setSelectedPermission(null);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('Failed to update permission:', err);
      addToast('error', err.response?.data?.detail || 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePermission = async (userId: number) => {
    if (!confirm('Are you sure you want to remove this user\'s drive access?')) return;

    try {
      await apiClient.delete(`/drive-admin/permissions/${userId}`);
      addToast('success', 'Permission removed successfully');
      fetchData();
    } catch (err: any) {
      console.error('Failed to delete permission:', err);
      addToast('error', err.response?.data?.detail || 'Failed to delete permission');
    }
  };

  const handleToggleAccess = async (perm: DrivePermission) => {
    try {
      await apiClient.put(`/drive-admin/permissions/${perm.user_id}`, {
        has_access: !perm.has_access
      });
      addToast('success', `Access ${perm.has_access ? 'disabled' : 'enabled'} for ${perm.full_name}`);
      fetchData();
    } catch (err: any) {
      console.error('Failed to toggle access:', err);
      addToast('error', 'Failed to update access');
    }
  };

  const openEditModal = (perm: DrivePermission) => {
    setSelectedPermission(perm);
    setFormHasAccess(perm.has_access);
    setFormPermissionLevel(perm.permission_level);
    setFormAllFolders(!perm.folder_access || perm.folder_access.length === 0);
    setFormFolderAccess(perm.folder_access || []);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormUserId('');
    setFormHasAccess(true);
    setFormPermissionLevel('read');
    setFormFolderAccess([]);
    setFormAllFolders(true);
  };

  const getPermissionLevelBadge = (level: string) => {
    const badges: Record<string, string> = {
      read: 'bg-blue-100 text-blue-700',
      write: 'bg-green-100 text-green-700',
      admin: 'bg-purple-100 text-purple-700'
    };
    return badges[level] || 'bg-gray-100 text-gray-700';
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      manager: 'bg-orange-100 text-orange-700',
      technician: 'bg-blue-100 text-blue-700',
      viewer: 'bg-gray-100 text-gray-700'
    };
    return badges[role] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white ${
              toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Drive Access Management
              </h1>
              <p className="text-indigo-100 mt-1">
                Manage user permissions and access control for Drive storage
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="px-5 py-2.5 bg-white text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add User Access
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{permissions.length}</p>
                <p className="text-sm text-gray-500">Total Users</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{permissions.filter(p => p.has_access).length}</p>
                <p className="text-sm text-gray-500">Active Access</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{folders.length}</p>
                <p className="text-sm text-gray-500">Folders</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{usersWithoutAccess.length}</p>
                <p className="text-sm text-gray-500">No Access</p>
              </div>
            </div>
          </div>
        </div>

        {/* Permissions Table */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Access</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Permission</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Folder Access</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="font-medium">No permissions configured</p>
                      <p className="text-sm mt-1">Add users to grant them Drive access</p>
                    </td>
                  </tr>
                ) : (
                  permissions.map((perm) => (
                    <tr key={perm.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {perm.full_name?.charAt(0) || perm.username?.charAt(0) || '?'}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900">{perm.full_name || perm.username}</div>
                            <div className="text-sm text-gray-500">@{perm.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleBadge(perm.role)}`}>
                          {perm.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleAccess(perm)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            perm.has_access ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              perm.has_access ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getPermissionLevelBadge(perm.permission_level)}`}>
                          {perm.permission_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {!perm.folder_access || perm.folder_access.length === 0 ? (
                          <span className="text-sm text-gray-500">All Folders</span>
                        ) : (
                          <span className="text-sm text-gray-700">
                            {perm.folder_access.length} folder(s)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(perm)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePermission(perm.user_id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Permission Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-indigo-600 to-purple-600">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Add User Access</h3>
                <button onClick={() => setShowAddModal(false)} className="text-white hover:text-indigo-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select User</label>
                <select
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Choose a user...</option>
                  {usersWithoutAccess.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Access Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Enable Access</label>
                  <p className="text-xs text-gray-500">Allow user to access Drive</p>
                </div>
                <button
                  onClick={() => setFormHasAccess(!formHasAccess)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formHasAccess ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formHasAccess ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Permission Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permission Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {['read', 'write', 'admin'].map(level => (
                    <button
                      key={level}
                      onClick={() => setFormPermissionLevel(level)}
                      className={`px-4 py-3 rounded-lg border-2 text-center font-medium transition-all ${
                        formPermissionLevel === level
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className="capitalize">{level}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {level === 'read' && 'View only'}
                        {level === 'write' && 'Upload & edit'}
                        {level === 'admin' && 'Full control'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Folder Access */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Folder Access</label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formAllFolders}
                      onChange={(e) => setFormAllFolders(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    All Folders
                  </label>
                </div>
                {!formAllFolders && (
                  <div className="border rounded-lg p-3 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-3">Select specific folders to grant access:</p>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {folders.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No folders available</p>
                      ) : (
                        <>
                          {/* Root folders (parent_id === null) */}
                          {folders.filter(f => f.parent_id === null).map(rootFolder => {
                            const children = folders.filter(f => f.parent_id === rootFolder.id);
                            const isExpanded = expandedFolders.has(rootFolder.id);
                            const isSelected = formFolderAccess.includes(rootFolder.id);
                            
                            return (
                              <div key={rootFolder.id} className="border rounded-lg bg-white overflow-hidden">
                                <div className="flex items-center gap-2 p-2 hover:bg-gray-50">
                                  {children.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newExpanded = new Set(expandedFolders);
                                        if (isExpanded) {
                                          newExpanded.delete(rootFolder.id);
                                        } else {
                                          newExpanded.add(rootFolder.id);
                                        }
                                        setExpandedFolders(newExpanded);
                                      }}
                                      className="p-0.5 hover:bg-gray-200 rounded"
                                    >
                                      <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  )}
                                  {children.length === 0 && <div className="w-5" />}
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormFolderAccess([...formFolderAccess, rootFolder.id]);
                                      } else {
                                        setFormFolderAccess(formFolderAccess.filter(id => id !== rootFolder.id));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                  </svg>
                                  <span className="text-sm font-medium text-gray-700">{rootFolder.name}</span>
                                  {children.length > 0 && (
                                    <span className="text-xs text-gray-400 ml-auto">{children.length} subfolder(s)</span>
                                  )}
                                </div>
                                {/* Child folders */}
                                {isExpanded && children.length > 0 && (
                                  <div className="pl-8 pr-2 pb-2 space-y-1 border-t bg-gray-50">
                                    {children.map(child => {
                                      const isChildSelected = formFolderAccess.includes(child.id);
                                      return (
                                        <label key={child.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={isChildSelected}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setFormFolderAccess([...formFolderAccess, child.id]);
                                              } else {
                                                setFormFolderAccess(formFolderAccess.filter(id => id !== child.id));
                                              }
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                          />
                                          <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                          </svg>
                                          <span className="text-sm text-gray-600">{child.name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                    {formFolderAccess.length > 0 && (
                      <div className="mt-3 pt-3 border-t flex items-center justify-between">
                        <span className="text-xs text-indigo-600 font-medium">{formFolderAccess.length} folder(s) selected</span>
                        <button
                          type="button"
                          onClick={() => setFormFolderAccess([])}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Clear selection
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPermission}
                disabled={saving || !formUserId}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Add Permission
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permission Modal */}
      {showEditModal && selectedPermission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-indigo-600 to-purple-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Edit Permission</h3>
                  <p className="text-indigo-100 text-sm">{selectedPermission.full_name || selectedPermission.username}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-white hover:text-indigo-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Access Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Enable Access</label>
                  <p className="text-xs text-gray-500">Allow user to access Drive</p>
                </div>
                <button
                  onClick={() => setFormHasAccess(!formHasAccess)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formHasAccess ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formHasAccess ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Permission Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permission Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {['read', 'write', 'admin'].map(level => (
                    <button
                      key={level}
                      onClick={() => setFormPermissionLevel(level)}
                      className={`px-4 py-3 rounded-lg border-2 text-center font-medium transition-all ${
                        formPermissionLevel === level
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className="capitalize">{level}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {level === 'read' && 'View only'}
                        {level === 'write' && 'Upload & edit'}
                        {level === 'admin' && 'Full control'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Folder Access */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Folder Access</label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formAllFolders}
                      onChange={(e) => setFormAllFolders(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    All Folders
                  </label>
                </div>
                {!formAllFolders && (
                  <div className="border rounded-lg p-3 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-3">Select specific folders to grant access:</p>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {folders.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No folders available</p>
                      ) : (
                        <>
                          {folders.filter(f => f.parent_id === null).map(rootFolder => {
                            const children = folders.filter(f => f.parent_id === rootFolder.id);
                            const isExpanded = expandedFolders.has(rootFolder.id);
                            const isSelected = formFolderAccess.includes(rootFolder.id);
                            
                            return (
                              <div key={rootFolder.id} className="border rounded-lg bg-white overflow-hidden">
                                <div className="flex items-center gap-2 p-2 hover:bg-gray-50">
                                  {children.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newExpanded = new Set(expandedFolders);
                                        if (isExpanded) {
                                          newExpanded.delete(rootFolder.id);
                                        } else {
                                          newExpanded.add(rootFolder.id);
                                        }
                                        setExpandedFolders(newExpanded);
                                      }}
                                      className="p-0.5 hover:bg-gray-200 rounded"
                                    >
                                      <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </button>
                                  )}
                                  {children.length === 0 && <div className="w-5" />}
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormFolderAccess([...formFolderAccess, rootFolder.id]);
                                      } else {
                                        setFormFolderAccess(formFolderAccess.filter(id => id !== rootFolder.id));
                                      }
                                    }}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                  </svg>
                                  <span className="text-sm font-medium text-gray-700">{rootFolder.name}</span>
                                  {children.length > 0 && (
                                    <span className="text-xs text-gray-400 ml-auto">{children.length} subfolder(s)</span>
                                  )}
                                </div>
                                {isExpanded && children.length > 0 && (
                                  <div className="pl-8 pr-2 pb-2 space-y-1 border-t bg-gray-50">
                                    {children.map(child => (
                                      <label key={child.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={formFolderAccess.includes(child.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setFormFolderAccess([...formFolderAccess, child.id]);
                                            } else {
                                              setFormFolderAccess(formFolderAccess.filter(id => id !== child.id));
                                            }
                                          }}
                                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                        </svg>
                                        <span className="text-sm text-gray-600">{child.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                    {formFolderAccess.length > 0 && (
                      <div className="mt-3 pt-3 border-t flex items-center justify-between">
                        <span className="text-xs text-indigo-600 font-medium">{formFolderAccess.length} folder(s) selected</span>
                        <button
                          type="button"
                          onClick={() => setFormFolderAccess([])}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Clear selection
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePermission}
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
