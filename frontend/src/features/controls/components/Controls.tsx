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

type CategoryType = 'general' | 'samples' | 'microbiology' | 'users';

type CompanyType = {
  id: number;
  name: string;
  is_active: boolean;
};

// Tab categories for better organization
const tabCategories: { key: CategoryType; label: string; color: string }[] = [
  { key: 'general', label: 'General', color: 'blue' },
  { key: 'samples', label: 'Sample Data', color: 'green' },
  { key: 'microbiology', label: 'Microbiology', color: 'purple' },
  { key: 'users', label: 'User Management', color: 'orange' },
];

const Controls = () => {
  const { canRead, isLoading: permissionsLoading } = usePermissions();
  const hasReadAccess = canRead('Controls');

  // Check permission - redirect if no access
  if (!permissionsLoading && !hasReadAccess) {
    return <Navigate to="/" replace />;
  }

  const [activeCategory, setActiveCategory] = useState<CategoryType>('general');
  const [activeTab, setActiveTab] = useState<TabType>('company');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPIN, setNewItemPIN] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [selectedCompanyForFarm, setSelectedCompanyForFarm] = useState<number | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  
  // AST Disk specific fields
  const [astRValue, setAstRValue] = useState('');
  const [astIValue, setAstIValue] = useState('');
  const [astSValue, setAstSValue] = useState('');
  
  // Edit mode state
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editRValue, setEditRValue] = useState('');
  const [editIValue, setEditIValue] = useState('');
  const [editSValue, setEditSValue] = useState('');
  const [editSignatureImage, setEditSignatureImage] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
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

  const tabs: { key: TabType; label: string; isDepartmentSpecific: boolean; isCompanySpecific?: boolean; endpoint: string; category: CategoryType }[] = [
    // General
    { key: 'company', label: 'Companies', isDepartmentSpecific: false, endpoint: '/controls/companies', category: 'general' },
    { key: 'farm', label: 'Farms', isDepartmentSpecific: false, isCompanySpecific: true, endpoint: '/controls/farms', category: 'general' },
    { key: 'flock', label: 'Flocks', isDepartmentSpecific: false, endpoint: '/controls/flocks', category: 'general' },
    { key: 'cycle', label: 'Cycles', isDepartmentSpecific: false, endpoint: '/controls/cycles', category: 'general' },
    { key: 'status', label: 'Status', isDepartmentSpecific: false, endpoint: '/controls/statuses', category: 'general' },
    { key: 'house', label: 'Houses', isDepartmentSpecific: false, endpoint: '/controls/houses', category: 'general' },
    { key: 'source', label: 'Sources', isDepartmentSpecific: false, endpoint: '/controls/sources', category: 'general' },
    { key: 'technician', label: 'Technicians', isDepartmentSpecific: false, endpoint: '/controls/technicians', category: 'general' },
    { key: 'extraction_method', label: 'Extraction Methods', isDepartmentSpecific: false, endpoint: '/controls/extraction-methods', category: 'general' },
    { key: 'signature', label: 'Signatures', isDepartmentSpecific: false, endpoint: '/controls/signatures', category: 'general' },
    // Samples
    { key: 'sample_type', label: 'Sample Types', isDepartmentSpecific: true, endpoint: '/controls/sample-types', category: 'samples' },
    { key: 'disease', label: 'Diseases', isDepartmentSpecific: true, endpoint: '/controls/diseases', category: 'samples' },
    { key: 'kit_type', label: 'Kit Types', isDepartmentSpecific: true, endpoint: '/controls/kit-types', category: 'samples' },
    // Microbiology
    { key: 'culture_isolation_types', label: 'Culture Isolation Types', isDepartmentSpecific: false, endpoint: '/controls/culture-isolation-types', category: 'microbiology' },
    { key: 'pathogenic_fungi_mold', label: 'Pathogenic Fungi & Mold', isDepartmentSpecific: false, endpoint: '/controls/pathogenic-fungi-mold', category: 'microbiology' },
    { key: 'culture_screened_pathogens', label: 'Culture Screened Pathogens', isDepartmentSpecific: false, endpoint: '/controls/culture-screened-pathogens', category: 'microbiology' },
    { key: 'ast_disks', label: 'AST Disks (Enterobacteriaceae)', isDepartmentSpecific: false, endpoint: '/controls/ast-disks', category: 'microbiology' },
    { key: 'ast_disks_fastidious', label: 'AST Disks (Fastidious)', isDepartmentSpecific: false, endpoint: '/controls/ast-disks-fastidious', category: 'microbiology' },
    { key: 'ast_disks_staphylococcus', label: 'AST Disks (Staphylococcus)', isDepartmentSpecific: false, endpoint: '/controls/ast-disks-staphylococcus', category: 'microbiology' },
    { key: 'ast_disks_enterococcus', label: 'AST Disks (Enterococcus)', isDepartmentSpecific: false, endpoint: '/controls/ast-disks-enterococcus', category: 'microbiology' },
    // Users
    { key: 'users', label: 'Users', isDepartmentSpecific: false, endpoint: '/users', category: 'users' },
  ];

  // Filter tabs by category
  const filteredTabs = tabs.filter(tab => tab.category === activeCategory);

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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiClient.put(`${currentTab.endpoint}/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls', activeTab] });
      setEditingItem(null);
      setEditName('');
      setEditRValue('');
      setEditIValue('');
      setEditSValue('');
    },
    onError: (error: any) => {
      alert(`Error updating item: ${error.response?.data?.detail || error.message}`);
    },
  });

  const handleEdit = (item: any) => {
    setEditingItem(item.id);
    setEditName(item.name);
    if (activeTab === 'ast_disks' || activeTab === 'ast_disks_fastidious' || activeTab === 'ast_disks_staphylococcus' || activeTab === 'ast_disks_enterococcus') {
      setEditRValue(item.r_value || '');
      setEditIValue(item.i_value || '');
      setEditSValue(item.s_value || '');
    }
    if (activeTab === 'signature') {
      setEditSignatureImage(item.signature_image || null);
    }
  };

  const handleSaveEdit = (id: number) => {
    if (!editName.trim()) return;
    
    let data: any = { name: editName };
    
    if (activeTab === 'ast_disks' || activeTab === 'ast_disks_fastidious' || activeTab === 'ast_disks_staphylococcus' || activeTab === 'ast_disks_enterococcus') {
      data.r_value = editRValue || null;
      data.i_value = editIValue || null;
      data.s_value = editSValue || null;
    }
    
    if (activeTab === 'signature' && editSignatureImage) {
      data.signature_image = editSignatureImage;
    }
    
    updateMutation.mutate({ id, data });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditName('');
    setEditRValue('');
    setEditIValue('');
    setEditSValue('');
    setEditSignatureImage(null);
  };

  // Handle edit signature image upload
  const handleEditSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setEditSignatureImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const clearEditSignature = () => {
    setEditSignatureImage(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

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

  // Get category color classes
  const getCategoryColors = (category: CategoryType, isActive: boolean) => {
    const colors = {
      general: isActive 
        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
        : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-400 hover:shadow-md',
      samples: isActive 
        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30' 
        : 'bg-white text-green-600 border-2 border-green-200 hover:border-green-400 hover:shadow-md',
      microbiology: isActive 
        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30' 
        : 'bg-white text-purple-600 border-2 border-purple-200 hover:border-purple-400 hover:shadow-md',
      users: isActive 
        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30' 
        : 'bg-white text-orange-600 border-2 border-orange-200 hover:border-orange-400 hover:shadow-md',
    };
    return colors[category];
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
          Data Controls
        </h1>
        <p className="text-gray-500 text-lg">Manage dropdown options for all fields across the system</p>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {tabCategories.map((category) => (
          <button
            key={category.key}
            onClick={() => {
              setActiveCategory(category.key);
              // Set first tab of category as active
              const firstTab = tabs.find(t => t.category === category.key);
              if (firstTab) {
                setActiveTab(firstTab.key);
                setNewItemName('');
                setIsAddFormOpen(false);
              }
            }}
            className={`p-5 rounded-xl transition-all duration-300 transform hover:scale-105 ${getCategoryColors(category.key, activeCategory === category.key)}`}
          >
            <div className="font-bold text-lg">{category.label}</div>
            <div className="text-sm opacity-80">
              {tabs.filter(t => t.category === category.key).length} items
            </div>
          </button>
        ))}
      </div>

      {/* Sub-tabs for selected category */}
      {activeCategory !== 'users' && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2">
            {filteredTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setNewItemName('');
                  setIsAddFormOpen(false);
                }}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-gray-800 to-gray-700 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:shadow'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === 'users' || activeCategory === 'users' ? (
        <div className="animate-fadeIn">
          <UserManagement />
        </div>
      ) : (
        <div className="animate-fadeIn">
          {/* Department Filter (for department-specific tabs) */}
          {currentTab.isDepartmentSpecific && (
            <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Filter by Department
              </label>
              <select
                value={selectedDepartment ?? ''}
                onChange={(e) => setSelectedDepartment(Number(e.target.value))}
                className="w-full md:w-64 px-4 py-3 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
              >
                {filteredDepartments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {activeTab === 'kit_type' && (
                <p className="text-xs text-blue-600 mt-3 font-medium">
                  ℹ️ Kit Types are only available for PCR and Serology departments
                </p>
              )}
            </div>
          )}

          {/* Company Sub-tabs (for farm tab) */}
          {activeTab === 'farm' && companies.length > 0 && (
            <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select Company
              </label>
              <div className="flex flex-wrap gap-2">
                {companies.filter(c => c.is_active).map(company => (
                  <button
                    key={company.id}
                    onClick={() => setSelectedCompanyForFarm(company.id)}
                    className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                      selectedCompanyForFarm === company.id
                        ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md transform scale-105'
                        : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-green-400 hover:shadow'
                    }`}
                  >
                    {company.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-green-600 mt-3 font-medium">
                Farms are organized by company. Select a company to view/add its farms.
              </p>
            </div>
          )}

          {/* Add New Item Form - Collapsible Card */}
          <div className="mb-6">
            <button
              onClick={() => setIsAddFormOpen(!isAddFormOpen)}
              className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white text-xl font-bold">
                  +
                </div>
                <span className="font-semibold text-gray-800">Add New {currentTab.label.slice(0, -1)}</span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isAddFormOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Expandable Form */}
            <div className={`overflow-hidden transition-all duration-300 ${isAddFormOpen ? 'max-h-[800px] mt-4' : 'max-h-0'}`}>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !activeTab.includes('signature') && handleAdd()}
                      placeholder={`Enter ${currentTab.label.toLowerCase().slice(0, -1)} name...`}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    {activeTab !== 'signature' && !activeTab.includes('ast_disks') && (
                      <button
                        onClick={handleAdd}
                        disabled={!newItemName.trim() || createMutation.isPending}
                        className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-semibold shadow-md hover:shadow-lg"
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
                      <p className="text-xs text-green-600 mt-1">Signature image uploaded</p>
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
            </div>
          </div>

          {/* Items List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">
                  {currentTab.label} List
                </h2>
                <span className="px-3 py-1 bg-white rounded-full text-sm font-semibold text-gray-600 shadow-sm">
                  {items.length} items
                </span>
              </div>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div className="text-center py-16">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                  <p className="mt-4 text-gray-500 font-medium">Loading {currentTab.label.toLowerCase()}...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-gray-600 font-semibold text-lg">No {currentTab.label.toLowerCase()} found</p>
                  <p className="text-sm text-gray-400 mt-1">Click the "Add New" button above to create one</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {editingItem === item.id ? (
                        /* Edit Mode */
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm flex-1 max-w-xs"
                            autoFocus
                          />
                          {(activeTab === 'ast_disks' || activeTab === 'ast_disks_fastidious' || activeTab === 'ast_disks_staphylococcus' || activeTab === 'ast_disks_enterococcus') && (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editRValue}
                                onChange={(e) => setEditRValue(e.target.value)}
                                placeholder="R"
                                className="w-16 px-2 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm text-center"
                              />
                              <input
                                type="text"
                                value={editIValue}
                                onChange={(e) => setEditIValue(e.target.value)}
                                placeholder="I"
                                className="w-16 px-2 py-2 border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm text-center"
                              />
                              <input
                                type="text"
                                value={editSValue}
                                onChange={(e) => setEditSValue(e.target.value)}
                                placeholder="S"
                                className="w-16 px-2 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-center"
                              />
                            </div>
                          )}
                          {activeTab === 'signature' && (
                            <div className="flex items-center gap-3">
                              {editSignatureImage ? (
                                <div className="relative">
                                  <img 
                                    src={editSignatureImage} 
                                    alt="Signature Preview" 
                                    className="h-12 w-auto border border-gray-300 rounded bg-white p-1"
                                  />
                                  <button
                                    type="button"
                                    onClick={clearEditSignature}
                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                                  >
                                    X
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => editFileInputRef.current?.click()}
                                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors border border-blue-200"
                                >
                                  Change Image
                                </button>
                              )}
                              <input
                                ref={editFileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleEditSignatureUpload}
                                className="hidden"
                              />
                            </div>
                          )}
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={updateMutation.isPending}
                            className="px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        /* View Mode */
                        <>
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
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deleteMutation.isPending}
                              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200 disabled:opacity-50"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Controls;
