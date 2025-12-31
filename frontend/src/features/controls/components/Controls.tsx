import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';
import { usePermissions } from '../../../hooks/usePermissions';
import UserManagement from './UserManagement';

type Department = {
  id: number;
  name: string;
  code: string;
};

type TabType = 'company' | 'farm' | 'flock' | 'cycle' | 'status' | 'house' | 'source' | 'sample_type' | 'disease' | 'kit_type' | 'technician' | 'extraction_method' | 'signature' | 'users' | 'culture_isolation_types' | 'pathogenic_fungi_mold' | 'culture_screened_pathogens' | 'ast_disks' | 'ast_disks_fastidious' | 'ast_disks_staphylococcus' | 'ast_disks_enterococcus';

type CompanyType = {
  id: number;
  name: string;
  is_active: boolean;
};

const Controls = () => {
  const { canRead, isLoading: permissionsLoading } = usePermissions();
  const hasReadAccess = canRead('Controls');

  // Check permission - redirect if no access
  if (!permissionsLoading && !hasReadAccess) {
    return <Navigate to="/" replace />;
  }

  const [activeTab, setActiveTab] = useState<TabType>('company');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPIN, setNewItemPIN] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [selectedCompanyForFarm, setSelectedCompanyForFarm] = useState<number | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // AST Disk specific fields
  const [astRValue, setAstRValue] = useState('');
  const [astIValue, setAstIValue] = useState('');
  const [astSValue, setAstSValue] = useState('');
  
  const queryClient = useQueryClient();

  // Handle signature image upload
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSignatureImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const clearSignature = () => {
    setSignatureImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await apiClient.get('/departments/');
      return response.data;
    },
  });

  // Fetch companies for farm sub-tabs
  const { data: companies = [] } = useQuery<CompanyType[]>({
    queryKey: ['controls', 'company'],
    queryFn: async () => {
      const response = await apiClient.get('/controls/companies');
      return response.data;
    },
  });

  // Set default selected company for farms when companies are loaded
  useEffect(() => {
    if (companies.length > 0 && selectedCompanyForFarm === null) {
      setSelectedCompanyForFarm(companies[0].id);
    }
  }, [companies, selectedCompanyForFarm]);

  const tabs: { key: TabType; label: string; isDepartmentSpecific: boolean; isCompanySpecific?: boolean; endpoint: string }[] = [
    { key: 'company', label: 'Companies', isDepartmentSpecific: false, endpoint: '/controls/companies' },
    { key: 'farm', label: 'Farms', isDepartmentSpecific: false, isCompanySpecific: true, endpoint: '/controls/farms' },
    { key: 'flock', label: 'Flocks', isDepartmentSpecific: false, endpoint: '/controls/flocks' },
    { key: 'cycle', label: 'Cycles', isDepartmentSpecific: false, endpoint: '/controls/cycles' },
    { key: 'status', label: 'Status', isDepartmentSpecific: false, endpoint: '/controls/statuses' },
    { key: 'house', label: 'Houses', isDepartmentSpecific: false, endpoint: '/controls/houses' },
    { key: 'source', label: 'Sources', isDepartmentSpecific: false, endpoint: '/controls/sources' },
    { key: 'technician', label: 'Technicians', isDepartmentSpecific: false, endpoint: '/controls/technicians' },
    { key: 'extraction_method', label: 'Extraction Methods', isDepartmentSpecific: false, endpoint: '/controls/extraction-methods' },
    { key: 'signature', label: 'Signatures', isDepartmentSpecific: false, endpoint: '/controls/signatures' },
    { key: 'users', label: 'Users', isDepartmentSpecific: false, endpoint: '/users' },
    { key: 'sample_type', label: 'Sample Types', isDepartmentSpecific: true, endpoint: '/controls/sample-types' },
    { key: 'disease', label: 'Diseases', isDepartmentSpecific: true, endpoint: '/controls/diseases' },
    { key: 'kit_type', label: 'Kit Types', isDepartmentSpecific: true, endpoint: '/controls/kit-types' },
    { key: 'culture_isolation_types', label: 'Culture Isolation Types', isDepartmentSpecific: false, endpoint: '/controls/culture-isolation-types' },
    { key: 'pathogenic_fungi_mold', label: 'Pathogenic Fungi & Mold', isDepartmentSpecific: false, endpoint: '/controls/pathogenic-fungi-mold' },
    { key: 'culture_screened_pathogens', label: 'Culture Screened Pathogens', isDepartmentSpecific: false, endpoint: '/controls/culture-screened-pathogens' },
    { key: 'ast_disks', label: 'AST Disks (Enterobacteriaceae)', isDepartmentSpecific: false, endpoint: '/controls/ast-disks' },
    { key: 'ast_disks_fastidious', label: 'AST Disks (Fastidious M.o.)', isDepartmentSpecific: false, endpoint: '/controls/ast-disks-fastidious' },
    { key: 'ast_disks_staphylococcus', label: 'AST Disks (Staphylococcus)', isDepartmentSpecific: false, endpoint: '/controls/ast-disks-staphylococcus' },
    { key: 'ast_disks_enterococcus', label: 'AST Disks (Enterococcus)', isDepartmentSpecific: false, endpoint: '/controls/ast-disks-enterococcus' },
  ];

  const currentTab = tabs.find(tab => tab.key === activeTab)!;

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ['controls', activeTab, currentTab.isDepartmentSpecific ? selectedDepartment : null, currentTab.isCompanySpecific ? selectedCompanyForFarm : null],
    queryFn: async () => {
      let params: any = {};
      if (currentTab.isDepartmentSpecific) {
        params.department_id = selectedDepartment;
      }
      if (currentTab.isCompanySpecific && selectedCompanyForFarm !== null) {
        params.company_id = selectedCompanyForFarm;
      }
      const response = await apiClient.get(currentTab.endpoint, { params });
      return response.data;
    },
    enabled: (!currentTab.isDepartmentSpecific || selectedDepartment !== null) && (!currentTab.isCompanySpecific || selectedCompanyForFarm !== null),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating item with data:', { ...data, signature_image: data.signature_image ? `[Base64 image - ${data.signature_image.length} chars]` : null });
      const response = await apiClient.post(currentTab.endpoint, data);
      console.log('Create response:', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Mutation success:', data);
      queryClient.invalidateQueries({ queryKey: ['controls', activeTab] });
      setNewItemName('');
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      console.error('Error response:', error.response?.data);
      alert(`Error creating item: ${error.response?.data?.detail || error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`${currentTab.endpoint}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls', activeTab] });
    },
  });

  const handleAdd = () => {
    if (!newItemName.trim()) return;
    if (currentTab.isDepartmentSpecific && selectedDepartment === null) return;
    
    // For signatures, also require PIN and signature image
    if (activeTab === 'signature') {
      if (!newItemPIN.trim()) {
        alert('Please enter a PIN (6-8 digits)');
        return;
      }
      if (!/^\d{6,8}$/.test(newItemPIN)) {
        alert('PIN must be 6-8 digits');
        return;
      }
      if (!signatureImage) {
        alert('Please draw your handwritten signature');
        return;
      }
      const data = { name: newItemName, pin: newItemPIN, signature_image: signatureImage };
      createMutation.mutate(data);
      setNewItemPIN('');
      clearSignature();
      return;
    }
    
    // For AST Disks (all bacteria families), include R, I, S values
    if (activeTab === 'ast_disks' || activeTab === 'ast_disks_fastidious' || activeTab === 'ast_disks_staphylococcus' || activeTab === 'ast_disks_enterococcus') {
      const data = { 
        name: newItemName, 
        r_value: astRValue || null,
        i_value: astIValue || null,
        s_value: astSValue || null
      };
      createMutation.mutate(data);
      setAstRValue('');
      setAstIValue('');
      setAstSValue('');
      return;
    }
    
    let data: any = { name: newItemName };
    
    if (currentTab.isDepartmentSpecific) {
      data.department_id = selectedDepartment;
    }
    
    if (currentTab.isCompanySpecific && selectedCompanyForFarm !== null) {
      data.company_id = selectedCompanyForFarm;
    }
    
    createMutation.mutate(data);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredDepartments = activeTab === 'kit_type' 
    ? departments.filter(d => d.code === 'PCR' || d.code === 'SER')
    : departments;

  useEffect(() => {
    if (selectedDepartment === null && filteredDepartments.length > 0) {
      setSelectedDepartment(filteredDepartments[0].id);
    }

    if (selectedDepartment !== null && currentTab.isDepartmentSpecific) {
      const isDepartmentValid = filteredDepartments.some(d => d.id === selectedDepartment);
      if (!isDepartmentValid && filteredDepartments.length > 0) {
        setSelectedDepartment(filteredDepartments[0].id);
      }
    }
  }, [selectedDepartment, filteredDepartments, currentTab.isDepartmentSpecific]);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Controls</h1>
        <p className="text-gray-600">Manage dropdown options for all fields across the system</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setNewItemName('');
              }}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' ? (
        <UserManagement />
      ) : (
        <>
          {/* Department Filter (for department-specific tabs) */}
          {currentTab.isDepartmentSpecific && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Department:
              </label>
              <select
                value={selectedDepartment ?? ''}
                onChange={(e) => setSelectedDepartment(Number(e.target.value))}
                className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {filteredDepartments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {activeTab === 'kit_type' && (
                <p className="text-xs text-gray-600 mt-2">
                  * Kit Types are only available for PCR and Serology departments
                </p>
              )}
            </div>
          )}

          {/* Company Sub-tabs (for farm tab) */}
          {activeTab === 'farm' && companies.length > 0 && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Company:
              </label>
              <div className="flex flex-wrap gap-2">
                {companies.filter(c => c.is_active).map(company => (
                  <button
                    key={company.id}
                    onClick={() => setSelectedCompanyForFarm(company.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      selectedCompanyForFarm === company.id
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {company.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                * Farms are organized by company. Select a company to view/add its farms.
              </p>
            </div>
          )}

          {/* Add New Item Form */}
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Add New {currentTab.label.slice(0, -1)}
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !activeTab.includes('signature') && handleAdd()}
                  placeholder={`Enter ${currentTab.label.toLowerCase().slice(0, -1)} name...`}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {activeTab !== 'signature' && (
                  <button
                    onClick={handleAdd}
                    disabled={!newItemName.trim() || createMutation.isPending}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {createMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                )}
              </div>
              
              {/* PIN field and Signature Canvas for signature tab */}
              {activeTab === 'signature' && (
                <>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      value={newItemPIN}
                      onChange={(e) => setNewItemPIN(e.target.value)}
                      placeholder="Enter PIN (6-8 digits)"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={8}
                    />
                  </div>
                  
                  {/* Signature Image Upload */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signature Image <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                      {signatureImage ? (
                        <div className="flex flex-col items-center">
                          <img 
                            src={signatureImage} 
                            alt="Signature Preview" 
                            className="max-w-full max-h-32 border border-gray-300 rounded bg-white p-2"
                          />
                          <div className="flex gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            >
                              Change Image
                            </button>
                            <button
                              type="button"
                              onClick={clearSignature}
                              className="px-3 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-gray-100 rounded transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm text-gray-600 font-medium">Click to upload signature image</span>
                          <span className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB</span>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload}
                        className="hidden"
                      />
                    </div>
                    {signatureImage && (
                      <p className="text-xs text-green-600 mt-1">✓ Signature image uploaded</p>
                    )}
                  </div>

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleAdd}
                      disabled={!newItemName.trim() || !newItemPIN.trim() || !signatureImage || createMutation.isPending}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {createMutation.isPending ? 'Adding...' : 'Add Signature'}
                    </button>
                  </div>
                </>
              )}
              
              {/* AST Disk specific fields - for all bacteria families */}
              {(activeTab === 'ast_disks' || activeTab === 'ast_disks_fastidious' || activeTab === 'ast_disks_staphylococcus' || activeTab === 'ast_disks_enterococcus') && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800 mb-3">
                    {activeTab === 'ast_disks' ? 'Enterobacteriaceae' : 
                     activeTab === 'ast_disks_fastidious' ? 'Fastidious M.o.' :
                     activeTab === 'ast_disks_staphylococcus' ? 'Staphylococcus' : 'Enterococcus'} Breakpoints (CLSI M100)
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-red-600 mb-1">R (Resistant) ≤</label>
                      <input
                        type="text"
                        value={astRValue}
                        onChange={(e) => setAstRValue(e.target.value)}
                        placeholder="e.g., 13"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-yellow-600 mb-1">I (Intermediate)</label>
                      <input
                        type="text"
                        value={astIValue}
                        onChange={(e) => setAstIValue(e.target.value)}
                        placeholder="e.g., 14-17"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-green-600 mb-1">S (Sensitive) ≥</label>
                      <input
                        type="text"
                        value={astSValue}
                        onChange={(e) => setAstSValue(e.target.value)}
                        placeholder="e.g., 18"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentTab.label} List ({items.length})
              </h2>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="mt-2 text-gray-600">No {currentTab.label.toLowerCase()} found</p>
                  <p className="text-sm text-gray-500">Add one using the form above</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-gray-900 font-medium">{item.name}</span>
                        {!item.is_active && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                            Inactive
                          </span>
                        )}
                        {/* AST Disk specific columns - for all bacteria families */}
                        {(activeTab === 'ast_disks' || activeTab === 'ast_disks_fastidious' || activeTab === 'ast_disks_staphylococcus' || activeTab === 'ast_disks_enterococcus') && (
                          <div className="flex gap-4 ml-auto mr-4">
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
                              R: {item.r_value || '-'}
                            </span>
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium">
                              I: {item.i_value || '-'}
                            </span>
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                              S: {item.s_value || '-'}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Controls;
