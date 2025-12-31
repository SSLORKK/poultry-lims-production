import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../../hooks/usePermissions';
import * as XLSX from 'xlsx-js-style';

interface Sample {
  id: number;
  sample_code: string;
  date_received: string;
  company: string;
  farm: string;
  flock: string;
  cycle: string;
  status: string;
  units: Unit[];
}

interface Unit {
  id: number;
  unit_code: string;
  department_id: number;
  house: string[];
  age: string | null;  // Changed from number to string
  source: string | string[];
  sample_type: string[];
  samples_number: number | null;
  notes: string;
  coa_status: string | null;
  pcr_data?: {
    diseases_list: Array<{ disease: string; kit_type: string }>;
    technician_name: string;
    extraction_method: string;
  };
  serology_data?: {
    diseases_list: Array<{ 
      disease: string; 
      kit_type: string; 
      mean?: number | null;
      cv?: number | null;
      min?: number | null;
      max?: number | null;
      coa_file_id?: number | null;
    }>;
    kit_type: string;
    number_of_wells: number;
  };
  microbiology_data?: {
    diseases_list: string[];
    batch_no: string;
    fumigation: string;
    index_list: string[];
  };
}

interface COAData {
  id?: number;
  unit_id: number;
  test_results: { [disease: string]: { [sampleType: string]: string } };
  date_tested: string | null;
}

type Department = 'PCR' | 'Serology' | 'Microbiology';

const DEPARTMENT_IDS: Record<Department, number> = {
  PCR: 1,
  Serology: 2,
  Microbiology: 3,
};

