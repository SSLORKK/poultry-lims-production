import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../../../hooks/usePermissions';
import { PCRDatabaseTable } from './PCRDatabaseTable';
import { MicrobiologyDatabaseTable } from './MicrobiologyDatabaseTable';
import { SerologyDatabaseTable } from './SerologyDatabaseTable';
import { Sample, Unit, Department, DEPARTMENT_IDS } from '../types';

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
  const [selectedCycles, setSelectedCycles] = useState<string[]>(persistedFilters?.cycles || []);
  const [selectedSources, setSelectedSources] = useState<string[]>(persistedFilters?.sources || []);
  const [selectedSerologyDiseases, setSelectedSerologyDiseases] = useState<string[]>(persistedFilters?.serologyDiseases || []);
  const [selectedSerologyKitTypes, setSelectedSerologyKitTypes] = useState<string[]>(persistedFilters?.serologyKitTypes || []);
  const [selectedMicrobiologyDiseases, setSelectedMicrobiologyDiseases] = useState<string[]>(persistedFilters?.microbiologyDiseases || []);
  const [selectedMicrobiologyResults, setSelectedMicrobiologyResults] = useState<string[]>(persistedFilters?.microbiologyResults || []);
  const [selectedPCRDiseases, setSelectedPCRDiseases] = useState<string[]>(persistedFilters?.pcrDiseases || []);
  const [selectedPCRResults, setSelectedPCRResults] = useState<string[]>(persistedFilters?.pcrResults || []);

  // Memoize filters object to pass to child components
  const filters = useMemo(() => ({
    resultsFilter,
    diseases: selectedDiseases,
    ages: selectedAges,
    dateFrom,
    dateTo,
    companies: selectedCompanies,
    farms: selectedFarms,
    flocks: selectedFlocks,
    sampleTypes: selectedSampleTypes,
    cycles: selectedCycles,
    sources: selectedSources,
    serologyDiseases: selectedSerologyDiseases,
    serologyKitTypes: selectedSerologyKitTypes,
    microbiologyDiseases: selectedMicrobiologyDiseases,
    microbiologyResults: selectedMicrobiologyResults,
    pcrDiseases: selectedPCRDiseases,
    pcrResults: selectedPCRResults
  }), [
    resultsFilter, selectedDiseases, selectedAges, dateFrom, dateTo,
    selectedCompanies, selectedFarms, selectedFlocks, selectedSampleTypes,
    selectedCycles, selectedSources, selectedSerologyDiseases,
    selectedSerologyKitTypes, selectedMicrobiologyDiseases, selectedMicrobiologyResults,
    selectedPCRDiseases, selectedPCRResults
  ]);

  // Persist filters to localStorage when they change
  useEffect(() => {
    localStorage.setItem('database_filters', JSON.stringify(filters));
  }, [filters]);
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('database_page');
    return saved ? parseInt(saved) : 1;
  });
  const [totalCount, setTotalCount] = useState(0);
  const [lastPageLoaded, setLastPageLoaded] = useState(false);
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

  // Fetch total count and navigate to last page on initial load
  useEffect(() => {
    const fetchTotalAndGoToLastPage = async () => {
      try {
        const response = await apiClient.get('/samples/total-count', { 
          params: { department_id: DEPARTMENT_IDS[activeTab] } 
        });
        const total = response.data.total || 0;
        setTotalCount(total);
        
        if (!lastPageLoaded && !localStorage.getItem('database_page')) {
          const lastPage = Math.max(1, Math.ceil(total / pageSize));
          setPage(lastPage);
        }
        setLastPageLoaded(true);
      } catch (err) {
        console.error('Failed to fetch total count:', err);
        setLastPageLoaded(true);
      }
    };
    fetchTotalAndGoToLastPage();
  }, [activeTab]);

  // Save page to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('database_page', String(page));
  }, [page]);

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
      const response = await apiClient.get('/samples/filter-options', { params });
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

      const response = await apiClient.get('/samples/', { params });

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

    // Sort by unit code ascending (oldest first - same as sample screens)
    return units.sort((a, b) => {
      const aNum = parseInt(a.unit_code.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.unit_code.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });
  }, [unitsBeforeAgeFilter, activeTab, selectedCycles, selectedSources, selectedSerologyDiseases, selectedSerologyKitTypes, selectedMicrobiologyDiseases, selectedPCRDiseases]);


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
    selectedCycles.length,
    selectedSources.length,
    selectedSerologyDiseases.length,
    selectedSerologyKitTypes.length,
    selectedMicrobiologyDiseases.length,
    selectedMicrobiologyResults.length,
    selectedPCRDiseases.length,
    selectedPCRResults.length
  ].reduce((a, b) => a + b, 0);

  // Effective total count for pagination - use filtered count when filters are applied
  const effectiveTotalCount = activeFilterCount > 0 ? filteredUnits.length : totalCount;

  // Show message if user has no database permissions
  if (allowedDepartments.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">You do not have permission to access any database.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header with Tabs and Buttons */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex gap-1 sm:gap-4 overflow-x-auto pb-1 -mb-px">
            {allowedDepartments.map((dept) => (
              <button
                key={dept}
                onClick={() => {
                  setActiveTab(dept);
                }}
                className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === dept
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Filter & Columns Buttons - Icon only */}
          <div className="flex items-center gap-2 sm:gap-3 pb-2">
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className="flex items-center gap-1 p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors relative"
              title="Filters"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              <svg className={`w-3 h-3 transition-transform ${filterPanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className="relative" ref={columnsDropdownRef}>
              <button
                onClick={() => setColumnsDropdownOpen(!columnsDropdownOpen)}
                className="flex items-center gap-1 p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Columns"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
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

          <PCRDatabaseTable
            units={filteredUnits}
            totalUnits={filteredUnits.length}
            totalCount={effectiveTotalCount}
            diseases={pcrColumns}
            renderCTCell={renderCTCell}
            selectedSampleTypes={selectedSampleTypes}
            resultsFilter={resultsFilter}
            visibleColumns={visibleColumns}
            page={page}
            onPageChange={setPage}
            filters={filters}
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
            <MicrobiologyDatabaseTable
              units={filteredUnits}
              totalUnits={filteredUnits.length}
              totalCount={effectiveTotalCount}
              visibleColumns={visibleColumns}
              page={page}
              onPageChange={setPage}
              selectedMicrobiologyResults={selectedMicrobiologyResults}
              filters={filters}
            />
          ) : (
            <SerologyDatabaseTable
              units={filteredUnits}
              totalUnits={filteredUnits.length}
              totalCount={effectiveTotalCount}
              visibleColumns={visibleColumns}
              page={page}
              onPageChange={setPage}
              filters={filters}
            />
          )}
        </>
      )}
    </div>
  );
}
