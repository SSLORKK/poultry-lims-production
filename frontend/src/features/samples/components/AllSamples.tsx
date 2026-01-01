import { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { apiClient } from '../../../services/apiClient';
import { NotesDialog } from '../../../components/NotesDialog';
import { usePermissions } from '../../../hooks/usePermissions';
import { ApiErrorDisplay } from '../../../components/common/ApiErrorDisplay';
import * as XLSX from 'xlsx-js-style';

interface UnitRow {
  sampleId: number;
  sampleCode: string;
  unitId: number;
  unitCode: string;
  dateReceived: string;
  company: string;
  farm: string;
  flock: string;
  cycle: string;
  house: string;
  age: string | null;  // Changed from number to string
  source: string;
  technician: string;
  notes: string;
  sampleType: string;
  status: string;
  samplesNumber: number | null;
  subSamplesNumber: number | null;
  testsCount: number | null;
  department: string;
  coaStatus: string | null;
}

export const AllSamples = () => {
  const { canRead, isLoading: permissionsLoading } = usePermissions();
  const hasReadAccess = canRead('All Samples');

  // Check permission - redirect if no access
  if (!permissionsLoading && !hasReadAccess) {
    return <Navigate to="/" replace />;
  }

  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);  // Only true on first load
  const [error, setError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; note: string }>({
    open: false,
    note: '',
  });
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; type: 'success' | 'error'; message: string }>>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  // Suppress unused variable warning - toasts are used in JSX
  void toasts;

  // Multi-select filter states (matching PCRSamples pattern)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedFarms, setSelectedFarms] = useState<string[]>([]);
  const [selectedFlocks, setSelectedFlocks] = useState<string[]>([]);
  const [selectedAges, setSelectedAges] = useState<string[]>([]);
  const [selectedSampleTypes, setSelectedSampleTypes] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedHouses, setSelectedHouses] = useState<string[]>([]);
  const [selectedCycles, setSelectedCycles] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Date range filters
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const fetchAvailableYears = async () => {
    try {
      const response = await apiClient.get('/samples/available-years');
      const years = response.data.years || [];
      setAvailableYears(years);
      // Auto-select the most recent year with data if current year has no data
      if (years.length > 0 && !years.includes(selectedYear)) {
        setSelectedYear(years[0]); // First year is most recent (sorted DESC)
      }
    } catch (err) {
      console.error('Failed to load available years:', err);
    }
  };

  const fetchSamples = async () => {
    try {
      setLoading(true);

      // Build filter params for backend
      const params: any = {
        year: selectedYear,
        skip: (page - 1) * 100,  // Backend pagination: skip records based on page
        limit: 100,              // Fetch 100 records at a time
      };

      // Add global search parameter - searches across all pages!
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      // Add date range filters
      if (dateFrom) {
        params.date_from = dateFrom;
      }
      if (dateTo) {
        params.date_to = dateTo;
      }

      // Add multi-select filters to backend params  
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

      console.log('All Samples API Request:', params);
      const response = await apiClient.get('/samples/', { params });
      console.log('All Samples API Response:', response.data.length, 'samples');
      setSamples(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load samples:', err);
      // Capture detailed error information
      const errorData = err.response?.data;
      let errorMessage = 'Failed to load samples';
      
      if (errorData) {
        if (errorData.message) {
          errorMessage = `${errorData.error_type || 'Error'}: ${errorData.message}`;
          if (errorData.location) {
            errorMessage += ` (${errorData.location})`;
          }
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setInitialLoading(false);  // After first load, never show skeleton again
    }
  };

  useEffect(() => {
    fetchAvailableYears();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalSearch);
      setPage(1); // Reset to first page when searching
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  useEffect(() => {
    fetchSamples();
  }, [selectedYear, selectedCompanies, selectedFarms, selectedFlocks, selectedAges, selectedSampleTypes, dateFrom, dateTo, page, debouncedSearch]);

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

  const unitRows: UnitRow[] = useMemo(() => {
    const rows: UnitRow[] = [];
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        const departmentName = unit.department_id === 1 ? 'PCR' :
          unit.department_id === 2 ? 'Serology' :
            unit.department_id === 3 ? 'Microbiology' : 'Unknown';

        // Calculate samples, sub-samples, and tests based on department
        let samplesCount: number | null = null;
        let subSamplesCount: number | null = null;
        let testsCount: number | null = null;

        if (unit.department_id === 1) {
          // PCR: samples = 1 per unit, sub-samples = extraction, tests = detection
          samplesCount = 1;
          subSamplesCount = unit.pcr_data?.extraction || null;
          testsCount = unit.pcr_data?.detection || null;
        } else if (unit.department_id === 2) {
          // Serology: samples = samples_number, sub-samples = null, tests = sum of disease test_counts
          samplesCount = unit.samples_number || null;
          subSamplesCount = null;
          testsCount = unit.serology_data?.tests_count || null;
        } else if (unit.department_id === 3) {
          // Microbiology: samples = 1, sub-samples = samples_number, tests = visible indexes per disease
          samplesCount = 1;
          subSamplesCount = unit.samples_number || null;
          // Calculate tests from visible indexes per disease (accounting for hidden indexes)
          const diseasesList = unit.microbiology_data?.diseases_list || [];
          const indexList = unit.microbiology_data?.index_list || [];
          const hiddenIndexes = unit.microbiology_coa?.hidden_indexes || {};
          let micTests = 0;
          diseasesList.forEach((disease: string) => {
            const diseaseHidden = hiddenIndexes[disease] || [];
            const visibleCount = indexList.length - diseaseHidden.length;
            micTests += Math.max(0, visibleCount);
          });
          testsCount = micTests > 0 ? micTests : (diseasesList.length * indexList.length) || null;
        } else {
          samplesCount = unit.samples_number || null;
        }

        rows.push({
          sampleId: sample.id,
          sampleCode: sample.sample_code,
          unitId: unit.id,
          unitCode: unit.unit_code,
          dateReceived: sample.date_received,
          company: sample.company,
          farm: sample.farm,
          flock: sample.flock || '-',
          cycle: sample.cycle || '-',
          house: Array.isArray(unit.house) ? unit.house.join(', ') : unit.house || '-',
          age: unit.age,
          source: unit.source || '-',
          technician: 'N/A',
          notes: unit.notes || '',
          sampleType: Array.isArray(unit.sample_type) ? unit.sample_type.join(', ') : unit.sample_type || '-',
          status: sample.status,
          samplesNumber: samplesCount,
          subSamplesNumber: subSamplesCount,
          testsCount: testsCount,
          department: departmentName,
          coaStatus: unit.coa_status || null,
        });
      });
    });
    return rows;
  }, [samples]);

  // Extract unique values for filter dropdowns (matching PCRSamples pattern)
  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>();
    samples.forEach((sample) => {
      if (sample.company) companies.add(sample.company);
    });
    return Array.from(companies).sort();
  }, [samples]);

  const uniqueFarms = useMemo(() => {
    const farms = new Set<string>();
    samples.forEach((sample) => {
      if (sample.farm) farms.add(sample.farm);
    });
    return Array.from(farms).sort();
  }, [samples]);

  const uniqueFlocks = useMemo(() => {
    const flocks = new Set<string>();
    samples.forEach((sample) => {
      if (sample.flock) flocks.add(sample.flock);
    });
    return Array.from(flocks).sort();
  }, [samples]);

  const uniqueAges = useMemo(() => {
    const ages = new Set<string>();
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.age) ages.add(unit.age);
      });
    });
    return Array.from(ages).sort();
  }, [samples]);

  const uniqueSampleTypes = useMemo(() => {
    const types = new Set<string>();
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.sample_type) {
          if (Array.isArray(unit.sample_type)) {
            unit.sample_type.forEach((t: string) => types.add(t));
          } else {
            types.add(unit.sample_type);
          }
        }
      });
    });
    return Array.from(types).sort();
  }, [samples]);

  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.source) sources.add(unit.source);
      });
    });
    return Array.from(sources).sort();
  }, [samples]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    samples.forEach((sample) => {
      if (sample.status) statuses.add(sample.status);
    });
    return Array.from(statuses).sort();
  }, [samples]);

  const uniqueHouses = useMemo(() => {
    const houses = new Set<string>();
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.house) {
          if (Array.isArray(unit.house)) {
            unit.house.forEach((h: string) => houses.add(h));
          } else {
            houses.add(unit.house);
          }
        }
      });
    });
    return Array.from(houses).sort();
  }, [samples]);

  const uniqueCycles = useMemo(() => {
    const cycles = new Set<string>();
    samples.forEach((sample) => {
      if (sample.cycle) cycles.add(sample.cycle);
    });
    return Array.from(cycles).sort();
  }, [samples]);

  const uniqueDepartments = useMemo(() => {
    return ['PCR', 'Serology', 'Microbiology'];
  }, []);

  const filteredRows = useMemo(() => {
    let filtered = unitRows;

    // Global search is now handled by the backend API
    // Only apply frontend-only multi-select filters (not sent to backend yet)

    if (selectedSources.length > 0) {
      filtered = filtered.filter((row) => selectedSources.includes(row.source));
    }
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((row) => selectedStatuses.includes(row.status));
    }
    if (selectedHouses.length > 0) {
      filtered = filtered.filter((row) => {
        const houses = row.house.split(', ');
        return houses.some(h => selectedHouses.includes(h));
      });
    }
    if (selectedCycles.length > 0) {
      filtered = filtered.filter((row) => selectedCycles.includes(row.cycle));
    }
    if (selectedDepartments.length > 0) {
      filtered = filtered.filter((row) => selectedDepartments.includes(row.department));
    }

    return filtered.reverse();
  }, [unitRows, selectedSources, selectedStatuses, selectedHouses, selectedCycles, selectedDepartments]);

  // For backend pagination, we show the data as-is (already paginated by backend)
  // We'll show "Load More" style pagination or simple prev/next buttons

  const clearFilters = () => {
    setGlobalSearch('');
    setSelectedCompanies([]);
    setSelectedFarms([]);
    setSelectedFlocks([]);
    setSelectedAges([]);
    setSelectedSampleTypes([]);
    setSelectedSources([]);
    setSelectedStatuses([]);
    setSelectedHouses([]);
    setSelectedCycles([]);
    setSelectedDepartments([]);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    setExportDropdownOpen(false);

    try {
      // Prepare data for export (filtered data)
      const exportData = filteredRows.map(row => ({
        'Sample Code': row.sampleCode,
        'Unit Code': row.unitCode,
        'Date Received': formatDate(row.dateReceived),
        'Company': row.company,
        'Farm': row.farm,
        'Flock': row.flock,
        'Cycle': row.cycle,
        'House': row.house,
        'Age': row.age ?? '-',
        'Source': row.source,
        'Department': row.department,
        'Sample Type': row.sampleType,
        'Status': row.status,
        'No. Samples': row.samplesNumber ?? '-',
        'Sub Samples': row.subSamplesNumber ?? '-',
        'No. Tests': row.testsCount ?? '-',
        'Notes': row.notes || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Samples');

      const fileName = `samples_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Export error:', error);
      addToast('error', 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    setExportDropdownOpen(false);

    try {
      // Prepare data for CSV export (filtered data)
      const headers = ['Sample Code', 'Unit Code', 'Date Received', 'Company', 'Farm', 'Flock', 'Cycle', 'House', 'Age', 'Source', 'Department', 'Sample Type', 'Status', 'No. Samples', 'Sub Samples', 'No. Tests', 'Notes'];

      const csvRows = [
        headers.join(','),
        ...filteredRows.map(row => [
          `"${row.sampleCode}"`,
          `"${row.unitCode}"`,
          `"${formatDate(row.dateReceived)}"`,
          `"${row.company}"`,
          `"${row.farm}"`,
          `"${row.flock}"`,
          `"${row.cycle}"`,
          `"${row.house}"`,
          `"${row.age ?? '-'}"`,
          `"${row.source}"`,
          `"${row.department}"`,
          `"${row.sampleType}"`,
          `"${row.status}"`,
          `"${row.samplesNumber ?? '-'}"`,
          `"${row.subSamplesNumber ?? '-'}"`,
          `"${row.testsCount ?? '-'}"`,
          `"${(row.notes || '-').replace(/"/g, '""')}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `samples_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      addToast('error', 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4 h-8 w-48 bg-gray-200 animate-pulse rounded"></div>
          <div className="mb-4 h-10 bg-gray-100 animate-pulse rounded"></div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <th key={i} className="border border-gray-300 px-2 py-2">
                      <div className="h-4 bg-gray-200 animate-pulse rounded"></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="border border-gray-300 px-2 py-3">
                        <div className="h-4 bg-gray-100 animate-pulse rounded"></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6">
        {/* Header - Mobile Responsive */}
        <div className="mb-4 lg:mb-6 pb-4 border-b border-gray-200">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-700">All Samples</h2>
            {/* Mobile: Show filter button */}
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className="lg:hidden p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Search and controls row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="🔍 Search..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-sm"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.247z"></path>
                  </svg>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Year Selector */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-2 sm:px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent min-w-[80px]"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {/* Export Dropdown */}
              <div className="relative" ref={exportDropdownRef}>
                <button
                  onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                  disabled={isExporting || filteredRows.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export
                      <svg className={`w-4 h-4 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>

                {exportDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                    <div className="py-1">
                      <button
                        onClick={exportToExcel}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-medium">Export to Excel</span>
                      </button>
                      <button
                        onClick={exportToCSV}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">Export to CSV</span>
                      </button>
                    </div>
                    <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
                      {filteredRows.length} records to export
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 whitespace-nowrap flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 whitespace-nowrap text-sm"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        {error && (
          <ApiErrorDisplay 
            error={{ message: error }} 
            onRetry={() => fetchSamples()}
            compact={true}
            className="mb-4"
          />
        )}

        <div className="mb-6 space-y-4">
          {/* Active Filter Chips */}
          {(selectedCompanies.length > 0 || selectedFarms.length > 0 || selectedFlocks.length > 0 ||
            selectedAges.length > 0 || selectedSampleTypes.length > 0 || selectedSources.length > 0 ||
            selectedStatuses.length > 0 || selectedHouses.length > 0 || selectedCycles.length > 0 ||
            selectedDepartments.length > 0 || dateFrom || dateTo) && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 self-center">Active filters:</span>
                {dateFrom && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-sky-100 text-sky-800 rounded-full">
                    <span className="font-medium">From:</span>
                    <span>{new Date(dateFrom).toLocaleDateString()}</span>
                    <button
                      onClick={() => setDateFrom('')}
                      className="ml-1 text-sky-600 hover:text-sky-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                )}
                {dateTo && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-sky-100 text-sky-800 rounded-full">
                    <span className="font-medium">To:</span>
                    <span>{new Date(dateTo).toLocaleDateString()}</span>
                    <button
                      onClick={() => setDateTo('')}
                      className="ml-1 text-sky-600 hover:text-sky-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                )}
                {selectedCompanies.map((company) => (
                  <span key={company} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full">
                    <span className="font-medium">Company:</span>
                    <span>{company}</span>
                    <button
                      onClick={() => setSelectedCompanies(selectedCompanies.filter(c => c !== company))}
                      className="ml-1 text-purple-600 hover:text-purple-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedFarms.map((farm) => (
                  <span key={farm} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                    <span className="font-medium">Farm:</span>
                    <span>{farm}</span>
                    <button
                      onClick={() => setSelectedFarms(selectedFarms.filter(f => f !== farm))}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedFlocks.map((flock) => (
                  <span key={flock} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full">
                    <span className="font-medium">Flock:</span>
                    <span>{flock}</span>
                    <button
                      onClick={() => setSelectedFlocks(selectedFlocks.filter(f => f !== flock))}
                      className="ml-1 text-yellow-600 hover:text-yellow-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedAges.map((age) => (
                  <span key={age} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-orange-100 text-orange-800 rounded-full">
                    <span className="font-medium">Age:</span>
                    <span>{age}</span>
                    <button
                      onClick={() => setSelectedAges(selectedAges.filter(a => a !== age))}
                      className="ml-1 text-orange-600 hover:text-orange-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedSampleTypes.map((type) => (
                  <span key={type} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
                    <span className="font-medium">Type:</span>
                    <span>{type}</span>
                    <button
                      onClick={() => setSelectedSampleTypes(selectedSampleTypes.filter(t => t !== type))}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedSources.map((source) => (
                  <span key={source} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-pink-100 text-pink-800 rounded-full">
                    <span className="font-medium">Source:</span>
                    <span>{source}</span>
                    <button
                      onClick={() => setSelectedSources(selectedSources.filter(s => s !== source))}
                      className="ml-1 text-pink-600 hover:text-pink-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedStatuses.map((status) => (
                  <span key={status} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-indigo-100 text-indigo-800 rounded-full">
                    <span className="font-medium">Status:</span>
                    <span>{status}</span>
                    <button
                      onClick={() => setSelectedStatuses(selectedStatuses.filter(s => s !== status))}
                      className="ml-1 text-indigo-600 hover:text-indigo-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedHouses.map((house) => (
                  <span key={house} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-teal-100 text-teal-800 rounded-full">
                    <span className="font-medium">House:</span>
                    <span>{house}</span>
                    <button
                      onClick={() => setSelectedHouses(selectedHouses.filter(h => h !== house))}
                      className="ml-1 text-teal-600 hover:text-teal-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedCycles.map((cycle) => (
                  <span key={cycle} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-cyan-100 text-cyan-800 rounded-full">
                    <span className="font-medium">Cycle:</span>
                    <span>{cycle}</span>
                    <button
                      onClick={() => setSelectedCycles(selectedCycles.filter(c => c !== cycle))}
                      className="ml-1 text-cyan-600 hover:text-cyan-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
                {selectedDepartments.map((dept) => (
                  <span key={dept} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-100 text-red-800 rounded-full">
                    <span className="font-medium">Department:</span>
                    <span>{dept}</span>
                    <button
                      onClick={() => setSelectedDepartments(selectedDepartments.filter(d => d !== dept))}
                      className="ml-1 text-red-600 hover:text-red-800"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

          {/* Collapsible Filter Panel */}
          {filterPanelOpen && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Date Range Filter */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-2">Date Range</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>
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

                {/* Sample Type Multi-Select Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Sample Types</label>
                    {uniqueSampleTypes.length > 0 && (
                      <button
                        onClick={() => setSelectedSampleTypes(selectedSampleTypes.length === uniqueSampleTypes.length ? [] : uniqueSampleTypes)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {selectedSampleTypes.length === uniqueSampleTypes.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                    {uniqueSampleTypes.length === 0 ? (
                      <div className="text-xs text-gray-500 py-1 px-2">No sample types available</div>
                    ) : (
                      uniqueSampleTypes.map((type) => (
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

                {/* Source Multi-Select Dropdown */}
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

                {/* Status Multi-Select Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Statuses</label>
                    {uniqueStatuses.length > 0 && (
                      <button
                        onClick={() => setSelectedStatuses(selectedStatuses.length === uniqueStatuses.length ? [] : uniqueStatuses)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {selectedStatuses.length === uniqueStatuses.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                    {uniqueStatuses.length === 0 ? (
                      <div className="text-xs text-gray-500 py-1 px-2">No statuses available</div>
                    ) : (
                      uniqueStatuses.map((status) => (
                        <label key={status} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStatuses([...selectedStatuses, status]);
                              } else {
                                setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{status}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* House Multi-Select Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Houses</label>
                    {uniqueHouses.length > 0 && (
                      <button
                        onClick={() => setSelectedHouses(selectedHouses.length === uniqueHouses.length ? [] : uniqueHouses)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {selectedHouses.length === uniqueHouses.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                    {uniqueHouses.length === 0 ? (
                      <div className="text-xs text-gray-500 py-1 px-2">No houses available</div>
                    ) : (
                      uniqueHouses.map((house) => (
                        <label key={house} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                          <input
                            type="checkbox"
                            checked={selectedHouses.includes(house)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedHouses([...selectedHouses, house]);
                              } else {
                                setSelectedHouses(selectedHouses.filter(h => h !== house));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{house}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Cycle Multi-Select Dropdown */}
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

                {/* Department Multi-Select Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Departments</label>
                    {uniqueDepartments.length > 0 && (
                      <button
                        onClick={() => setSelectedDepartments(selectedDepartments.length === uniqueDepartments.length ? [] : uniqueDepartments)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {selectedDepartments.length === uniqueDepartments.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                    {uniqueDepartments.length === 0 ? (
                      <div className="text-xs text-gray-500 py-1 px-2">No departments available</div>
                    ) : (
                      uniqueDepartments.map((dept) => (
                        <label key={dept} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                          <input
                            type="checkbox"
                            checked={selectedDepartments.includes(dept)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDepartments([...selectedDepartments, dept]);
                              } else {
                                setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{dept}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}


        </div>

        {filteredRows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <p className="text-gray-500 text-lg mb-4">
              {unitRows.length === 0 ? 'No samples registered yet' : 'No samples match your filters'}
            </p>
            {(selectedCompanies.length > 0 || selectedFarms.length > 0 || selectedFlocks.length > 0 ||
              selectedAges.length > 0 || selectedSampleTypes.length > 0 || selectedSources.length > 0 ||
              selectedStatuses.length > 0 || selectedHouses.length > 0 || selectedCycles.length > 0 ||
              selectedDepartments.length > 0 || dateFrom || dateTo) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Clear all filters
                </button>
              )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border rounded-lg" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              <table className="min-w-full border-collapse text-sm whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm">
                  <tr>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Sample Code</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Unit Code</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Date Received</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Company</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Farm</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Flock</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Cycle</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">House</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Age</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Source</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Department</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Sample Type</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Status</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">No. Samples</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Sub Samples</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">No. Tests</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row: UnitRow) => (
                    <tr
                      key={`${row.sampleId}-${row.unitId}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="border border-gray-300 px-2 py-2 font-semibold text-gray-600">
                        {row.sampleCode}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 font-semibold text-gray-700">
                        {row.unitCode}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">{formatDate(row.dateReceived)}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.company}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.farm}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.flock}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.cycle}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.house}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.age ?? '-'}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.source}</td>
                      <td className="border border-gray-300 px-2 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${row.department === 'PCR' ? 'bg-blue-100 text-blue-800' :
                          row.department === 'Serology' ? 'bg-green-100 text-green-800' :
                            row.department === 'Microbiology' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                          }`}>
                          {row.department}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-2 py-2">{row.sampleType}</td>
                      <td className="border border-gray-300 px-2 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${row.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : row.status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {row.samplesNumber ?? '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {row.subSamplesNumber ?? '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {row.testsCount ?? '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        {row.notes && (
                          <button
                            onClick={() => setNoteDialog({ open: true, note: row.notes })}
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredRows.length > 0 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-gray-800">{filteredRows.length}</span> records
                  {filteredRows.length === 100 && <span className="text-gray-500 ml-2">(Page {page})</span>}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      aria-label="First page"
                    >
                      &laquo;
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      aria-label="Previous page"
                    >
                      &lsaquo;
                    </button>

                    {/* Show numbered page buttons - dynamically based on data */}
                    {(() => {
                      const itemsPerPage = 100;
                      const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage) + (filteredRows.length === itemsPerPage ? page : page - 1));
                      const pagesToShow = [];
                      const startPage = Math.max(1, page - 2);
                      const endPage = Math.min(totalPages, page + 2);
                      for (let i = startPage; i <= endPage; i++) {
                        pagesToShow.push(i);
                      }
                      return pagesToShow.map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-1 border rounded text-sm ${page === pageNum
                            ? 'bg-gray-600 text-white'
                            : 'hover:bg-gray-50'
                            }`}
                        >
                          {pageNum}
                        </button>
                      ));
                    })()}

                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={filteredRows.length < 100}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      aria-label="Next page"
                    >
                      &rsaquo;
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 10)}
                      disabled={filteredRows.length < 100}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      aria-label="Jump forward"
                    >
                      &raquo;
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <NotesDialog
        open={noteDialog.open}
        note={noteDialog.note}
        onClose={() => setNoteDialog({ open: false, note: '' })}
      />
    </div>
  );
};