export default function Database() {
  const { canRead, isLoading: permissionsLoading } = usePermissions();
  const location = useLocation();
  
  // Get navigation state for restoring tab and scroll position
  const navigationState = location.state as { tab?: string; scrollToUnit?: string } | null;

  // Determine which departments the user has permission to view
  const allowedDepartments = useMemo(() => {
    const departments: Department[] = [];
    if (canRead('Database - PCR')) departments.push('PCR');
    if (canRead('Database - Serology')) departments.push('Serology');
    if (canRead('Database - Microbiology')) departments.push('Microbiology');
    return departments;
  }, [canRead]);

  // Check permission - redirect if no access to any database
  if (!permissionsLoading && allowedDepartments.length === 0) {
    return <Navigate to="/" replace />;
  }

  // Set initial active tab - use navigation state if available, otherwise first allowed department
  const getInitialTab = (): Department => {
    if (navigationState?.tab && allowedDepartments.includes(navigationState.tab as Department)) {
      return navigationState.tab as Department;
    }
    return allowedDepartments[0] || 'PCR';
  };
  const [activeTab, setActiveTab] = useState<Department>(getInitialTab());

  // Load persisted filters from localStorage
  const loadPersistedFilters = () => {
    try {
      const saved = localStorage.getItem('database_filters');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };
  const persistedFilters = loadPersistedFilters();

  const [resultsFilter, setResultsFilter] = useState<string>(persistedFilters?.resultsFilter || 'All');
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>(persistedFilters?.diseases || []);
  const [selectedAges, setSelectedAges] = useState<string[]>(persistedFilters?.ages || []);
  const [dateFrom, setDateFrom] = useState<string>(persistedFilters?.dateFrom || '');
  const [dateTo, setDateTo] = useState<string>(persistedFilters?.dateTo || '');

  // New UI state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(persistedFilters?.companies || []);
  const [selectedFarms, setSelectedFarms] = useState<string[]>(persistedFilters?.farms || []);
  const [selectedFlocks, setSelectedFlocks] = useState<string[]>(persistedFilters?.flocks || []);
  const [selectedSampleTypes, setSelectedSampleTypes] = useState<string[]>(persistedFilters?.sampleTypes || []);
  const [selectedKitTypes, setSelectedKitTypes] = useState<string[]>(persistedFilters?.kitTypes || []);
  const [selectedCycles, setSelectedCycles] = useState<string[]>(persistedFilters?.cycles || []);
  const [selectedSources, setSelectedSources] = useState<string[]>(persistedFilters?.sources || []);
  const [selectedSerologyDiseases, setSelectedSerologyDiseases] = useState<string[]>(persistedFilters?.serologyDiseases || []);
  const [selectedSerologyKitTypes, setSelectedSerologyKitTypes] = useState<string[]>(persistedFilters?.serologyKitTypes || []);
  const [selectedMicrobiologyDiseases, setSelectedMicrobiologyDiseases] = useState<string[]>(persistedFilters?.microbiologyDiseases || []);
  const [selectedMicrobiologyResults, setSelectedMicrobiologyResults] = useState<string[]>(persistedFilters?.microbiologyResults || []);
  const [selectedPCRDiseases, setSelectedPCRDiseases] = useState<string[]>(persistedFilters?.pcrDiseases || []);
  const [selectedPCRResults, setSelectedPCRResults] = useState<string[]>(persistedFilters?.pcrResults || []);

  // Persist filters to localStorage when they change
  useEffect(() => {
    const filters = {
      resultsFilter,
      diseases: selectedDiseases,
      ages: selectedAges,
      dateFrom,
      dateTo,
      companies: selectedCompanies,
      farms: selectedFarms,
      flocks: selectedFlocks,
      sampleTypes: selectedSampleTypes,
      kitTypes: selectedKitTypes,
      cycles: selectedCycles,
      sources: selectedSources,
      serologyDiseases: selectedSerologyDiseases,
      serologyKitTypes: selectedSerologyKitTypes,
      microbiologyDiseases: selectedMicrobiologyDiseases,
      microbiologyResults: selectedMicrobiologyResults,
      pcrDiseases: selectedPCRDiseases,
      pcrResults: selectedPCRResults
    };
    localStorage.setItem('database_filters', JSON.stringify(filters));
  }, [resultsFilter, selectedDiseases, selectedAges, dateFrom, dateTo, selectedCompanies, selectedFarms, selectedFlocks, selectedSampleTypes, selectedKitTypes, selectedCycles, selectedSources, selectedSerologyDiseases, selectedSerologyKitTypes, selectedMicrobiologyDiseases, selectedMicrobiologyResults, selectedPCRDiseases, selectedPCRResults]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100); // Fixed page size for display pagination
  const [maxDisplayLimit] = useState(1000); // Show last 1000 samples by default
  const [initialLoading, setInitialLoading] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    house: true,
    age: true,
    source: true,
    sampleType: true,
    flock: true,
    cycle: true
  });
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const columnsDropdownRef = useRef<HTMLDivElement>(null);

  // Update active tab if permissions change and current tab is not allowed
  useEffect(() => {
    if (allowedDepartments.length > 0 && !allowedDepartments.includes(activeTab)) {
      setActiveTab(allowedDepartments[0]);
    }
  }, [allowedDepartments, activeTab]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(event.target as Node)) {
        setColumnsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all available filter options (unfiltered, only by department)
  const { data: filterOptions } = useQuery<{
    companies: string[];
    farms: string[];
    flocks: string[];
    ages: string[];
    sample_types: string[];
  }>({
    queryKey: ['filter-options', activeTab],
    queryFn: async () => {
      const params: any = { department_id: DEPARTMENT_IDS[activeTab] };
      console.log('Fetching filter options for department:', activeTab, 'ID:', DEPARTMENT_IDS[activeTab]);
      const response = await apiClient.get('/samples/filter-options', { params });
      console.log('Filter options received:', response.data);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch filtered data for display
  // No filters = limit 1000 | Any filter = get ALL matching records (paginated)
  const { data: samples = [] } = useQuery<Sample[]>({
    queryKey: ['samples', activeTab, selectedCompanies, selectedFarms, selectedFlocks, selectedAges, selectedSampleTypes, dateFrom, dateTo, page],
    queryFn: async () => {
      // Check if any filters are applied
      const hasFilters = selectedCompanies.length > 0 || selectedFarms.length > 0 || 
                         selectedFlocks.length > 0 || selectedAges.length > 0 || 
                         selectedSampleTypes.length > 0 || dateFrom || dateTo;
      
      // Prepare filter parameters
      const params: any = {
        limit: hasFilters ? pageSize : maxDisplayLimit, // 1000 for no filters, pageSize for filtered
        skip: hasFilters ? (page - 1) * pageSize : 0
      };

      // Add department filter (always applied)
      params.department_id = DEPARTMENT_IDS[activeTab];

      // Add other filters if they exist
      if (selectedCompanies.length > 0) {
        params.company = selectedCompanies;
      }
      if (selectedFarms.length > 0) {
        params.farm = selectedFarms;
      }
      if (selectedFlocks.length > 0) {
        params.flock = selectedFlocks;
      }
      if (selectedAges.length > 0) {
        params.age = selectedAges;
      }
      if (selectedSampleTypes.length > 0) {
        params.sample_type = selectedSampleTypes;
      }
      if (dateFrom) {
        params.date_from = dateFrom;
      }
      if (dateTo) {
        params.date_to = dateTo;
      }

      console.log('API Request Params:', params); // Debug log
      const response = await apiClient.get('/samples/', { params });
      console.log('API Response:', response.data.length, 'samples'); // Debug log

      // After first load, set initialLoading to false
      setInitialLoading(false);

      return response.data;
    },
    refetchOnMount: true, // Always refetch when component mounts
    staleTime: 0, // Consider data immediately stale
  });

  // Filter units without age filter (for computing available ages)
  const unitsBeforeAgeFilter = useMemo(() => {
    const units: Array<Unit & { sample: Sample }> = [];

    samples.forEach((sample) => {
      sample.units.forEach((unit) => {
        units.push({ ...unit, sample });
      });
    });

    return units;
  }, [samples]);

  const filteredUnits = useMemo(() => {
    let units = unitsBeforeAgeFilter;

    // Apply Serology-specific filters
    if (activeTab === 'Serology') {
      // Filter by cycle
      if (selectedCycles.length > 0) {
        units = units.filter(unit => selectedCycles.includes(unit.sample.cycle));
      }
      // Filter by source
      if (selectedSources.length > 0) {
        units = units.filter(unit => {
          if (!unit.source) return false;
          const sources = Array.isArray(unit.source) ? unit.source : [unit.source];
          return sources.some(s => selectedSources.includes(s));
        });
      }
      // Filter by Serology diseases
      if (selectedSerologyDiseases.length > 0) {
        units = units.filter(unit => {
          const unitDiseases = unit.serology_data?.diseases_list?.map(d => d.disease) || [];
          return selectedSerologyDiseases.some(d => unitDiseases.includes(d));
        });
      }
      // Filter by Serology kit types
      if (selectedSerologyKitTypes.length > 0) {
        units = units.filter(unit => {
          const unitKitTypes = unit.serology_data?.diseases_list?.map(d => d.kit_type) || [];
          return selectedSerologyKitTypes.some(kt => unitKitTypes.includes(kt));
        });
      }
    }

    // Apply Microbiology-specific filters
    if (activeTab === 'Microbiology') {
      // Filter by Microbiology diseases
      if (selectedMicrobiologyDiseases.length > 0) {
        units = units.filter(unit => {
          const unitDiseases = unit.microbiology_data?.diseases_list || [];
          return selectedMicrobiologyDiseases.some(d => unitDiseases.includes(d));
        });
      }
      // Filter by Microbiology results - requires COA data check
      // Note: Result filtering for Microbiology would need COA data which is loaded separately
    }

    // Apply PCR-specific filters
    if (activeTab === 'PCR') {
      // Filter by PCR diseases
      if (selectedPCRDiseases.length > 0) {
        units = units.filter(unit => {
          const unitDiseases = unit.pcr_data?.diseases_list?.map(d => d.disease) || [];
          return selectedPCRDiseases.some(d => unitDiseases.includes(d));
        });
      }
      // Note: PCR result filtering (Positive/Negative) is handled in PCRTable component
      // because it requires COA data which is loaded asynchronously
    }

    // Sort by unit code descending (latest first - higher numbers first)
    return units.sort((a, b) => {
      const aNum = parseInt(a.unit_code.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.unit_code.replace(/\D/g, '')) || 0;
      return bNum - aNum;
    });
  }, [unitsBeforeAgeFilter, activeTab, selectedCycles, selectedSources, selectedSerologyDiseases, selectedSerologyKitTypes, selectedMicrobiologyDiseases, selectedPCRDiseases]);

  // Paginated units - now just the filtered units since backend handles pagination
  const paginatedUnits = filteredUnits;

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const allDiseases = useMemo(() => {
    if (activeTab !== 'PCR') return [];
    const diseaseSet = new Set<string>();
    filteredUnits.forEach((unit) => {
      unit.pcr_data?.diseases_list?.forEach((d) => diseaseSet.add(d.disease));
    });
    // Filter out all POS. CONTROL variants - it's for verification only, not a test result
    return Array.from(diseaseSet).filter(d => {
      const upper = d.toUpperCase();
      return upper !== 'POS. CONTROL' && upper !== 'POS CONTROL' && upper !== 'POS_CONTROL';
    }).sort();
  }, [filteredUnits, activeTab]);

  const pcrColumns = useMemo(() => {
    // If diseases are selected, show only those; otherwise show all
    return selectedDiseases.length > 0 ? selectedDiseases : allDiseases;
  }, [selectedDiseases, allDiseases]);

  // Get unique values for filter dropdowns from dedicated endpoint
  const uniqueCompanies = filterOptions?.companies || [];
  const uniqueFarms = filterOptions?.farms || [];
  const uniqueFlocks = filterOptions?.flocks || [];

  // Get available sample types from CURRENT filtered samples (dynamic based on other filters)
  const sampleTypes = useMemo(() => {
    const types = new Set<string>();
    samples.forEach((sample) => {
      sample.units.forEach((unit) => {
        if (unit.sample_type && Array.isArray(unit.sample_type)) {
          unit.sample_type.forEach((type: string) => {
            if (type) types.add(type);
          });
        }
      });
    });
    // Also include currently selected sample types even if not in filtered results
    selectedSampleTypes.forEach(type => types.add(type));
    return Array.from(types).sort();
  }, [samples, selectedSampleTypes]);

  // Get available ages from CURRENT filtered samples (dynamic based on other filters)
  const uniqueAges = useMemo(() => {
    const ages = new Set<string>();
    samples.forEach((sample) => {
      sample.units.forEach((unit) => {
        if (unit.age !== null && unit.age !== undefined && unit.age !== '') {
          ages.add(unit.age);
        }
      });
    });
    // Also include currently selected ages even if not in filtered results
    selectedAges.forEach(age => ages.add(age));
    return Array.from(ages).sort();
  }, [samples, selectedAges]);

  const renderCTCell = (value: string | undefined) => {
    if (!value || value === '') {
      return <td className="px-4 py-2 border border-gray-300 text-center text-gray-400">-</td>;
    }

    const upperValue = value.toUpperCase();
    const isNegative = upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE';
    const bgColor = isNegative ? 'bg-green-100' : 'bg-red-100';
    const textColor = isNegative ? 'text-green-800' : 'text-red-800';

    return (
      <td className={`px-4 py-2 border border-gray-300 text-center font-semibold ${bgColor} ${textColor}`}>
        {value}
      </td>
    );
  };

  // Helper to clear all filters
  const clearAllFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedCompanies([]);
    setSelectedFarms([]);
    setSelectedFlocks([]);
    setSelectedAges([]);
    setSelectedSampleTypes([]);
    setResultsFilter('All');
    setSelectedDiseases([]);
    setSelectedKitTypes([]);
    setSelectedCycles([]);
    setSelectedSources([]);
    setSelectedSerologyDiseases([]);
    setSelectedSerologyKitTypes([]);
    setSelectedMicrobiologyDiseases([]);
    setSelectedMicrobiologyResults([]);
    setSelectedPCRDiseases([]);
    setSelectedPCRResults([]);
  };

  // Get unique cycles, sources, diseases and kit types for Serology filters
  const uniqueCycles = useMemo(() => {
    const cycles = new Set<string>();
    samples.forEach(sample => {
      if (sample.cycle) cycles.add(sample.cycle);
    });
    return Array.from(cycles).sort();
  }, [samples]);

  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    filteredUnits.forEach(unit => {
      if (unit.source) {
        const unitSources = Array.isArray(unit.source) ? unit.source : [unit.source];
        unitSources.forEach(s => sources.add(s));
      }
    });
    return Array.from(sources).sort();
  }, [filteredUnits]);

  const uniqueSerologyDiseases = useMemo(() => {
    const diseases = new Set<string>();
    filteredUnits.forEach(unit => {
      unit.serology_data?.diseases_list?.forEach(d => {
        if (d.disease) diseases.add(d.disease);
      });
    });
    return Array.from(diseases).sort();
  }, [filteredUnits]);

  const uniqueSerologyKitTypes = useMemo(() => {
    const kitTypes = new Set<string>();
    filteredUnits.forEach(unit => {
      unit.serology_data?.diseases_list?.forEach(d => {
        if (d.kit_type) kitTypes.add(d.kit_type);
      });
    });
    return Array.from(kitTypes).sort();
  }, [filteredUnits]);

  // Get unique diseases for Microbiology filters
  const uniqueMicrobiologyDiseases = useMemo(() => {
    const diseases = new Set<string>();
    filteredUnits.forEach(unit => {
      unit.microbiology_data?.diseases_list?.forEach(d => {
        if (d) diseases.add(d);
      });
    });
    return Array.from(diseases).sort();
  }, [filteredUnits]);

  // Get unique diseases for PCR filters
  const uniquePCRDiseases = useMemo(() => {
    const diseases = new Set<string>();
    filteredUnits.forEach(unit => {
      unit.pcr_data?.diseases_list?.forEach(d => {
        if (d.disease) diseases.add(d.disease);
      });
    });
    return Array.from(diseases).sort();
  }, [filteredUnits]);

  // Result options for each department
  const microbiologyResultOptions = ['Detected', 'Not Detected', 'Within Limit', 'Over Limit'];
  const pcrResultOptions = ['Positive', 'Negative'];

  // Count active filters
  const activeFilterCount = [
    dateFrom || dateTo ? 1 : 0,
    selectedCompanies.length,
    selectedFarms.length,
    selectedFlocks.length,
    selectedAges.length,
    selectedSampleTypes.length,
    resultsFilter !== 'All' ? 1 : 0,
    selectedDiseases.length,
    selectedKitTypes.length,
    selectedCycles.length,
    selectedSources.length,
    selectedSerologyDiseases.length,
    selectedSerologyKitTypes.length,
    selectedMicrobiologyDiseases.length,
    selectedMicrobiologyResults.length,
    selectedPCRDiseases.length,
    selectedPCRResults.length
  ].reduce((a, b) => a + b, 0);

  // Show message if user has no database permissions
  if (allowedDepartments.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">You don't have permission to view any database results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Tabs with Filter/Columns buttons */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            {allowedDepartments.map((dept) => (
              <button
                key={dept}
                onClick={() => {
                  setActiveTab(dept);
                }}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === dept
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Filter & Columns Buttons */}
          <div className="flex items-center gap-3 pb-2">
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="text-sm font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                  {activeFilterCount}
                </span>
              )}
              <svg className={`w-4 h-4 transition-transform ${filterPanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className="relative" ref={columnsDropdownRef}>
              <button
                onClick={() => setColumnsDropdownOpen(!columnsDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <span className="text-sm font-medium">Columns</span>
              </button>
              {columnsDropdownOpen && (
                <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-300 rounded shadow-lg">
                  <div className="py-2">
                    {Object.entries({
                      house: 'House',
                      age: 'Age',
                      source: 'Source',
                      sampleType: 'Sample Type',
                      flock: 'Flock',
                      cycle: 'Cycle'
                    }).map(([key, label]) => (
                      <label key={key} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleColumns[key]}
                          onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {initialLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">No {activeTab} samples found</p>
        </div>
      ) : activeTab === 'PCR' ? (
        <>
          {/* Filter Chips and Collapsible Panel */}
          <div className="mb-4 space-y-3">
            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {(dateFrom || dateTo) && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    <span>Date: {dateFrom || '...'} to {dateTo || '...'}</span>
                    <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="hover:text-blue-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {selectedCompanies.map((company) => (
                  <div key={company} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                    <span>Company: {company}</span>
                    <button onClick={() => setSelectedCompanies(selectedCompanies.filter(c => c !== company))} className="hover:text-purple-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedFarms.map((farm) => (
                  <div key={farm} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    <span>Farm: {farm}</span>
                    <button onClick={() => setSelectedFarms(selectedFarms.filter(f => f !== farm))} className="hover:text-green-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedFlocks.map((flock) => (
                  <div key={flock} className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    <span>Flock: {flock}</span>
                    <button onClick={() => setSelectedFlocks(selectedFlocks.filter(f => f !== flock))} className="hover:text-yellow-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedAges.map((age) => (
                  <div key={age} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                    <span>Age: {age}</span>
                    <button onClick={() => setSelectedAges(selectedAges.filter(a => a !== age))} className="hover:text-indigo-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedDiseases.map((disease) => (
                  <div key={disease} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                    <span>Disease: {disease}</span>
                    <button onClick={() => setSelectedDiseases(selectedDiseases.filter(d => d !== disease))} className="hover:text-red-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedSampleTypes.map((sampleType) => (
                  <div key={sampleType} className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-medium">
                    <span>Sample Type: {sampleType}</span>
                    <button onClick={() => setSelectedSampleTypes(selectedSampleTypes.filter(st => st !== sampleType))} className="hover:text-teal-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {resultsFilter !== 'All' && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                    <span>Results: {resultsFilter}</span>
                    <button onClick={() => setResultsFilter('All')} className="hover:text-orange-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Collapsible Filter Panel */}
            {filterPanelOpen && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Date Range */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Company Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Companies</label>
                      {uniqueCompanies.length > 0 && (
                        <button
                          onClick={() => setSelectedCompanies(selectedCompanies.length === uniqueCompanies.length ? [] : uniqueCompanies)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedCompanies.length === uniqueCompanies.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniqueCompanies.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No companies available</div>
                      ) : (
                        uniqueCompanies.map((company) => (
                          <label key={company} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedCompanies.includes(company)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCompanies([...selectedCompanies, company]);
                                } else {
                                  setSelectedCompanies(selectedCompanies.filter(c => c !== company));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{company}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Farm Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Farms</label>
                      {uniqueFarms.length > 0 && (
                        <button
                          onClick={() => setSelectedFarms(selectedFarms.length === uniqueFarms.length ? [] : uniqueFarms)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedFarms.length === uniqueFarms.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniqueFarms.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No farms available</div>
                      ) : (
                        uniqueFarms.map((farm) => (
                          <label key={farm} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedFarms.includes(farm)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFarms([...selectedFarms, farm]);
                                } else {
                                  setSelectedFarms(selectedFarms.filter(f => f !== farm));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{farm}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Flock Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Flocks</label>
                      {uniqueFlocks.length > 0 && (
                        <button
                          onClick={() => setSelectedFlocks(selectedFlocks.length === uniqueFlocks.length ? [] : uniqueFlocks)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedFlocks.length === uniqueFlocks.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniqueFlocks.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No flocks available</div>
                      ) : (
                        uniqueFlocks.map((flock) => (
                          <label key={flock} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedFlocks.includes(flock)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFlocks([...selectedFlocks, flock]);
                                } else {
                                  setSelectedFlocks(selectedFlocks.filter(f => f !== flock));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{flock}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Age Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Ages</label>
                      {uniqueAges.length > 0 && (
                        <button
                          onClick={() => setSelectedAges(selectedAges.length === uniqueAges.length ? [] : uniqueAges)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedAges.length === uniqueAges.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniqueAges.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No ages available</div>
                      ) : (
                        uniqueAges.map((age) => (
                          <label key={age} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedAges.includes(age)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAges([...selectedAges, age]);
                                } else {
                                  setSelectedAges(selectedAges.filter(a => a !== age));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{age}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Disease Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Diseases (PCR)</label>
                      {allDiseases.length > 0 && (
                        <button
                          onClick={() => setSelectedDiseases(selectedDiseases.length === allDiseases.length ? [] : allDiseases)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedDiseases.length === allDiseases.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {allDiseases.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No diseases available</div>
                      ) : (
                        allDiseases.map((disease) => (
                          <label key={disease} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedDiseases.includes(disease)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDiseases([...selectedDiseases, disease]);
                                } else {
                                  setSelectedDiseases(selectedDiseases.filter(d => d !== disease));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{disease}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sample Type Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Sample Types</label>
                      {sampleTypes.length > 0 && (
                        <button
                          onClick={() => setSelectedSampleTypes(selectedSampleTypes.length === sampleTypes.length ? [] : sampleTypes)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedSampleTypes.length === sampleTypes.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {sampleTypes.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No sample types available</div>
                      ) : (
                        sampleTypes.map((type) => (
                          <label key={type} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedSampleTypes.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSampleTypes([...selectedSampleTypes, type]);
                                } else {
                                  setSelectedSampleTypes(selectedSampleTypes.filter(st => st !== type));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{type}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* PCR Disease Multi-Select */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Diseases</label>
                      {uniquePCRDiseases.length > 0 && (
                        <button
                          onClick={() => setSelectedPCRDiseases(selectedPCRDiseases.length === uniquePCRDiseases.length ? [] : uniquePCRDiseases)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedPCRDiseases.length === uniquePCRDiseases.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniquePCRDiseases.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No diseases available</div>
                      ) : (
                        uniquePCRDiseases.map((disease) => (
                          <label key={disease} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedPCRDiseases.includes(disease)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPCRDiseases([...selectedPCRDiseases, disease]);
                                } else {
                                  setSelectedPCRDiseases(selectedPCRDiseases.filter(d => d !== disease));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{disease}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* PCR Results Multi-Select */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Results</label>
                      {pcrResultOptions.length > 0 && (
                        <button
                          onClick={() => setSelectedPCRResults(selectedPCRResults.length === pcrResultOptions.length ? [] : pcrResultOptions)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedPCRResults.length === pcrResultOptions.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {pcrResultOptions.map((result) => (
                        <label key={result} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                          <input
                            type="checkbox"
                            checked={selectedPCRResults.includes(result)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPCRResults([...selectedPCRResults, result]);
                              } else {
                                setSelectedPCRResults(selectedPCRResults.filter(r => r !== result));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{result}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <PCRTable
            units={paginatedUnits}
            totalUnits={filteredUnits.length}
            diseases={pcrColumns}
            renderCTCell={renderCTCell}
            selectedSampleTypes={selectedSampleTypes}
            resultsFilter={resultsFilter}
            visibleColumns={visibleColumns}
            page={page}
            onPageChange={setPage}
          />
        </>
      ) : (
        <>
          {/* Active Filter Chips */}
          <div className="mb-4 space-y-3">
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {(dateFrom || dateTo) && (
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    <span>Date: {dateFrom || '...'} to {dateTo || '...'}</span>
                    <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="hover:text-blue-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {selectedCompanies.map((company) => (
                  <div key={company} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                    <span>Company: {company}</span>
                    <button onClick={() => setSelectedCompanies(selectedCompanies.filter(c => c !== company))} className="hover:text-purple-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedFarms.map((farm) => (
                  <div key={farm} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    <span>Farm: {farm}</span>
                    <button onClick={() => setSelectedFarms(selectedFarms.filter(f => f !== farm))} className="hover:text-green-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedFlocks.map((flock) => (
                  <div key={flock} className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                    <span>Flock: {flock}</span>
                    <button onClick={() => setSelectedFlocks(selectedFlocks.filter(f => f !== flock))} className="hover:text-yellow-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedAges.map((age) => (
                  <div key={age} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                    <span>Age: {age}</span>
                    <button onClick={() => setSelectedAges(selectedAges.filter(a => a !== age))} className="hover:text-indigo-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {selectedSampleTypes.map((sampleType) => (
                  <div key={sampleType} className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-medium">
                    <span>Sample Type: {sampleType}</span>
                    <button onClick={() => setSelectedSampleTypes(selectedSampleTypes.filter(st => st !== sampleType))} className="hover:text-teal-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsible Filter Panel */}
            {filterPanelOpen && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {/* Date Range */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Company Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Companies</label>
                      {uniqueCompanies.length > 0 && (
                        <button
                          onClick={() => setSelectedCompanies(selectedCompanies.length === uniqueCompanies.length ? [] : uniqueCompanies)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedCompanies.length === uniqueCompanies.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniqueCompanies.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No companies available</div>
                      ) : (
                        uniqueCompanies.map((company) => (
                          <label key={company} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedCompanies.includes(company)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCompanies([...selectedCompanies, company]);
                                } else {
                                  setSelectedCompanies(selectedCompanies.filter(c => c !== company));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{company}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Farm Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Farms</label>
                      {uniqueFarms.length > 0 && (
                        <button
                          onClick={() => setSelectedFarms(selectedFarms.length === uniqueFarms.length ? [] : uniqueFarms)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedFarms.length === uniqueFarms.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniqueFarms.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No farms available</div>
                      ) : (
                        uniqueFarms.map((farm) => (
                          <label key={farm} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedFarms.includes(farm)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFarms([...selectedFarms, farm]);
                                } else {
                                  setSelectedFarms(selectedFarms.filter(f => f !== farm));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{farm}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Flock Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Flocks</label>
                      {uniqueFlocks.length > 0 && (
                        <button
                          onClick={() => setSelectedFlocks(selectedFlocks.length === uniqueFlocks.length ? [] : uniqueFlocks)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedFlocks.length === uniqueFlocks.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniqueFlocks.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No flocks available</div>
                      ) : (
                        uniqueFlocks.map((flock) => (
                          <label key={flock} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedFlocks.includes(flock)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFlocks([...selectedFlocks, flock]);
                                } else {
                                  setSelectedFlocks(selectedFlocks.filter(f => f !== flock));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{flock}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Age Multi-Select Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-700">Ages</label>
                      {uniqueAges.length > 0 && (
                        <button
                          onClick={() => setSelectedAges(selectedAges.length === uniqueAges.length ? [] : uniqueAges)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedAges.length === uniqueAges.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                    <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                      {uniqueAges.length === 0 ? (
                        <div className="text-xs text-gray-500 py-1 px-2">No ages available</div>
                      ) : (
                        uniqueAges.map((age) => (
                          <label key={age} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedAges.includes(age)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAges([...selectedAges, age]);
                                } else {
                                  setSelectedAges(selectedAges.filter(a => a !== age));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">{age}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sample Type Multi-Select Dropdown - Hide for Serology */}
                  {activeTab !== 'Serology' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-gray-700">Sample Types</label>
                        {sampleTypes.length > 0 && (
                          <button
                            onClick={() => setSelectedSampleTypes(selectedSampleTypes.length === sampleTypes.length ? [] : sampleTypes)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {selectedSampleTypes.length === sampleTypes.length ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>
                      <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                        {sampleTypes.length === 0 ? (
                          <div className="text-xs text-gray-500 py-1 px-2">No sample types available</div>
                        ) : (
                          sampleTypes.map((type) => (
                            <label key={type} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                              <input
                                type="checkbox"
                                checked={selectedSampleTypes.includes(type)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSampleTypes([...selectedSampleTypes, type]);
                                  } else {
                                    setSelectedSampleTypes(selectedSampleTypes.filter(st => st !== type));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">{type}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Serology-specific filters: Cycle, Source, Disease, Kit Type */}
                  {activeTab === 'Serology' && (
                    <>
                      {/* Cycle Multi-Select */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-700">Cycles</label>
                          {uniqueCycles.length > 0 && (
                            <button
                              onClick={() => setSelectedCycles(selectedCycles.length === uniqueCycles.length ? [] : uniqueCycles)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {selectedCycles.length === uniqueCycles.length ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                          {uniqueCycles.length === 0 ? (
                            <div className="text-xs text-gray-500 py-1 px-2">No cycles available</div>
                          ) : (
                            uniqueCycles.map((cycle) => (
                              <label key={cycle} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedCycles.includes(cycle)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedCycles([...selectedCycles, cycle]);
                                    } else {
                                      setSelectedCycles(selectedCycles.filter(c => c !== cycle));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">{cycle}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Source Multi-Select */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-700">Sources</label>
                          {uniqueSources.length > 0 && (
                            <button
                              onClick={() => setSelectedSources(selectedSources.length === uniqueSources.length ? [] : uniqueSources)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {selectedSources.length === uniqueSources.length ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                          {uniqueSources.length === 0 ? (
                            <div className="text-xs text-gray-500 py-1 px-2">No sources available</div>
                          ) : (
                            uniqueSources.map((source) => (
                              <label key={source} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedSources.includes(source)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSources([...selectedSources, source]);
                                    } else {
                                      setSelectedSources(selectedSources.filter(s => s !== source));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">{source}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Disease Multi-Select */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-700">Diseases</label>
                          {uniqueSerologyDiseases.length > 0 && (
                            <button
                              onClick={() => setSelectedSerologyDiseases(selectedSerologyDiseases.length === uniqueSerologyDiseases.length ? [] : uniqueSerologyDiseases)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {selectedSerologyDiseases.length === uniqueSerologyDiseases.length ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                          {uniqueSerologyDiseases.length === 0 ? (
                            <div className="text-xs text-gray-500 py-1 px-2">No diseases available</div>
                          ) : (
                            uniqueSerologyDiseases.map((disease) => (
                              <label key={disease} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedSerologyDiseases.includes(disease)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSerologyDiseases([...selectedSerologyDiseases, disease]);
                                    } else {
                                      setSelectedSerologyDiseases(selectedSerologyDiseases.filter(d => d !== disease));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">{disease}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Kit Type Multi-Select */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-700">Kit Types</label>
                          {uniqueSerologyKitTypes.length > 0 && (
                            <button
                              onClick={() => setSelectedSerologyKitTypes(selectedSerologyKitTypes.length === uniqueSerologyKitTypes.length ? [] : uniqueSerologyKitTypes)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {selectedSerologyKitTypes.length === uniqueSerologyKitTypes.length ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                          {uniqueSerologyKitTypes.length === 0 ? (
                            <div className="text-xs text-gray-500 py-1 px-2">No kit types available</div>
                          ) : (
                            uniqueSerologyKitTypes.map((kitType) => (
                              <label key={kitType} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedSerologyKitTypes.includes(kitType)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSerologyKitTypes([...selectedSerologyKitTypes, kitType]);
                                    } else {
                                      setSelectedSerologyKitTypes(selectedSerologyKitTypes.filter(kt => kt !== kitType));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">{kitType}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Microbiology-specific filters: Disease, Result */}
                  {activeTab === 'Microbiology' && (
                    <>
                      {/* Disease Multi-Select */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-700">Diseases</label>
                          {uniqueMicrobiologyDiseases.length > 0 && (
                            <button
                              onClick={() => setSelectedMicrobiologyDiseases(selectedMicrobiologyDiseases.length === uniqueMicrobiologyDiseases.length ? [] : uniqueMicrobiologyDiseases)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {selectedMicrobiologyDiseases.length === uniqueMicrobiologyDiseases.length ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                          {uniqueMicrobiologyDiseases.length === 0 ? (
                            <div className="text-xs text-gray-500 py-1 px-2">No diseases available</div>
                          ) : (
                            uniqueMicrobiologyDiseases.map((disease) => (
                              <label key={disease} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedMicrobiologyDiseases.includes(disease)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMicrobiologyDiseases([...selectedMicrobiologyDiseases, disease]);
                                    } else {
                                      setSelectedMicrobiologyDiseases(selectedMicrobiologyDiseases.filter(d => d !== disease));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">{disease}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Result Multi-Select */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-700">Results</label>
                          {microbiologyResultOptions.length > 0 && (
                            <button
                              onClick={() => setSelectedMicrobiologyResults(selectedMicrobiologyResults.length === microbiologyResultOptions.length ? [] : microbiologyResultOptions)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {selectedMicrobiologyResults.length === microbiologyResultOptions.length ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                          {microbiologyResultOptions.map((result) => (
                            <label key={result} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                              <input
                                type="checkbox"
                                checked={selectedMicrobiologyResults.includes(result)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMicrobiologyResults([...selectedMicrobiologyResults, result]);
                                  } else {
                                    setSelectedMicrobiologyResults(selectedMicrobiologyResults.filter(r => r !== result));
                                  }
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">{result}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                </div>
              </div>
            )}
          </div>

          {activeTab === 'Microbiology' ? (
            <MicrobiologyTable
              units={paginatedUnits}
              totalUnits={filteredUnits.length}
              visibleColumns={visibleColumns}
              page={page}
              onPageChange={setPage}
              selectedMicrobiologyResults={selectedMicrobiologyResults}
            />
          ) : (
            <SerologyTable
              units={paginatedUnits}
              totalUnits={filteredUnits.length}
              visibleColumns={visibleColumns}
              page={page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

function PCRTable({
  units,
  totalUnits,
  diseases,
  renderCTCell,
  selectedSampleTypes,
  resultsFilter,
  visibleColumns,
  page,
  onPageChange,
}: {
  units: Array<Unit & { sample: Sample }>;
  totalUnits: number;
  diseases: string[];
  renderCTCell: (value: string | undefined) => React.ReactElement;
  selectedSampleTypes: string[];
  resultsFilter: string;
  visibleColumns: Record<string, boolean>;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const location = useLocation();
  const [coaResults, setCoaResults] = useState<Record<number, COAData | null>>({});
  const [loading, setLoading] = useState(true);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  // Refetch COA data when navigating back to this page (location.key changes)
  useEffect(() => {
    setRefetchKey(prev => prev + 1);
  }, [location.key]);

  useEffect(() => {
    const fetchAllCOAResults = async () => {
      setLoading(true);
      const results: Record<number, COAData | null> = {};

      if (units.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // Batch fetch all COAs in a single request for performance
        const unitIds = units.map(u => u.id);
        const response = await apiClient.get('/pcr-coa/batch/', {
          params: { unit_ids: unitIds.join(',') }
        });

        // Map COAs by unit_id
        const coaList: COAData[] = response.data;
        coaList.forEach(coa => {
          results[coa.unit_id] = coa;
        });

        // Mark units without COAs as null
        unitIds.forEach(unitId => {
          if (!results[unitId]) {
            results[unitId] = null;
          }
        });
      } catch (error) {
        console.error('Failed to fetch COAs:', error);
        // Mark all units as no COA on error
        units.forEach(unit => {
          results[unit.id] = null;
        });
      }

      setCoaResults(results);
      setLoading(false);
    };

    fetchAllCOAResults();
  }, [units, refetchKey]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  const getPoolHouses = (unitId: number): string => {
    const coa = coaResults[unitId];
    if (!coa?.test_results) return '-';

    const housesSet = new Set<string>();

    // Collect all unique pool houses from all diseases
    Object.values(coa.test_results).forEach((diseaseValue: any) => {
      let pools: Array<{ houses: string }>;
      if (Array.isArray(diseaseValue)) {
        pools = diseaseValue;
      } else if (typeof diseaseValue === 'object') {
        pools = [{ houses: diseaseValue.indices || diseaseValue.houses || '' }];
      } else {
        return;
      }

      pools.forEach(pool => {
        if (pool.houses && pool.houses.trim() !== '') {
          housesSet.add(pool.houses.trim());
        }
      });
    });

    const housesList = Array.from(housesSet);
    return housesList.length > 0 ? housesList.join(', ') : '-';
  };

  const getCTValue = (unitId: number, disease: string): string | undefined => {
    const coa = coaResults[unitId];
    if (!coa?.test_results) return undefined;

    const diseaseValue = (coa.test_results as any)[disease];
    if (!diseaseValue) return undefined;

    // Normalize to pooled format
    let pools: Array<{ houses: string; values: { [sampleType: string]: string }; pos_control: string }>;
    if (Array.isArray(diseaseValue)) {
      pools = diseaseValue;
    } else if (typeof diseaseValue === 'object') {
      // Old format: convert to pooled format
      pools = [{
        houses: '',
        values: diseaseValue,
        pos_control: diseaseValue['pos_control'] || diseaseValue['POS. CONTROL'] || diseaseValue['Pos. Control'] || ''
      }];
    } else {
      return undefined;
    }

    // Aggregate all pools' results
    const allResults: { [sampleType: string]: string[] } = {};
    pools.forEach(pool => {
      Object.entries(pool.values || {}).forEach(([st, value]) => {
        if (!allResults[st]) allResults[st] = [];
        if (value && value !== '') allResults[st].push(value);
      });
    });

    // Filter results by sample type if specified
    if (selectedSampleTypes.length > 0) {
      // Show results only for selected sample types
      const filteredResults: string[] = [];
      selectedSampleTypes.forEach(sampleType => {
        const values = allResults[sampleType] || [];
        if (values.length > 0) {
          filteredResults.push(...values);
        }
      });

      if (filteredResults.length === 0) return undefined;

      const firstValue = filteredResults[0];
      if (!firstValue || firstValue === '') return undefined;

      const upperValue = firstValue.toUpperCase();
      if (upperValue === 'N/A' || upperValue === 'NA') return undefined;

      // Apply results filter
      const isNegative = upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE';
      const isPositive = !isNegative && !isNaN(parseFloat(firstValue));

      if (resultsFilter === 'Positive' && !isPositive) return undefined;
      if (resultsFilter === 'Negative' && !isNegative) return undefined;

      return firstValue;
    }

    // Get all sample type values, excluding POS. CONTROL, empty, and N/A
    const sampleTypeEntries: Array<[string, string]> = [];
    Object.entries(allResults).forEach(([st, values]) => {
      const upperKey = st.toUpperCase();
      if (upperKey === 'POS. CONTROL' || upperKey === 'POS CONTROL' || upperKey === 'POS_CONTROL') return;

      values.forEach(value => {
        const upperValue = value?.toUpperCase() || '';
        if (value && value !== '' && upperValue !== 'N/A' && upperValue !== 'NA') {
          sampleTypeEntries.push([st, value]);
        }
      });
    });

    if (sampleTypeEntries.length === 0) return undefined;

    // Separate numeric CT values from NEG results with their sample types
    const numericEntries: Array<{ sampleType: string; ct: number }> = [];
    let hasNegative = false;

    sampleTypeEntries.forEach(([sampleType, value]) => {
      const upperValue = value.toUpperCase();
      if (upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE') {
        hasNegative = true;
      } else {
        // Handle "CT:25.5" format by extracting the number
        let numValue = value;
        if (value.toUpperCase().startsWith('CT:')) {
          numValue = value.substring(3).trim();
        }
        const num = parseFloat(numValue);
        if (!isNaN(num)) {
          numericEntries.push({ sampleType, ct: num });
        }
      }
    });

    // Apply results filter
    if (resultsFilter === 'Positive') {
      // Show only positive results
      if (numericEntries.length > 0) {
        const lowestEntry = numericEntries.reduce((min, curr) =>
          curr.ct < min.ct ? curr : min
        );
        // If only one organ, just show the CT value without organ name
        if (numericEntries.length === 1) {
          return lowestEntry.ct.toString();
        }
        return `${lowestEntry.sampleType}: ${lowestEntry.ct}`;
      }
      return undefined;
    } else if (resultsFilter === 'Negative') {
      // Show only negative results
      return hasNegative ? 'NEG.' : undefined;
    } else {
      // Show all results (All filter)
      if (numericEntries.length > 0) {
        const lowestEntry = numericEntries.reduce((min, curr) =>
          curr.ct < min.ct ? curr : min
        );
        // If only one organ, just show the CT value without organ name
        if (numericEntries.length === 1) {
          return lowestEntry.ct.toString();
        }
        return `${lowestEntry.sampleType}: ${lowestEntry.ct}`;
      }
      return hasNegative ? 'NEG.' : undefined;
    }
  };


  // Optimized Export functions for high performance with large datasets
  const exportToExcel = async () => {
    try {
      setExportDropdownOpen(false);

      // Create progress bar overlay
      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      progressOverlay.innerHTML = `
        <div class="bg-white rounded-lg p-6 shadow-xl min-w-[400px]">
          <h3 class="text-lg font-semibold mb-4 text-gray-800">Exporting PCR Data...</h3>
          <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div id="pcr-excel-progress-bar" class="bg-blue-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          <p id="pcr-excel-progress-text" class="text-sm text-gray-600 text-center">Preparing export... 0%</p>
        </div>
      `;
      document.body.appendChild(progressOverlay);
      
      const progressBar = document.getElementById('pcr-excel-progress-bar');
      const progressText = document.getElementById('pcr-excel-progress-text');
      
      const updateProgress = (percent: number, message: string) => {
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${message} ${Math.round(percent)}%`;
      };

      await new Promise(resolve => setTimeout(resolve, 50));

      const wb = XLSX.utils.book_new();
      const CHUNK_SIZE = 1000;
      const totalRows = filteredByResults.length;

      const wsData: any[] = [];

      const headers = [
        'Sample Code',
        'Unit Code',
        'Date Received',
        'Company',
        'Farm',
        'Flock',
        'Cycle',
        'House',
        'Age',
        'Source',
        selectedSampleTypes.length > 0 ? selectedSampleTypes.join(', ') : 'Sample Type',
        ...diseases,
      ];
      wsData.push(headers);

      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = filteredByResults.slice(i, Math.min(i + CHUNK_SIZE, totalRows));

        const progress = 10 + ((i / totalRows) * 50);
        updateProgress(progress, 'Processing rows...');

        chunk.forEach((unit: Unit & { sample: Sample }) => {
          const row: any[] = [
            unit.sample.sample_code,
            unit.unit_code,
            unit.sample.date_received,
            unit.sample.company,
            unit.sample.farm,
            unit.sample.flock || '-',
            unit.sample.cycle || '-',
            getPoolHouses(unit.id),
            unit.age || '-',
            unit.source || '-',
            selectedSampleTypes.length > 0
              ? (unit.sample_type?.filter((st: string) => selectedSampleTypes.includes(st)).join(', ') || '-')
              : (unit.sample_type?.join(', ') || '-'),
          ];

          // Add disease results
          diseases.forEach((disease) => {
            const value = getCTValue(unit.id, disease) || '-';
            row.push(value);
          });

          wsData.push(row);
        });

        // Yield to browser between chunks
        if (i + CHUNK_SIZE < totalRows) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      updateProgress(65, 'Generating Excel file...');
      await new Promise(resolve => setTimeout(resolve, 10));

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Apply color coding efficiently - only if dataset is reasonable size
      if (totalRows < 5000) {
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = 1; R <= range.e.r; ++R) {
          for (let C = 11; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellAddress];
            if (cell && cell.v) {
              const value = String(cell.v);
              const upperValue = value.toUpperCase();

              if (upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE') {
                cell.s = {
                  fill: {
                    patternType: 'solid',
                    fgColor: { rgb: 'FFD4EDDA' },
                    bgColor: { rgb: 'FFD4EDDA' }
                  },
                  font: { color: { rgb: 'FF155724' }, bold: true },
                };
              } else if (!value.includes(':') && value !== '-' && !isNaN(parseFloat(value))) {
                cell.s = {
                  fill: {
                    patternType: 'solid',
                    fgColor: { rgb: 'FFF8D7DA' },
                    bgColor: { rgb: 'FFF8D7DA' }
                  },
                  font: { color: { rgb: 'FFC82333' }, bold: true },
                };
              } else if (value.includes(':')) {
                cell.s = {
                  fill: {
                    patternType: 'solid',
                    fgColor: { rgb: 'FFF8D7DA' },
                    bgColor: { rgb: 'FFF8D7DA' }
                  },
                  font: { color: { rgb: 'FFC82333' }, bold: true },
                };
              }
            }
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, 'PCR Results');

      updateProgress(90, 'Saving file...');
      await new Promise(resolve => setTimeout(resolve, 10));

      XLSX.writeFile(wb, `PCR_Database_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

      updateProgress(100, 'Complete!');
      await new Promise(resolve => setTimeout(resolve, 500));
      document.body.removeChild(progressOverlay);

      const successToast = document.createElement('div');
      successToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      successToast.textContent = `Successfully exported ${totalRows} rows!`;
      document.body.appendChild(successToast);
      setTimeout(() => document.body.removeChild(successToast), 3000);

    } catch (error) {
      console.error('Export failed:', error);
      const overlay = document.querySelector('.fixed.inset-0.bg-black');
      if (overlay) document.body.removeChild(overlay);
      const errorToast = document.createElement('div');
      errorToast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      errorToast.textContent = 'Export failed. Please try again.';
      document.body.appendChild(errorToast);
      setTimeout(() => document.body.removeChild(errorToast), 3000);
    }
  };

  const exportToCSV = async () => {
    try {
      setExportDropdownOpen(false);

      // Create progress bar overlay for CSV
      const progressOverlay = document.createElement('div');
      progressOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      progressOverlay.innerHTML = `
        <div class="bg-white rounded-lg p-6 shadow-xl min-w-[400px]">
          <h3 class="text-lg font-semibold mb-4 text-gray-800">Exporting PCR CSV...</h3>
          <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div id="pcr-csv-progress-bar" class="bg-blue-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
          </div>
          <p id="pcr-csv-progress-text" class="text-sm text-gray-600 text-center">Preparing export... 0%</p>
        </div>
      `;
      document.body.appendChild(progressOverlay);
      
      const progressBar = document.getElementById('pcr-csv-progress-bar');
      const progressText = document.getElementById('pcr-csv-progress-text');
      
      const updateProgress = (percent: number, message: string) => {
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${message} ${Math.round(percent)}%`;
      };

      await new Promise(resolve => setTimeout(resolve, 50));

      const CHUNK_SIZE = 2000;
      const totalRows = filteredByResults.length;
      const csvChunks: string[] = [];

      // Header row
      const headers = [
        'Sample Code',
        'Unit Code',
        'Date Received',
        'Company',
        'Farm',
        'Flock',
        'Cycle',
        'House',
        'Age',
        'Source',
        selectedSampleTypes.length > 0 ? selectedSampleTypes.join(', ') : 'Sample Type',
        ...diseases,
      ];
      csvChunks.push(headers.join(','));

      // Process data in chunks
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = filteredByResults.slice(i, Math.min(i + CHUNK_SIZE, totalRows));

        const progress = 10 + ((i / totalRows) * 60);
        updateProgress(progress, `Processing ${Math.min(i + CHUNK_SIZE, totalRows)} of ${totalRows} rows...`);

        const chunkRows: string[] = [];
        chunk.forEach((unit) => {
          const row: string[] = [
            unit.sample.sample_code,
            unit.unit_code,
            unit.sample.date_received,
            unit.sample.company,
            unit.sample.farm,
            unit.sample.flock || '-',
            unit.sample.cycle || '-',
            `"${getPoolHouses(unit.id)}"`,
            String(unit.age || '-'),
            Array.isArray(unit.source) ? unit.source.join(', ') : (unit.source || '-'),
            selectedSampleTypes.length > 0
              ? `"${unit.sample_type?.filter(st => selectedSampleTypes.includes(st)).join(', ') || '-'}"`
              : `"${unit.sample_type?.join(', ') || '-'}"`,
          ];

          // Add disease results
          diseases.forEach((disease) => {
            const value = getCTValue(unit.id, disease) || '-';
            row.push(value);
          });

          chunkRows.push(row.join(','));
        });

        csvChunks.push(...chunkRows);

        // Yield to browser between chunks and update progress
        if (i + CHUNK_SIZE < totalRows) {
          const progress = 10 + ((i / totalRows) * 70);
          updateProgress(progress, 'Processing rows...');
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      updateProgress(85, 'Generating CSV file...');
      await new Promise(resolve => setTimeout(resolve, 10));

      const csvContent = csvChunks.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `PCR_Database_Export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      updateProgress(100, 'Complete!');
      await new Promise(resolve => setTimeout(resolve, 500));
      document.body.removeChild(progressOverlay);

      const successToast = document.createElement('div');
      successToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      successToast.textContent = `Successfully exported ${totalRows} rows!`;
      document.body.appendChild(successToast);
      setTimeout(() => document.body.removeChild(successToast), 3000);

    } catch (error) {
      console.error('Export failed:', error);
      const overlay = document.querySelector('.fixed.inset-0.bg-black');
      if (overlay) document.body.removeChild(overlay);
      const errorToast = document.createElement('div');
      errorToast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      errorToast.textContent = 'Export failed. Please try again.';
      document.body.appendChild(errorToast);
      setTimeout(() => document.body.removeChild(errorToast), 3000);
    }
  };

  // Filter units based on sample type - backend already filtered by sample_type field
  // This additional filter is for COA test results display only
  const filteredByResults = useMemo(() => {
    // Backend already handles sample_type filtering, so just return all units
    // This filter was incorrectly checking COA test results instead of unit.sample_type
    return units;
  }, [units]);

  // Expand units into pool rows: each pool becomes a separate row
  const expandedRows = useMemo(() => {
    const rows: Array<{
      unit: Unit & { sample: Sample };
      poolIndex: number;
      poolHouses: string;
      poolData: { [disease: string]: { values: { [sampleType: string]: string }; pos_control: string } };
    }> = [];

    filteredByResults.forEach(unit => {
      const coa = coaResults[unit.id];
      if (!coa?.test_results) {
        // No COA or no test results, show unit with original houses
        rows.push({
          unit,
          poolIndex: 0,
          poolHouses: unit.house?.join(', ') || '-',
          poolData: {}
        });
        return;
      }

      // Collect all pools across all diseases
      const poolsMap = new Map<number, {
        houses: string;
        diseaseResults: { [disease: string]: { values: { [sampleType: string]: string }; pos_control: string } };
      }>();

      Object.entries(coa.test_results).forEach(([disease, diseaseValue]: [string, any]) => {
        let pools: Array<{ houses: string; values: { [sampleType: string]: string }; pos_control: string }>;
        if (Array.isArray(diseaseValue)) {
          pools = diseaseValue;
        } else if (typeof diseaseValue === 'object') {
          pools = [{
            houses: '',
            values: diseaseValue,
            pos_control: diseaseValue['pos_control'] || diseaseValue['POS. CONTROL'] || ''
          }];
        } else {
          return;
        }

        pools.forEach((pool, idx) => {
          if (!poolsMap.has(idx)) {
            poolsMap.set(idx, { houses: pool.houses || '', diseaseResults: {} });
          }
          const poolEntry = poolsMap.get(idx)!;
          poolEntry.diseaseResults[disease] = {
            values: pool.values || {},
            pos_control: pool.pos_control || ''
          };
          // Update houses if not set
          if (!poolEntry.houses && pool.houses) {
            poolEntry.houses = pool.houses;
          }
        });
      });

      // Create a row for each pool
      if (poolsMap.size === 0) {
        // No pools, show unit with original houses
        rows.push({
          unit,
          poolIndex: 0,
          poolHouses: unit.house?.join(', ') || '-',
          poolData: {}
        });
      } else {
        Array.from(poolsMap.entries()).forEach(([poolIdx, poolInfo]) => {
          rows.push({
            unit,
            poolIndex: poolIdx,
            // Use pool houses if available, otherwise use original unit houses
            poolHouses: poolInfo.houses || unit.house?.join(', ') || '-',
            poolData: poolInfo.diseaseResults
          });
        });
      }
    });

    return rows;
  }, [filteredByResults, coaResults]);

  const getPoolCTValue = (poolData: any, disease: string): string | undefined => {
    const diseaseData = poolData[disease];
    if (!diseaseData) return undefined;

    const values = diseaseData.values || {};

    // Filter results by sample type if specified
    if (selectedSampleTypes.length > 0) {
      // Check each selected sample type and return the first valid value
      for (const sampleType of selectedSampleTypes) {
        const specificValue = values[sampleType];
        if (!specificValue || specificValue === '') continue;

        const upperValue = specificValue.toUpperCase();
        if (upperValue === 'N/A' || upperValue === 'NA') continue;

        // Apply results filter
        const isNegative = upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE';
        const isPositive = !isNegative && !isNaN(parseFloat(specificValue));

        if (resultsFilter === 'Positive' && !isPositive) continue;
        if (resultsFilter === 'Negative' && !isNegative) continue;

        return specificValue;
      }
      return undefined;
    }

    // Get all sample type values, excluding POS. CONTROL, empty, and N/A
    const sampleTypeEntries: Array<[string, string]> = [];
    Object.entries(values).forEach(([st, value]) => {
      const upperKey = st.toUpperCase();
      if (upperKey === 'POS. CONTROL' || upperKey === 'POS CONTROL' || upperKey === 'POS_CONTROL') return;

      const upperValue = (value as string)?.toUpperCase() || '';
      if (value && value !== '' && upperValue !== 'N/A' && upperValue !== 'NA') {
        sampleTypeEntries.push([st, value as string]);
      }
    });

    if (sampleTypeEntries.length === 0) return undefined;

    // Separate numeric CT values from NEG results
    const numericEntries: Array<{ sampleType: string; ct: number }> = [];
    let hasNegative = false;

    sampleTypeEntries.forEach(([sampleType, value]) => {
      const upperValue = value.toUpperCase();
      if (upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE') {
        hasNegative = true;
      } else {
        let numValue = value;
        if (value.toUpperCase().startsWith('CT:')) {
          numValue = value.substring(3).trim();
        }
        const num = parseFloat(numValue);
        if (!isNaN(num)) {
          numericEntries.push({ sampleType, ct: num });
        }
      }
    });

    // Apply results filter
    if (resultsFilter === 'Positive') {
      if (numericEntries.length > 0) {
        const lowestEntry = numericEntries.reduce((min, curr) =>
          curr.ct < min.ct ? curr : min
        );
        if (numericEntries.length === 1) {
          return lowestEntry.ct.toString();
        }
        return `${lowestEntry.sampleType}: ${lowestEntry.ct}`;
      }
      return undefined;
    } else if (resultsFilter === 'Negative') {
      return hasNegative ? 'NEG.' : undefined;
    } else {
      if (numericEntries.length > 0) {
        const lowestEntry = numericEntries.reduce((min, curr) =>
          curr.ct < min.ct ? curr : min
        );
        if (numericEntries.length === 1) {
          return lowestEntry.ct.toString();
        }
        return `${lowestEntry.sampleType}: ${lowestEntry.ct}`;
      }
      return hasNegative ? 'NEG.' : undefined;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading COA results...</p>
      </div>
    );
  }

  // Determine what sample types to show in column headers
  const sampleTypeColumnLabel = selectedSampleTypes.length > 0 ? selectedSampleTypes.join(', ') : 'Sample Type';
  const showAllSampleTypes = selectedSampleTypes.length === 0;

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Sample Code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Unit Code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Date Received</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Company</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Farm</th>
                {visibleColumns.flock && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Flock</th>}
                {visibleColumns.cycle && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Cycle</th>}
                {visibleColumns.house && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">House</th>}
                {visibleColumns.age && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Age</th>}
                {visibleColumns.source && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Source</th>}
                {visibleColumns.sampleType && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">{sampleTypeColumnLabel}</th>}
                {diseases.map((disease) => (
                  <th key={disease} className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-blue-50 whitespace-nowrap">
                    {disease}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">COA</th>
              </tr>
            </thead>
            <tbody>
              {expandedRows.map((row, rowIdx) => (
                <tr key={`${row.unit.id}-pool-${row.poolIndex}-${rowIdx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.unit.sample.sample_code}</td>
                  <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.unit.unit_code}</td>
                  <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.unit.sample.date_received}</td>
                  <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.unit.sample.company}</td>
                  <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.unit.sample.farm}</td>
                  {visibleColumns.flock && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.unit.sample.flock || '-'}</td>}
                  {visibleColumns.cycle && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.unit.sample.cycle || '-'}</td>}
                  {visibleColumns.house && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.poolHouses}</td>}
                  {visibleColumns.age && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.unit.age || '-'}</td>}
                  {visibleColumns.source && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{Array.isArray(row.unit.source) ? row.unit.source.join(', ') : (row.unit.source || '-')}</td>}
                  {visibleColumns.sampleType && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">
                    {showAllSampleTypes
                      ? (row.unit.sample_type?.join(', ') || '-')
                      : (row.unit.sample_type?.filter(st => selectedSampleTypes.includes(st)).join(', ') || '-')
                    }
                  </td>}
                  {diseases.map((disease) => renderCTCell(getPoolCTValue(row.poolData, disease)))}
                  <td className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap">
                    {row.unit.coa_status ? (
                      <Link
                        to={`/pcr-coa/${row.unit.id}`}
                        state={{ fromDatabase: true, department: 'PCR' }}
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            {/* Export Dropdown */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">Export</span>
              </button>
              {exportDropdownOpen && (
                <div className="absolute left-0 bottom-full mb-1 w-40 bg-white border border-gray-300 rounded shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={exportToExcel}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Excel (.xlsx)
                    </button>
                    <button
                      onClick={exportToCSV}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      CSV (.csv)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-700">
              Showing <span className="font-semibold">{totalUnits}</span> records
              {totalUnits === 100 && <span className="text-gray-500 ml-2">(Page {page})</span>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(1)}
                disabled={page === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                aria-label="First page"
              >
                &laquo;
              </button>
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                aria-label="Previous page"
              >
                &lsaquo;
              </button>

              {/* Show numbered page buttons - dynamically based on data */}
              {(() => {
                const itemsPerPage = 100;
                const totalPages = Math.max(1, Math.ceil(totalUnits / itemsPerPage) + (totalUnits === itemsPerPage ? page : page - 1));
                const pagesToShow = [];
                const startPage = Math.max(1, page - 2);
                const endPage = Math.min(totalPages, page + 2);
                for (let i = startPage; i <= endPage; i++) {
                  pagesToShow.push(i);
                }
                return pagesToShow.map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`px-3 py-1 border rounded text-sm ${page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-50'
                      }`}
                  >
                    {pageNum}
                  </button>
                ));
              })()}

              <button
                onClick={() => onPageChange(page + 1)}
                disabled={totalUnits < 100}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                aria-label="Next page"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => onPageChange(page + 10)}
                disabled={totalUnits < 100}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                aria-label="Jump forward"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface MicrobiologyCOAData {
  id?: number;
  unit_id: number;
  test_results: { [disease: string]: { [sampleType: string]: string } };
  date_tested: string | null;
  status: string;
}

function MicrobiologyTable({
  units,
  totalUnits,
  visibleColumns,
  page,
  onPageChange,
  selectedMicrobiologyResults,
}: {
  units: Array<Unit & { sample: Sample }>;
  totalUnits: number;
  visibleColumns: Record<string, boolean>;
  page: number;
  onPageChange: (page: number) => void;
  selectedMicrobiologyResults: string[];
}) {
  const location = useLocation();
  const [coaResults, setCoaResults] = useState<Record<number, MicrobiologyCOAData | null>>({});
  const [loading, setLoading] = useState(true);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  // Refetch COA data when navigating back to this page (location.key changes)
  useEffect(() => {
    setRefetchKey(prev => prev + 1);
  }, [location.key]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get all unique diseases from units
  const allDiseases = useMemo(() => {
    const diseaseSet = new Set<string>();
    units.forEach((unit) => {
      unit.microbiology_data?.diseases_list?.forEach((d) => diseaseSet.add(d));
    });
    return Array.from(diseaseSet).sort();
  }, [units]);

  useEffect(() => {
    const fetchAllCOAResults = async () => {
      setLoading(true);
      const results: Record<number, MicrobiologyCOAData | null> = {};

      if (units.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const unitIds = units.map(u => u.id);
        const response = await apiClient.get('/microbiology-coa/batch/', {
          params: { unit_ids: unitIds.join(',') }
        });

        const coaList: MicrobiologyCOAData[] = response.data;
        coaList.forEach(coa => {
          results[coa.unit_id] = coa;
        });

        unitIds.forEach(unitId => {
          if (!results[unitId]) {
            results[unitId] = null;
          }
        });
      } catch (error) {
        console.error('Failed to fetch Microbiology COAs:', error);
        units.forEach(unit => {
          results[unit.id] = null;
        });
      }

      setCoaResults(results);
      setLoading(false);
    };

    fetchAllCOAResults();
  }, [units, refetchKey]);

  // Helper: Parse numeric value from result string (handles scientific notation like "1x10^5" or plain numbers)
  const parseNumericValue = (value: string): number | null => {
    if (!value || value === '-' || value === '') return null;
    const upper = value.toUpperCase().trim();
    
    // Check for "Less than X" format
    if (upper.includes('LESS THAN')) {
      const match = upper.match(/LESS\s*THAN\s*(\d+)/i);
      if (match) return parseFloat(match[1]) - 1; // Return value below the threshold
      return 0;
    }
    
    // Check for scientific notation like "1x10^5" or "1×10^5" or "1*10^5"
    const sciMatch = value.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*10\s*[\^]?\s*(\d+)/i);
    if (sciMatch) {
      return parseFloat(sciMatch[1]) * Math.pow(10, parseInt(sciMatch[2]));
    }
    
    // Check for plain number
    const numMatch = value.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }
    
    return null;
  };

  // Helper: Convert number to scientific notation with superscript (e.g., 6453 → "6.5×10³")
  const formatScientificNotation = (num: number): string => {
    if (num === 0) return '0';
    if (num < 10) return num.toString();
    
    const superscripts: Record<string, string> = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
      '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
    };
    
    const exponent = Math.floor(Math.log10(num));
    const mantissa = num / Math.pow(10, exponent);
    const roundedMantissa = Math.round(mantissa * 10) / 10; // Round to 1 decimal
    
    const superscriptExp = exponent.toString().split('').map(d => superscripts[d] || d).join('');
    
    return `${roundedMantissa}×10${superscriptExp}`;
  };
  // Suppress unused variable warning - function available for future use
  void formatScientificNotation;

  // Get disease result for a unit - returns null if unit doesn't have this disease
  const getDiseaseResult = (unitId: number, disease: string): string | null => {
    // Check if unit has this disease in its diseases_list
    const unit = units.find(u => u.id === unitId);
    const unitDiseases = unit?.microbiology_data?.diseases_list || [];
    if (!unitDiseases.includes(disease)) return null; // Unit doesn't have this disease
    
    const coa = coaResults[unitId];
    if (!coa?.test_results?.[disease]) return '-';
    
    const results = coa.test_results[disease];
    const allValues = Object.values(results);
    const lowerDisease = disease.toLowerCase();
    const sampleTypes = unit?.sample_type || [];
    const isFeed = sampleTypes.some(t => t.toLowerCase().includes('feed'));
    
    // Water disease types - check numeric limits
    if (lowerDisease.includes('water')) {
      // Get max numeric value from all results
      let maxValue = 0;
      let hasValue = false;
      
      allValues.forEach(v => {
        const num = parseNumericValue(v || '');
        if (num !== null) {
          hasValue = true;
          maxValue = Math.max(maxValue, num);
        }
      });
      
      if (!hasValue) return 'Within Limit';
      
      // Total Bacterial Count: >56 = Over Limit
      if (lowerDisease.includes('bacterial') || lowerDisease.includes('tbc')) {
        return maxValue > 56 ? 'Over Limit' : 'Within Limit';
      }
      
      // Coliform, E-Coli, Pseudomonas: >1 = Over Limit
      if (lowerDisease.includes('coliform') || lowerDisease.includes('e-coli') || 
          lowerDisease.includes('e.coli') || lowerDisease.includes('ecoli') ||
          lowerDisease.includes('pseudomonas')) {
        return maxValue > 1 ? 'Over Limit' : 'Within Limit';
      }
      
      // Default water check
      return maxValue > 1 ? 'Over Limit' : 'Within Limit';
    }
    
    // Total Count disease type - check numeric limits based on sample type
    if (lowerDisease.includes('total count')) {
      let maxValue = 0;
      let hasValue = false;
      
      allValues.forEach(v => {
        const num = parseNumericValue(v || '');
        if (num !== null) {
          hasValue = true;
          maxValue = Math.max(maxValue, num);
        }
      });
      
      if (!hasValue) return 'Within Limit';
      
      // FEED sample type: >=10^5 (100000) = Over Limit
      if (isFeed) {
        return maxValue >= 100000 ? 'Over Limit' : 'Within Limit';
      }
      
      // Other sample types: >10^3 (1000) = Over Limit
      return maxValue > 1000 ? 'Over Limit' : 'Within Limit';
    }
    
    // Culture, Fungi, Salmonella - Detected/Not Detected logic
    const hasPositive = allValues.some(v => {
      const upper = v?.toUpperCase() || '';
      return upper !== 'NOT DETECTED' && upper !== 'NEGATIVE' && upper !== '-' && upper !== '' && !upper.includes('LESS THAN') && upper !== 'NO BACTERIAL GROWTH' && upper !== 'NO COLIFORM GROWTH' && upper !== 'NO FUNGAL GROWTH';
    });
    
    return hasPositive ? 'Detected' : 'Not Detected';
  };

  // Get isolate type for a unit
  const getIsolateType = (unitId: number): string => {
    const coa = coaResults[unitId];
    if (!coa) return '-';
    
    // Check isolate_types from COA data
    const isolateTypes = (coa as any).isolate_types;
    if (!isolateTypes) return '-';
    
    const types = new Set<string>();
    Object.values(isolateTypes).forEach((diseaseIsolates: any) => {
      if (typeof diseaseIsolates === 'object') {
        Object.values(diseaseIsolates).forEach((type: any) => {
          if (type && type !== '-' && type !== '') {
            types.add(type);
          }
        });
      }
    });
    
    return types.size > 0 ? Array.from(types).join(', ') : '-';
  };

  // Get positive locations for a unit (sub-samples with positive/over-limit results)
  const getPositiveLocations = (unitId: number): string => {
    const unit = units.find(u => u.id === unitId);
    const coa = coaResults[unitId];
    if (!coa?.test_results) return '-';
    
    const sampleTypes = unit?.sample_type || [];
    const isFeed = sampleTypes.some(t => t.toLowerCase().includes('feed'));
    const indexList = unit?.microbiology_data?.index_list || [];
    const positiveLocationIndices = new Set<number>();
    
    Object.entries(coa.test_results).forEach(([disease, results]) => {
      const lowerDisease = disease.toLowerCase();
      
      Object.entries(results).forEach(([location, value]) => {
        if (!value || value === '-' || value === '') return;
        
        const upper = value.toUpperCase();
        let isPositive = false;
        
        // Water disease types - check numeric limits
        if (lowerDisease.includes('water')) {
          const num = parseNumericValue(value);
          if (num !== null) {
            if (lowerDisease.includes('bacterial') || lowerDisease.includes('tbc')) {
              isPositive = num > 56;
            } else if (lowerDisease.includes('coliform') || lowerDisease.includes('e-coli') || 
                       lowerDisease.includes('e.coli') || lowerDisease.includes('ecoli') ||
                       lowerDisease.includes('pseudomonas')) {
              isPositive = num > 1;
            } else {
              isPositive = num > 1;
            }
          }
        }
        // Total Count - check numeric limits based on sample type
        else if (lowerDisease.includes('total count')) {
          const num = parseNumericValue(value);
          if (num !== null) {
            isPositive = isFeed ? num >= 100000 : num > 1000;
          }
        }
        // Culture, Fungi, Salmonella - Detected/Not Detected logic
        else {
          isPositive = upper !== 'NOT DETECTED' && upper !== 'NEGATIVE' && 
                       !upper.includes('LESS THAN') && upper !== 'NO BACTERIAL GROWTH' && 
                       upper !== 'NO COLIFORM GROWTH' && upper !== 'NO FUNGAL GROWTH';
        }
        
        if (isPositive) {
          // Extract base location index (e.g., "1" from "1_fungi" or "1_mould")
          const baseLocationStr = location.split('_')[0];
          const locationIndex = parseInt(baseLocationStr);
          if (!isNaN(locationIndex) && locationIndex > 0) {
            positiveLocationIndices.add(locationIndex);
          }
        }
      });
    });
    
    // Sort indices and map to sample names from index_list
    const sortedIndices = Array.from(positiveLocationIndices).sort((a, b) => a - b);
    
    // Map indices to sample names (index_list is 0-based, location indices are 1-based)
    const sampleNames = sortedIndices.map(idx => {
      const name = indexList[idx - 1]; // Convert 1-based to 0-based
      return name || `Sample ${idx}`;
    });
    
    return sampleNames.length > 0 ? sampleNames.join(', ') : '-';
  };

  // Helper function to get unit's overall result status for filtering
  const getUnitResultStatus = (unitId: number): string[] => {
    const results: string[] = [];
    const unit = units.find(u => u.id === unitId);
    if (!unit) return results;
    
    const unitDiseases = unit.microbiology_data?.diseases_list || [];
    unitDiseases.forEach(disease => {
      const result = getDiseaseResult(unitId, disease);
      if (result) {
        results.push(result);
      }
    });
    return results;
  };

  // Filter units based on selected result filters
  const filteredDisplayUnits = useMemo(() => {
    if (selectedMicrobiologyResults.length === 0) return units;
    
    return units.filter(unit => {
      const unitResults = getUnitResultStatus(unit.id);
      // Check if any of the unit's results match the selected filters
      return selectedMicrobiologyResults.some(selectedResult => {
        if (selectedResult === 'Detected') {
          return unitResults.includes('Detected');
        } else if (selectedResult === 'Not Detected') {
          return unitResults.includes('Not Detected');
        } else if (selectedResult === 'Over Limit') {
          return unitResults.includes('Over Limit');
        } else if (selectedResult === 'Within Limit') {
          return unitResults.includes('Within Limit');
        }
        return false;
      });
    });
  }, [units, selectedMicrobiologyResults, coaResults]);

  if (loading) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <p className="mt-2 text-gray-600">Loading COA results...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Sample Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Unit Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Date Received</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Company</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Farm</th>
              {visibleColumns.flock && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Flock</th>}
              {visibleColumns.cycle && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Cycle</th>}
              {visibleColumns.house && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">House</th>}
              {visibleColumns.age && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Age</th>}
              {visibleColumns.sampleType && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Sample Type</th>}
              {allDiseases.map((disease) => (
                <th key={disease} className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-blue-50 whitespace-nowrap">
                  {disease}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Type of Isolate</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Location</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">COA</th>
            </tr>
          </thead>
          <tbody>
            {filteredDisplayUnits.map((unit) => (
              <tr key={unit.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.sample.sample_code}</td>
                <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.unit_code}</td>
                <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.sample.date_received}</td>
                <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.sample.company}</td>
                <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.sample.farm}</td>
                {visibleColumns.flock && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.sample.flock || '-'}</td>}
                {visibleColumns.cycle && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.sample.cycle || '-'}</td>}
                {visibleColumns.house && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.house?.join(', ') || '-'}</td>}
                {visibleColumns.age && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.age || '-'}</td>}
                {visibleColumns.sampleType && <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{unit.sample_type?.join(', ') || '-'}</td>}
                {allDiseases.map((disease) => {
                  const result = getDiseaseResult(unit.id, disease);
                  // If result is null, unit doesn't have this disease - show empty
                  if (result === null) {
                    return (
                      <td key={disease} className="px-4 py-2 border border-gray-300 text-center text-gray-400 whitespace-nowrap">-</td>
                    );
                  }
                  // Positive: Detected or Over Limit | Negative: Not Detected or Within Limit
                  const isPositive = result === 'Detected' || result === 'Over Limit';
                  return (
                    <td key={disease} className={`px-4 py-2 border border-gray-300 text-center font-semibold whitespace-nowrap ${isPositive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {result}
                    </td>
                  );
                })}
                <td className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap">
                  {getIsolateType(unit.id)}
                </td>
                <td className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap">
                  {getPositiveLocations(unit.id)}
                </td>
                <td className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap">
                  {unit.coa_status ? (
                    <Link
                      to={`/microbiology-coa/${unit.id}`}
                      state={{ fromDatabase: true, department: 'Microbiology' }}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      View
                    </Link>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Export</span>
            </button>
            {exportDropdownOpen && (
              <div className="absolute left-0 bottom-full mb-1 w-40 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div className="py-1">
                  <button
                    onClick={async () => {
                      setExportDropdownOpen(false);
                      
                      // Create progress bar overlay
                      const progressOverlay = document.createElement('div');
                      progressOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                      progressOverlay.innerHTML = `
                        <div class="bg-white rounded-lg p-6 shadow-xl min-w-[400px]">
                          <h3 class="text-lg font-semibold mb-4 text-gray-800">Exporting Microbiology Data...</h3>
                          <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
                            <div id="export-progress-bar" class="bg-green-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
                          </div>
                          <p id="export-progress-text" class="text-sm text-gray-600 text-center">Preparing export... 0%</p>
                        </div>
                      `;
                      document.body.appendChild(progressOverlay);
                      
                      const progressBar = document.getElementById('export-progress-bar');
                      const progressText = document.getElementById('export-progress-text');
                      
                      const updateProgress = (percent: number, message: string) => {
                        if (progressBar) progressBar.style.width = `${percent}%`;
                        if (progressText) progressText.textContent = `${message} ${Math.round(percent)}%`;
                      };
                      
                      await new Promise(resolve => setTimeout(resolve, 50));
                      updateProgress(5, 'Fetching all filtered data...');

                      // Fetch ALL filtered data for export (no pagination limit)
                      try {
                        const exportParams: any = { department_id: 3, limit: 100000 }; // Microbiology dept, high limit
                        // Apply same filters as current view
                        const response = await apiClient.get('/samples/', { params: exportParams });
                        const allExportSamples = response.data;
                        
                        // Extract all units from samples
                        const allExportUnits: Array<Unit & { sample: Sample }> = [];
                        allExportSamples.forEach((sample: Sample) => {
                          sample.units.forEach((unit: Unit) => {
                            allExportUnits.push({ ...unit, sample });
                          });
                        });
                        
                        updateProgress(20, 'Fetching COA results...');
                        
                        // Fetch COA data for all units
                        const unitIds = allExportUnits.map(u => u.id);
                        const batchSize = 100;
                        const exportCoaResults: Record<number, MicrobiologyCOAData | null> = {};
                        
                        for (let i = 0; i < unitIds.length; i += batchSize) {
                          const batchIds = unitIds.slice(i, i + batchSize);
                          try {
                            const coaResponse = await apiClient.get('/microbiology-coa/batch/', {
                              params: { unit_ids: batchIds.join(',') }
                            });
                            coaResponse.data.forEach((coa: MicrobiologyCOAData) => {
                              exportCoaResults[coa.unit_id] = coa;
                            });
                          } catch (e) {
                            console.error('Failed to fetch COA batch:', e);
                          }
                          const coaProgress = 20 + ((i / unitIds.length) * 30);
                          updateProgress(coaProgress, 'Fetching COA results...');
                        }
                        
                        updateProgress(50, 'Building Excel file...');

                        const wb = XLSX.utils.book_new();
                        const wsData: any[] = [];
                        const headers = ['Sample Code', 'Unit Code', 'Date Received', 'Company', 'Farm'];
                        if (visibleColumns.flock) headers.push('Flock');
                        if (visibleColumns.house) headers.push('House');
                        if (visibleColumns.age) headers.push('Age');
                        if (visibleColumns.sampleType) headers.push('Sample Type');
                        
                        // Get all diseases from export units
                        const exportDiseases = new Set<string>();
                        allExportUnits.forEach(unit => {
                          unit.microbiology_data?.diseases_list?.forEach(d => exportDiseases.add(d));
                        });
                        const sortedDiseases = Array.from(exportDiseases).sort();
                        sortedDiseases.forEach(d => headers.push(d));
                        headers.push('Type of Isolate', 'Location', 'COA Status');
                        wsData.push(headers);

                        // Helper functions for export
                        const getExportDiseaseResult = (unitId: number, disease: string, unit: Unit & { sample: Sample }): string | null => {
                          const unitDiseases = unit.microbiology_data?.diseases_list || [];
                          if (!unitDiseases.includes(disease)) return null;
                          const coa = exportCoaResults[unitId];
                          if (!coa?.test_results?.[disease]) return '-';
                          const results = coa.test_results[disease];
                          const allValues = Object.values(results);
                          const lowerDisease = disease.toLowerCase();
                          const sampleTypes = unit.sample_type || [];
                          const isFeed = sampleTypes.some(t => t.toLowerCase().includes('feed'));
                          
                          if (lowerDisease.includes('water')) {
                            let maxValue = 0;
                            let hasValue = false;
                            allValues.forEach(v => {
                              const num = parseNumericValue(v || '');
                              if (num !== null) { hasValue = true; maxValue = Math.max(maxValue, num); }
                            });
                            if (!hasValue) return 'Within Limit';
                            if (lowerDisease.includes('bacterial') || lowerDisease.includes('tbc')) {
                              return maxValue > 56 ? 'Over Limit' : 'Within Limit';
                            }
                            return maxValue > 1 ? 'Over Limit' : 'Within Limit';
                          }
                          if (lowerDisease.includes('total count')) {
                            let maxValue = 0;
                            let hasValue = false;
                            allValues.forEach(v => {
                              const num = parseNumericValue(v || '');
                              if (num !== null) { hasValue = true; maxValue = Math.max(maxValue, num); }
                            });
                            if (!hasValue) return 'Within Limit';
                            return isFeed ? (maxValue >= 100000 ? 'Over Limit' : 'Within Limit') : (maxValue > 1000 ? 'Over Limit' : 'Within Limit');
                          }
                          const hasPositive = allValues.some(v => {
                            const upper = v?.toUpperCase() || '';
                            return upper !== 'NOT DETECTED' && upper !== 'NEGATIVE' && upper !== '-' && upper !== '' && !upper.includes('LESS THAN');
                          });
                          return hasPositive ? 'Detected' : 'Not Detected';
                        };

                        const totalUnitsToExport = allExportUnits.length;
                        allExportUnits.forEach((unit, idx) => {
                          const row: any[] = [
                            unit.sample.sample_code,
                            unit.unit_code,
                            unit.sample.date_received,
                            unit.sample.company,
                            unit.sample.farm,
                          ];
                          if (visibleColumns.flock) row.push(unit.sample.flock || '-');
                          if (visibleColumns.house) row.push(unit.house?.join(', ') || '-');
                          if (visibleColumns.age) row.push(unit.age || '-');
                          if (visibleColumns.sampleType) row.push(unit.sample_type?.join(', ') || '-');
                          sortedDiseases.forEach(disease => {
                            const result = getExportDiseaseResult(unit.id, disease, unit);
                            row.push(result === null ? '-' : result);
                          });
                          
                          // Get isolate type and location from COA
                          const coa = exportCoaResults[unit.id];
                          let isolateTypes = '-';
                          let locations = '-';
                          if (coa?.test_results) {
                            const types = new Set<string>();
                            Object.values(coa.test_results).forEach((results: any) => {
                              Object.entries(results).forEach(([key, value]) => {
                                if (key.includes('isolate') && value && value !== '-') {
                                  types.add(String(value));
                                }
                              });
                            });
                            isolateTypes = types.size > 0 ? Array.from(types).join(', ') : '-';
                          }
                          row.push(isolateTypes);
                          row.push(locations);
                          row.push(unit.coa_status || '-');
                          wsData.push(row);
                          
                          if (idx % 50 === 0) {
                            const buildProgress = 50 + ((idx / totalUnitsToExport) * 40);
                            updateProgress(buildProgress, 'Building Excel file...');
                          }
                        });

                        updateProgress(90, 'Applying formatting...');
                        
                        const ws = XLSX.utils.aoa_to_sheet(wsData);
                        const diseaseStartCol = 5 + (visibleColumns.flock ? 1 : 0) + (visibleColumns.house ? 1 : 0) + (visibleColumns.age ? 1 : 0) + (visibleColumns.sampleType ? 1 : 0);
                        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
                        for (let R = 1; R <= range.e.r; ++R) {
                          for (let C = diseaseStartCol; C < diseaseStartCol + sortedDiseases.length; ++C) {
                            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                            const cell = ws[cellAddress];
                            if (cell && cell.v) {
                              const value = String(cell.v).toUpperCase();
                              if (value === 'DETECTED' || value === 'OVER LIMIT') {
                                cell.s = { fill: { patternType: 'solid', fgColor: { rgb: 'FFF8D7DA' } }, font: { color: { rgb: 'FFC82333' }, bold: true } };
                              } else if (value === 'NOT DETECTED' || value === 'WITHIN LIMIT') {
                                cell.s = { fill: { patternType: 'solid', fgColor: { rgb: 'FFD4EDDA' } }, font: { color: { rgb: 'FF155724' }, bold: true } };
                              }
                            }
                          }
                        }
                        
                        updateProgress(95, 'Saving file...');
                        XLSX.utils.book_append_sheet(wb, ws, 'Microbiology Results');
                        XLSX.writeFile(wb, `Microbiology_Database_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
                        
                        updateProgress(100, 'Complete!');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        document.body.removeChild(progressOverlay);
                        
                        const successToast = document.createElement('div');
                        successToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        successToast.textContent = `Successfully exported ${allExportUnits.length} rows!`;
                        document.body.appendChild(successToast);
                        setTimeout(() => document.body.removeChild(successToast), 3000);
                      } catch (error) {
                        console.error('Export failed:', error);
                        document.body.removeChild(progressOverlay);
                        const errorToast = document.createElement('div');
                        errorToast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        errorToast.textContent = 'Export failed. Please try again.';
                        document.body.appendChild(errorToast);
                        setTimeout(() => document.body.removeChild(errorToast), 3000);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={async () => {
                      setExportDropdownOpen(false);
                      
                      // Create progress bar overlay for CSV
                      const progressOverlay = document.createElement('div');
                      progressOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                      progressOverlay.innerHTML = `
                        <div class="bg-white rounded-lg p-6 shadow-xl min-w-[400px]">
                          <h3 class="text-lg font-semibold mb-4 text-gray-800">Exporting CSV Data...</h3>
                          <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
                            <div id="csv-progress-bar" class="bg-blue-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
                          </div>
                          <p id="csv-progress-text" class="text-sm text-gray-600 text-center">Preparing export... 0%</p>
                        </div>
                      `;
                      document.body.appendChild(progressOverlay);
                      
                      const progressBar = document.getElementById('csv-progress-bar');
                      const progressText = document.getElementById('csv-progress-text');
                      
                      const updateProgress = (percent: number, message: string) => {
                        if (progressBar) progressBar.style.width = `${percent}%`;
                        if (progressText) progressText.textContent = `${message} ${Math.round(percent)}%`;
                      };
                      
                      await new Promise(resolve => setTimeout(resolve, 50));
                      updateProgress(5, 'Fetching all data...');

                      try {
                        const exportParams: any = { department_id: 3, limit: 100000 };
                        const response = await apiClient.get('/samples/', { params: exportParams });
                        const allExportSamples = response.data;
                        
                        const allExportUnits: Array<Unit & { sample: Sample }> = [];
                        allExportSamples.forEach((sample: Sample) => {
                          sample.units.forEach((unit: Unit) => {
                            allExportUnits.push({ ...unit, sample });
                          });
                        });
                        
                        updateProgress(20, 'Fetching COA results...');
                        
                        const unitIds = allExportUnits.map(u => u.id);
                        const batchSize = 100;
                        const exportCoaResults: Record<number, MicrobiologyCOAData | null> = {};
                        
                        for (let i = 0; i < unitIds.length; i += batchSize) {
                          const batchIds = unitIds.slice(i, i + batchSize);
                          try {
                            const coaResponse = await apiClient.get('/microbiology-coa/batch/', {
                              params: { unit_ids: batchIds.join(',') }
                            });
                            coaResponse.data.forEach((coa: MicrobiologyCOAData) => {
                              exportCoaResults[coa.unit_id] = coa;
                            });
                          } catch (e) {
                            console.error('Failed to fetch COA batch:', e);
                          }
                          const coaProgress = 20 + ((i / unitIds.length) * 30);
                          updateProgress(coaProgress, 'Fetching COA results...');
                        }
                        
                        updateProgress(50, 'Building CSV file...');

                        const csvRows: string[] = [];
                        const headers = ['Sample Code', 'Unit Code', 'Date Received', 'Company', 'Farm'];
                        if (visibleColumns.flock) headers.push('Flock');
                        if (visibleColumns.house) headers.push('House');
                        if (visibleColumns.age) headers.push('Age');
                        if (visibleColumns.sampleType) headers.push('Sample Type');
                        
                        const exportDiseases = new Set<string>();
                        allExportUnits.forEach(unit => {
                          unit.microbiology_data?.diseases_list?.forEach(d => exportDiseases.add(d));
                        });
                        const sortedDiseases = Array.from(exportDiseases).sort();
                        sortedDiseases.forEach(d => headers.push(d));
                        headers.push('Type of Isolate', 'Location', 'COA Status');
                        csvRows.push(headers.join(','));

                        const getExportDiseaseResult = (unitId: number, disease: string, unit: Unit & { sample: Sample }): string | null => {
                          const unitDiseases = unit.microbiology_data?.diseases_list || [];
                          if (!unitDiseases.includes(disease)) return null;
                          const coa = exportCoaResults[unitId];
                          if (!coa?.test_results?.[disease]) return '-';
                          const results = coa.test_results[disease];
                          const allValues = Object.values(results);
                          const lowerDisease = disease.toLowerCase();
                          const sampleTypes = unit.sample_type || [];
                          const isFeed = sampleTypes.some(t => t.toLowerCase().includes('feed'));
                          
                          if (lowerDisease.includes('water')) {
                            let maxValue = 0;
                            let hasValue = false;
                            allValues.forEach(v => {
                              const num = parseNumericValue(v || '');
                              if (num !== null) { hasValue = true; maxValue = Math.max(maxValue, num); }
                            });
                            if (!hasValue) return 'Within Limit';
                            if (lowerDisease.includes('bacterial') || lowerDisease.includes('tbc')) {
                              return maxValue > 56 ? 'Over Limit' : 'Within Limit';
                            }
                            return maxValue > 1 ? 'Over Limit' : 'Within Limit';
                          }
                          if (lowerDisease.includes('total count')) {
                            let maxValue = 0;
                            let hasValue = false;
                            allValues.forEach(v => {
                              const num = parseNumericValue(v || '');
                              if (num !== null) { hasValue = true; maxValue = Math.max(maxValue, num); }
                            });
                            if (!hasValue) return 'Within Limit';
                            return isFeed ? (maxValue >= 100000 ? 'Over Limit' : 'Within Limit') : (maxValue > 1000 ? 'Over Limit' : 'Within Limit');
                          }
                          const hasPositive = allValues.some(v => {
                            const upper = v?.toUpperCase() || '';
                            return upper !== 'NOT DETECTED' && upper !== 'NEGATIVE' && upper !== '-' && upper !== '' && !upper.includes('LESS THAN');
                          });
                          return hasPositive ? 'Detected' : 'Not Detected';
                        };

                        const totalUnitsToExport = allExportUnits.length;
                        allExportUnits.forEach((unit, idx) => {
                          const row: string[] = [
                            unit.sample.sample_code,
                            unit.unit_code,
                            unit.sample.date_received,
                            unit.sample.company,
                            unit.sample.farm,
                          ];
                          if (visibleColumns.flock) row.push(unit.sample.flock || '-');
                          if (visibleColumns.house) row.push(`"${unit.house?.join(', ') || '-'}"`);
                          if (visibleColumns.age) row.push(String(unit.age || '-'));
                          if (visibleColumns.sampleType) row.push(`"${unit.sample_type?.join(', ') || '-'}"`);
                          sortedDiseases.forEach(disease => {
                            const result = getExportDiseaseResult(unit.id, disease, unit);
                            row.push(result === null ? '-' : result);
                          });
                          row.push('-'); // Isolate type placeholder
                          row.push('-'); // Location placeholder
                          row.push(unit.coa_status || '-');
                          csvRows.push(row.join(','));
                          
                          if (idx % 50 === 0) {
                            const buildProgress = 50 + ((idx / totalUnitsToExport) * 45);
                            updateProgress(buildProgress, 'Building CSV file...');
                          }
                        });

                        updateProgress(95, 'Saving file...');
                        const csvContent = csvRows.join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.setAttribute('href', URL.createObjectURL(blob));
                        link.setAttribute('download', `Microbiology_Database_Export_${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        updateProgress(100, 'Complete!');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        document.body.removeChild(progressOverlay);
                        
                        const successToast = document.createElement('div');
                        successToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        successToast.textContent = `Successfully exported ${allExportUnits.length} rows!`;
                        document.body.appendChild(successToast);
                        setTimeout(() => document.body.removeChild(successToast), 3000);
                      } catch (error) {
                        console.error('CSV Export failed:', error);
                        document.body.removeChild(progressOverlay);
                        const errorToast = document.createElement('div');
                        errorToast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        errorToast.textContent = 'Export failed. Please try again.';
                        document.body.appendChild(errorToast);
                        setTimeout(() => document.body.removeChild(errorToast), 3000);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    CSV (.csv)
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-700">
            Showing <span className="font-semibold">{totalUnits}</span> records
            {totalUnits === 100 && <span className="text-gray-500 ml-2">(Page {page})</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onPageChange(1)} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&laquo;</button>
          <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&lsaquo;</button>
          {(() => {
            const itemsPerPage = 100;
            const totalPages = Math.max(1, Math.ceil(totalUnits / itemsPerPage) + (totalUnits === itemsPerPage ? page : page - 1));
            const pagesToShow = [];
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(totalPages, page + 2);
            for (let i = startPage; i <= endPage; i++) {
              pagesToShow.push(i);
            }
            return pagesToShow.map(pageNum => (
              <button key={pageNum} onClick={() => onPageChange(pageNum)} className={`px-3 py-1 border rounded text-sm ${page === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>{pageNum}</button>
            ));
          })()}
          <button onClick={() => onPageChange(page + 1)} disabled={totalUnits < 100} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&rsaquo;</button>
          <button onClick={() => onPageChange(page + 10)} disabled={totalUnits < 100} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&raquo;</button>
        </div>
      </div>
    </div>
  );
}

function SerologyTable({
  units,
  totalUnits,
  visibleColumns,
  page,
  onPageChange,
}: {
  units: Array<Unit & { sample: Sample }>;
  totalUnits: number;
  visibleColumns: Record<string, boolean>;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [uploadingUnits, setUploadingUnits] = useState<Set<number>>(new Set());
  const [uploadResults, setUploadResults] = useState<Record<number, { success: boolean; message: string; canRetry?: boolean }>>({});
  const [selectedUnitForUpload, setSelectedUnitForUpload] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle PDF upload for a unit
  const handlePdfUpload = async (unitId: number, files: FileList) => {
    if (files.length === 0) return;
    
    setUploadingUnits(prev => new Set(prev).add(unitId));
    // Clear any previous error for this unit
    setUploadResults(prev => {
      const newResults = { ...prev };
      delete newResults[unitId];
      return newResults;
    });
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          setUploadResults(prev => ({
            ...prev,
            [unitId]: { success: false, message: 'Only PDF files are allowed', canRetry: true }
          }));
          continue;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        await apiClient.post(`/serology-coa/upload/${unitId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      setUploadResults(prev => ({
        ...prev,
        [unitId]: { success: true, message: 'COA uploaded & data extracted' }
      }));
      
      // Refresh data to show extracted values
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      
      // Clear success result after 3 seconds
      setTimeout(() => {
        setUploadResults(prev => {
          const newResults = { ...prev };
          if (newResults[unitId]?.success) {
            delete newResults[unitId];
          }
          return newResults;
        });
      }, 3000);
      
    } catch (error: any) {
      setUploadResults(prev => ({
        ...prev,
        [unitId]: { success: false, message: error.response?.data?.detail || 'Upload failed', canRetry: true }
      }));
    } finally {
      setUploadingUnits(prev => {
        const newSet = new Set(prev);
        newSet.delete(unitId);
        return newSet;
      });
    }
  };

  // Trigger file input for specific unit
  const triggerUpload = (unitId: number) => {
    setSelectedUnitForUpload(unitId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle file selection from hidden input
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && selectedUnitForUpload !== null) {
      handlePdfUpload(selectedUnitForUpload, e.target.files);
    }
    setSelectedUnitForUpload(null);
  };

  // Get COA file ID for a unit (from first disease with coa_file_id)
  const getCoaFileId = (unit: Unit): number | null => {
    const diseases = unit.serology_data?.diseases_list || [];
    for (const d of diseases) {
      if (d.coa_file_id) return d.coa_file_id;
    }
    return null;
  };

  // Open PDF in new tab with authentication
  const openPdfInBrowser = async (fileId: number) => {
    try {
      const response = await apiClient.get(`/drive/${fileId}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Cleanup after a delay to allow the browser to load the PDF
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error('Failed to open PDF:', error);
      alert('Failed to open PDF. Please try again.');
    }
  };

  // Expand units into rows per disease for Serology
  const expandedRows = useMemo(() => {
    const rows: Array<{
      unit: Unit & { sample: Sample };
      disease: string;
      kitType: string;
      isFirstRow: boolean;
      rowSpan: number;
      mean: number | null;
      cv: number | null;
      min: number | null;
      max: number | null;
      hasCoa: boolean;
    }> = [];

    units.forEach(unit => {
      const diseases = unit.serology_data?.diseases_list || [];
      if (diseases.length === 0) {
        rows.push({
          unit,
          disease: '-',
          kitType: '-',
          isFirstRow: true,
          rowSpan: 1,
          mean: null,
          cv: null,
          min: null,
          max: null,
          hasCoa: false
        });
      } else {
        diseases.forEach((d: any, idx: number) => {
          rows.push({
            unit,
            disease: d.disease,
            kitType: d.kit_type || '-',
            isFirstRow: idx === 0,
            rowSpan: diseases.length,
            mean: d.mean ?? null,
            cv: d.cv ?? null,
            min: d.min ?? null,
            max: d.max ?? null,
            hasCoa: d.coa_file_id ? true : false
          });
        });
      }
    });

    return rows;
  }, [units]);

  // Show empty state if no data
  if (units.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No Serology samples found. Try adjusting your filters or check if there are Serology samples in the system.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
      {/* Hidden file input for PDF uploads */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Sample Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Unit Code</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Date Received</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Company</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Farm</th>
              {visibleColumns.flock && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Flock</th>}
              {visibleColumns.cycle && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Cycle</th>}
              {visibleColumns.house && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">House</th>}
              {visibleColumns.age && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Age</th>}
              {visibleColumns.source && <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">Source</th>}
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-blue-50 whitespace-nowrap">Disease</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 border border-gray-300 bg-blue-50 whitespace-nowrap">Kit Type</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-blue-50 whitespace-nowrap">Mean</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-blue-50 whitespace-nowrap">CV%</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-blue-50 whitespace-nowrap">Min</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-blue-50 whitespace-nowrap">Max</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700 border border-gray-300 bg-gray-50 whitespace-nowrap">COA</th>
            </tr>
          </thead>
          <tbody>
            {expandedRows.map((row, idx) => (
              <tr key={`${row.unit.id}-${row.disease}-${idx}`} className="hover:bg-gray-50">
                {row.isFirstRow && (
                  <>
                    <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.sample.sample_code}</td>
                    <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.unit_code}</td>
                    <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.sample.date_received}</td>
                    <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.sample.company}</td>
                    <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.sample.farm}</td>
                    {visibleColumns.flock && <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.sample.flock || '-'}</td>}
                    {visibleColumns.cycle && <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.sample.cycle || '-'}</td>}
                    {visibleColumns.house && <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.house?.join(', ') || '-'}</td>}
                    {visibleColumns.age && <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{row.unit.age || '-'}</td>}
                    {visibleColumns.source && <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 whitespace-nowrap align-middle text-center">{Array.isArray(row.unit.source) ? row.unit.source.join(', ') : (row.unit.source || '-')}</td>}
                  </>
                )}
                <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.disease}</td>
                <td className="px-4 py-2 border border-gray-300 whitespace-nowrap">{row.kitType}</td>
                <td className={`px-4 py-2 border border-gray-300 text-center whitespace-nowrap ${row.mean !== null ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                  {row.mean !== null ? row.mean.toLocaleString() : '-'}
                </td>
                <td className={`px-4 py-2 border border-gray-300 text-center whitespace-nowrap ${row.cv !== null ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                  {row.cv !== null ? `${row.cv}%` : '-'}
                </td>
                <td className={`px-4 py-2 border border-gray-300 text-center whitespace-nowrap ${row.min !== null ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                  {row.min !== null ? row.min.toLocaleString() : '-'}
                </td>
                <td className={`px-4 py-2 border border-gray-300 text-center whitespace-nowrap ${row.max !== null ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                  {row.max !== null ? row.max.toLocaleString() : '-'}
                </td>
                {row.isFirstRow && (
                  <td rowSpan={row.rowSpan} className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap align-middle">
                    <div className="flex flex-col items-center gap-1">
                      {/* Show uploading state */}
                      {uploadingUnits.has(row.unit.id) ? (
                        <div className="flex items-center gap-2 text-purple-600">
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-xs">Uploading...</span>
                        </div>
                      ) : uploadResults[row.unit.id] ? (
                        // Show upload result with retry option for failures
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs ${uploadResults[row.unit.id].success ? 'text-green-600' : 'text-red-600'}`}>
                            {uploadResults[row.unit.id].message}
                          </span>
                          {uploadResults[row.unit.id].canRetry && (
                            <button
                              onClick={() => triggerUpload(row.unit.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Retry Upload
                            </button>
                          )}
                        </div>
                      ) : (
                        // Show Visit Link + Upload button side by side
                        <div className="flex items-center justify-center gap-2">
                          {row.hasCoa ? (
                            <>
                              <button
                                onClick={() => {
                                  const fileId = getCoaFileId(row.unit);
                                  if (fileId) {
                                    openPdfInBrowser(fileId);
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-800 underline text-xs flex items-center gap-1 cursor-pointer"
                                title={`Open ${row.unit.sample.sample_code}_${row.unit.unit_code} COA`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                {row.unit.sample.sample_code}_{row.unit.unit_code}
                              </button>
                              <button
                                onClick={() => triggerUpload(row.unit.id)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                                title="Upload/Replace COA PDF"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => triggerUpload(row.unit.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                              title="Upload COA PDF"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Upload
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Export</span>
            </button>
            {exportDropdownOpen && (
              <div className="absolute left-0 bottom-full mb-1 w-40 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div className="py-1">
                  <button
                    onClick={async () => {
                      setExportDropdownOpen(false);
                      
                      // Create progress bar overlay
                      const progressOverlay = document.createElement('div');
                      progressOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                      progressOverlay.innerHTML = `
                        <div class="bg-white rounded-lg p-6 shadow-xl min-w-[400px]">
                          <h3 class="text-lg font-semibold mb-4 text-gray-800">Exporting Serology Data...</h3>
                          <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
                            <div id="serology-excel-progress-bar" class="bg-purple-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
                          </div>
                          <p id="serology-excel-progress-text" class="text-sm text-gray-600 text-center">Preparing export... 0%</p>
                        </div>
                      `;
                      document.body.appendChild(progressOverlay);
                      
                      const progressBar = document.getElementById('serology-excel-progress-bar');
                      const progressText = document.getElementById('serology-excel-progress-text');
                      
                      const updateProgress = (percent: number, message: string) => {
                        if (progressBar) progressBar.style.width = `${percent}%`;
                        if (progressText) progressText.textContent = `${message} ${Math.round(percent)}%`;
                      };
                      
                      await new Promise(resolve => setTimeout(resolve, 50));
                      
                      try {
                        updateProgress(10, 'Fetching all data...');
                        
                        // Fetch ALL serology data for export
                        const exportParams: any = { department_id: 2, limit: 100000 }; // Serology dept
                        const response = await apiClient.get('/samples/', { params: exportParams });
                        const allExportSamples = response.data;
                        
                        const allExportUnits: Array<Unit & { sample: Sample }> = [];
                        allExportSamples.forEach((sample: Sample) => {
                          sample.units.forEach((unit: Unit) => {
                            allExportUnits.push({ ...unit, sample });
                          });
                        });
                        
                        updateProgress(30, 'Building Excel file...');

                        const wb = XLSX.utils.book_new();
                        const wsData: any[] = [];
                        const headers = ['Sample Code', 'Unit Code', 'Date Received', 'Company', 'Farm'];
                        if (visibleColumns.flock) headers.push('Flock');
                        if (visibleColumns.cycle) headers.push('Cycle');
                        if (visibleColumns.house) headers.push('House');
                        if (visibleColumns.age) headers.push('Age');
                        if (visibleColumns.source) headers.push('Source');
                        headers.push('Disease', 'Kit Type', 'Mean', 'CV%', 'Min', 'Max', 'COA Status');
                        wsData.push(headers);

                        const allExpandedRows: Array<{unit: Unit & { sample: Sample }; disease: string; kitType: string; isFirstRow: boolean; rowSpan: number}> = [];
                        const totalUnits = allExportUnits.length;
                        
                        allExportUnits.forEach((unit, idx) => {
                          const diseases = unit.serology_data?.diseases_list || [];
                          if (diseases.length === 0) {
                            allExpandedRows.push({ unit, disease: '-', kitType: '-', isFirstRow: true, rowSpan: 1 });
                          } else {
                            diseases.forEach((d, didx) => {
                              allExpandedRows.push({ unit, disease: d.disease, kitType: d.kit_type || '-', isFirstRow: didx === 0, rowSpan: diseases.length });
                            });
                          }
                          if (idx % 100 === 0) {
                            const progress = 30 + ((idx / totalUnits) * 40);
                            updateProgress(progress, 'Building Excel file...');
                          }
                        });

                        allExpandedRows.forEach((row) => {
                          const dataRow: any[] = [
                            row.unit.sample.sample_code,
                            row.unit.unit_code,
                            row.unit.sample.date_received,
                            row.unit.sample.company,
                            row.unit.sample.farm,
                          ];
                          if (visibleColumns.flock) dataRow.push(row.unit.sample.flock || '-');
                          if (visibleColumns.cycle) dataRow.push(row.unit.sample.cycle || '-');
                          if (visibleColumns.house) dataRow.push(row.unit.house?.join(', ') || '-');
                          if (visibleColumns.age) dataRow.push(row.unit.age || '-');
                          if (visibleColumns.source) dataRow.push(row.unit.source || '-');
                          dataRow.push(row.disease, row.kitType, '-', '-', '-', '-', row.unit.coa_status || '-');
                          wsData.push(dataRow);
                        });

                        updateProgress(75, 'Applying formatting...');
                        const ws = XLSX.utils.aoa_to_sheet(wsData);
                        
                        const merges: XLSX.Range[] = [];
                        let currentRow = 1;
                        allExportUnits.forEach(unit => {
                          const diseases = unit.serology_data?.diseases_list || [];
                          const rowSpan = diseases.length > 0 ? diseases.length : 1;
                          if (rowSpan > 1) {
                            const baseColCount = 5 + (visibleColumns.flock ? 1 : 0) + (visibleColumns.cycle ? 1 : 0) + (visibleColumns.house ? 1 : 0) + (visibleColumns.age ? 1 : 0) + (visibleColumns.source ? 1 : 0);
                            for (let col = 0; col < baseColCount; col++) {
                              merges.push({ s: { r: currentRow, c: col }, e: { r: currentRow + rowSpan - 1, c: col } });
                            }
                            const coaCol = baseColCount + 6;
                            merges.push({ s: { r: currentRow, c: coaCol }, e: { r: currentRow + rowSpan - 1, c: coaCol } });
                          }
                          currentRow += rowSpan;
                        });
                        ws['!merges'] = merges;

                        updateProgress(90, 'Saving file...');
                        XLSX.utils.book_append_sheet(wb, ws, 'Serology Results');
                        XLSX.writeFile(wb, `Serology_Database_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
                        
                        updateProgress(100, 'Complete!');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        document.body.removeChild(progressOverlay);
                        
                        const successToast = document.createElement('div');
                        successToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        successToast.textContent = `Successfully exported ${allExportUnits.length} units (${allExpandedRows.length} rows)!`;
                        document.body.appendChild(successToast);
                        setTimeout(() => document.body.removeChild(successToast), 3000);
                      } catch (error) {
                        console.error('Export failed:', error);
                        document.body.removeChild(progressOverlay);
                        const errorToast = document.createElement('div');
                        errorToast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        errorToast.textContent = 'Export failed. Please try again.';
                        document.body.appendChild(errorToast);
                        setTimeout(() => document.body.removeChild(errorToast), 3000);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={async () => {
                      setExportDropdownOpen(false);
                      
                      // Create progress bar overlay for CSV
                      const progressOverlay = document.createElement('div');
                      progressOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                      progressOverlay.innerHTML = `
                        <div class="bg-white rounded-lg p-6 shadow-xl min-w-[400px]">
                          <h3 class="text-lg font-semibold mb-4 text-gray-800">Exporting Serology CSV...</h3>
                          <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
                            <div id="serology-csv-progress-bar" class="bg-purple-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
                          </div>
                          <p id="serology-csv-progress-text" class="text-sm text-gray-600 text-center">Preparing export... 0%</p>
                        </div>
                      `;
                      document.body.appendChild(progressOverlay);
                      
                      const progressBar = document.getElementById('serology-csv-progress-bar');
                      const progressText = document.getElementById('serology-csv-progress-text');
                      
                      const updateProgress = (percent: number, message: string) => {
                        if (progressBar) progressBar.style.width = `${percent}%`;
                        if (progressText) progressText.textContent = `${message} ${Math.round(percent)}%`;
                      };
                      
                      await new Promise(resolve => setTimeout(resolve, 50));
                      
                      try {
                        updateProgress(10, 'Fetching all data...');
                        
                        const exportParams: any = { department_id: 2, limit: 100000 };
                        const response = await apiClient.get('/samples/', { params: exportParams });
                        const allExportSamples = response.data;
                        
                        const allExportUnits: Array<Unit & { sample: Sample }> = [];
                        allExportSamples.forEach((sample: Sample) => {
                          sample.units.forEach((unit: Unit) => {
                            allExportUnits.push({ ...unit, sample });
                          });
                        });
                        
                        updateProgress(30, 'Building CSV file...');

                        const csvRows: string[] = [];
                        const headers = ['Sample Code', 'Unit Code', 'Date Received', 'Company', 'Farm'];
                        if (visibleColumns.flock) headers.push('Flock');
                        if (visibleColumns.cycle) headers.push('Cycle');
                        if (visibleColumns.house) headers.push('House');
                        if (visibleColumns.age) headers.push('Age');
                        if (visibleColumns.source) headers.push('Source');
                        headers.push('Disease', 'Kit Type', 'Mean', 'CV%', 'Min', 'Max', 'COA Status');
                        csvRows.push(headers.join(','));

                        const totalUnitsExport = allExportUnits.length;
                        allExportUnits.forEach((unit, idx) => {
                          const diseases = unit.serology_data?.diseases_list || [];
                          if (diseases.length === 0) {
                            const row: string[] = [
                              unit.sample.sample_code, unit.unit_code, unit.sample.date_received, unit.sample.company, unit.sample.farm,
                            ];
                            if (visibleColumns.flock) row.push(unit.sample.flock || '-');
                            if (visibleColumns.cycle) row.push(unit.sample.cycle || '-');
                            if (visibleColumns.house) row.push(`"${unit.house?.join(', ') || '-'}"`);
                            if (visibleColumns.age) row.push(String(unit.age || '-'));
                            if (visibleColumns.source) row.push(Array.isArray(unit.source) ? unit.source.join(', ') : (unit.source || '-'));
                            row.push('-', '-', '-', '-', '-', '-', unit.coa_status || '-');
                            csvRows.push(row.join(','));
                          } else {
                            diseases.forEach(d => {
                              const row: string[] = [
                                unit.sample.sample_code, unit.unit_code, unit.sample.date_received, unit.sample.company, unit.sample.farm,
                              ];
                              if (visibleColumns.flock) row.push(unit.sample.flock || '-');
                              if (visibleColumns.cycle) row.push(unit.sample.cycle || '-');
                              if (visibleColumns.house) row.push(`"${unit.house?.join(', ') || '-'}"`);
                              if (visibleColumns.age) row.push(String(unit.age || '-'));
                              if (visibleColumns.source) row.push(Array.isArray(unit.source) ? unit.source.join(', ') : (unit.source || '-'));
                              row.push(d.disease, d.kit_type || '-', '-', '-', '-', '-', unit.coa_status || '-');
                              csvRows.push(row.join(','));
                            });
                          }
                          if (idx % 100 === 0) {
                            const progress = 30 + ((idx / totalUnitsExport) * 60);
                            updateProgress(progress, 'Building CSV file...');
                          }
                        });

                        updateProgress(95, 'Saving file...');
                        const csvContent = csvRows.join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.setAttribute('href', URL.createObjectURL(blob));
                        link.setAttribute('download', `Serology_Database_Export_${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        updateProgress(100, 'Complete!');
                        await new Promise(resolve => setTimeout(resolve, 500));
                        document.body.removeChild(progressOverlay);
                        
                        const successToast = document.createElement('div');
                        successToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        successToast.textContent = `Successfully exported ${allExportUnits.length} units!`;
                        document.body.appendChild(successToast);
                        setTimeout(() => document.body.removeChild(successToast), 3000);
                      } catch (error) {
                        console.error('CSV Export failed:', error);
                        document.body.removeChild(progressOverlay);
                        const errorToast = document.createElement('div');
                        errorToast.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                        errorToast.textContent = 'Export failed. Please try again.';
                        document.body.appendChild(errorToast);
                        setTimeout(() => document.body.removeChild(errorToast), 3000);
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    CSV (.csv)
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-700">
            Showing <span className="font-semibold">{totalUnits}</span> records
            {totalUnits === 100 && <span className="text-gray-500 ml-2">(Page {page})</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onPageChange(1)} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&laquo;</button>
          <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&lsaquo;</button>
          {(() => {
            const itemsPerPage = 100;
            const totalPages = Math.max(1, Math.ceil(totalUnits / itemsPerPage) + (totalUnits === itemsPerPage ? page : page - 1));
            const pagesToShow = [];
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(totalPages, page + 2);
            for (let i = startPage; i <= endPage; i++) {
              pagesToShow.push(i);
            }
            return pagesToShow.map(pageNum => (
              <button key={pageNum} onClick={() => onPageChange(pageNum)} className={`px-3 py-1 border rounded text-sm ${page === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>{pageNum}</button>
            ));
          })()}
          <button onClick={() => onPageChange(page + 1)} disabled={totalUnits < 100} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&rsaquo;</button>
          <button onClick={() => onPageChange(page + 10)} disabled={totalUnits < 100} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&raquo;</button>
        </div>
      </div>
    </div>
  );
}
