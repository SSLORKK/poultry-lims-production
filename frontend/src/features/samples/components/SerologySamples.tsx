import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { apiClient } from '../../../services/apiClient';
import { NotesDialog } from '../../../components/NotesDialog';
import { usePermissions } from '../../../hooks/usePermissions';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
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
  testsCount: number | null;
  diseases: string;
  numberOfWells: number | null;
  coaStatus: string | null;
}

export const SerologySamples = () => {
  const navigate = useNavigate();
  const { canWrite, canRead, isLoading: permissionsLoading } = usePermissions();
  const { user } = useCurrentUser();
  const hasWriteAccess = canWrite('Serology Samples');
  const hasReadAccess = canRead('Serology Samples');
  const isAdmin = user?.role === 'admin';

  // Check permission - redirect if no access
  if (!permissionsLoading && !hasReadAccess) {
    return <Navigate to="/" replace />;
  }
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // Only true on first load
  const [error, setError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  // Load persisted filters from localStorage
  const loadPersistedFilters = () => {
    try {
      const saved = localStorage.getItem('serology_filters');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };
  const persistedFilters = loadPersistedFilters();

  // Multi-select filter states (initialized from localStorage)
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(persistedFilters?.companies || []);
  const [selectedFarms, setSelectedFarms] = useState<string[]>(persistedFilters?.farms || []);
  const [selectedFlocks, setSelectedFlocks] = useState<string[]>(persistedFilters?.flocks || []);
  const [selectedAges, setSelectedAges] = useState<string[]>(persistedFilters?.ages || []);
  const [selectedSampleTypes, setSelectedSampleTypes] = useState<string[]>(persistedFilters?.sampleTypes || []);
  const [selectedSources, setSelectedSources] = useState<string[]>(persistedFilters?.sources || []);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(persistedFilters?.statuses || []);
  const [selectedHouses, setSelectedHouses] = useState<string[]>(persistedFilters?.houses || []);
  const [selectedCycles, setSelectedCycles] = useState<string[]>(persistedFilters?.cycles || []);
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>(persistedFilters?.diseases || []);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>(persistedFilters?.technicians || []);

  // Date range filter
  const [startDate, setStartDate] = useState<string>(persistedFilters?.startDate || '');
  const [endDate, setEndDate] = useState<string>(persistedFilters?.endDate || '');

  // Persist filters to localStorage when they change
  useEffect(() => {
    const filters = {
      companies: selectedCompanies,
      farms: selectedFarms,
      flocks: selectedFlocks,
      ages: selectedAges,
      sampleTypes: selectedSampleTypes,
      sources: selectedSources,
      statuses: selectedStatuses,
      houses: selectedHouses,
      cycles: selectedCycles,
      diseases: selectedDiseases,
      technicians: selectedTechnicians,
      startDate,
      endDate,
    };
    localStorage.setItem('serology_filters', JSON.stringify(filters));
  }, [selectedCompanies, selectedFarms, selectedFlocks, selectedAges, selectedSampleTypes, selectedSources, selectedStatuses, selectedHouses, selectedCycles, selectedDiseases, selectedTechnicians, startDate, endDate]);
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; note: string }>({
    open: false,
    note: '',
  });
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  // Load persisted selected unit from localStorage
  const getPersistedSelectedUnitId = () => {
    try {
      return parseInt(localStorage.getItem('serology_selected_unit') || '0') || null;
    } catch { return null; }
  };
  const [selectedRow, setSelectedRow] = useState<UnitRow | null>(null);
  const [persistedUnitId] = useState<number | null>(getPersistedSelectedUnitId());
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState<Array<{ id: number; type: 'success' | 'error'; message: string }>>([]);
  
  // Edit history tracking
  const [editedSampleIds, setEditedSampleIds] = useState<Set<number>>(new Set());
  const [editedUnitIds, setEditedUnitIds] = useState<Set<number>>(new Set());
  const [editHistoryDialog, setEditHistoryDialog] = useState<{ open: boolean; code: string; history: any[] }>({
    open: false,
    code: '',
    history: []
  });
  
  // Status modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');

  // Export state
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

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
        department_id: 2, // department_id 2 = Serology
        skip: (page - 1) * 100,
        limit: 100
      };

      // Add global search parameter
      if (debouncedSearch) {
        params.search = debouncedSearch;
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
      if (selectedSources.length > 0) {
        params.source = selectedSources;
      }
      if (selectedStatuses.length > 0) {
        params.status = selectedStatuses;
      }
      if (startDate) {
        params.start_date = startDate;
      }
      if (endDate) {
        params.end_date = endDate;
      }

      const response = await apiClient.get('/samples/', { params });
      setSamples(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load samples:', err);
      const errorData = err.response?.data;
      let errorMessage = 'Failed to load Serology samples';
      
      if (errorData) {
        if (errorData.message) {
          errorMessage = `${errorData.error_type || 'Error'}: ${errorData.message}`;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableYears();
  }, []);

  // Fetch edited sample and unit IDs
  useEffect(() => {
    const fetchEditedEntities = async () => {
      try {
        const [unitsResponse, samplesResponse] = await Promise.all([
          apiClient.get('/edit-history/edited-units'),
          apiClient.get('/edit-history/edited-samples')
        ]);
        setEditedUnitIds(new Set(unitsResponse.data));
        setEditedSampleIds(new Set(samplesResponse.data));
      } catch (err) {
        console.error('Failed to fetch edited entities:', err);
      }
    };
    fetchEditedEntities();
  }, [samples]);

  // Function to show combined edit history for sample and all its units across all departments
  const showEditHistory = async (sampleId: number, _unitId: number, sampleCode: string) => {
    try {
      // Use the complete endpoint to get history for sample and ALL its units (shared across departments)
      const response = await apiClient.get(`/edit-history/sample-complete/${sampleId}`);
      const allHistory = response.data;
      
      setEditHistoryDialog({
        open: true,
        code: sampleCode,
        history: allHistory
      });
    } catch (err) {
      console.error('Failed to fetch edit history:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  useEffect(() => {
    fetchSamples();
  }, [selectedYear, page, debouncedSearch, selectedCompanies, selectedFarms, selectedFlocks, selectedAges, selectedSampleTypes, selectedSources, selectedStatuses, startDate, endDate]);

  // Auto-refresh data every 30 seconds without showing loading state
  useEffect(() => {
    const autoRefresh = setInterval(async () => {
      try {
        const params: any = {
          year: selectedYear,
          department_id: 2,
          skip: (page - 1) * 100,
          limit: 100
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (selectedCompanies.length > 0) params.company = selectedCompanies;
        if (selectedFarms.length > 0) params.farm = selectedFarms;
        if (selectedFlocks.length > 0) params.flock = selectedFlocks;
        if (selectedAges.length > 0) params.age = selectedAges;
        if (selectedSampleTypes.length > 0) params.sample_type = selectedSampleTypes;
        if (selectedSources.length > 0) params.source = selectedSources;
        if (selectedStatuses.length > 0) params.status = selectedStatuses;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

        const response = await apiClient.get('/samples/', { params });
        setSamples(response.data);
      } catch (err) {
        console.error('Auto-refresh failed:', err);
      }
    }, 30000);

    return () => clearInterval(autoRefresh);
  }, [selectedYear, page, debouncedSearch, selectedCompanies, selectedFarms, selectedFlocks, selectedAges, selectedSampleTypes, selectedSources, selectedStatuses, startDate, endDate]);

  const unitRows: UnitRow[] = useMemo(() => {
    const rows: UnitRow[] = [];
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.department_id === 2) {
          const diseases = unit.serology_data?.diseases_list?.map((d: any) => d.disease).join(', ') || '-';

          // Combine sample notes (status changes) and unit notes
          const combinedNotes = [sample.notes, unit.notes].filter(Boolean).join('\n');
          
          // Calculate tests count from serology_data
          const testsCount = unit.serology_data?.tests_count || null;
          
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
            technician: unit.serology_data?.technician_name || unit.technician_name || '-',
            notes: combinedNotes,
            sampleType: Array.isArray(unit.sample_type) ? unit.sample_type.join(', ') : unit.sample_type || '-',
            status: sample.status,
            samplesNumber: unit.samples_number,
            testsCount,
            diseases,
            numberOfWells: unit.serology_data?.number_of_wells || null,
            coaStatus: unit.coa_status || null,
          });
        }
      });
    });
    // Sort by unit code A-Z (ascending alphabetically)
    return rows.sort((a, b) => a.unitCode.localeCompare(b.unitCode));
  }, [samples]);

  // Persist selected unit to localStorage when changed
  useEffect(() => {
    if (selectedRow?.unitId) {
      localStorage.setItem('serology_selected_unit', String(selectedRow.unitId));
    }
  }, [selectedRow]);

  // Auto-select persisted unit when data loads
  useEffect(() => {
    if (persistedUnitId && !selectedRow && unitRows.length > 0) {
      const row = unitRows.find(r => r.unitId === persistedUnitId);
      if (row) setSelectedRow(row);
    }
  }, [unitRows, persistedUnitId]);

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

  // Extract unique values for filter dropdowns
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
        if (unit.department_id === 2 && unit.age) ages.add(unit.age);
      });
    });
    return Array.from(ages).sort();
  }, [samples]);

  const uniqueSampleTypes = useMemo(() => {
    const types = new Set<string>();
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.department_id === 2 && unit.sample_type) {
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
        if (unit.department_id === 2 && unit.source) sources.add(unit.source);
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
        if (unit.department_id === 2 && unit.house) {
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

  const uniqueDiseases = useMemo(() => {
    const diseases = new Set<string>();
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.department_id === 2 && unit.serology_data?.diseases_list) {
          unit.serology_data.diseases_list.forEach((d: any) => {
            if (d.disease) diseases.add(d.disease);
          });
        }
      });
    });
    return Array.from(diseases).sort();
  }, [samples]);

  const uniqueTechnicians = useMemo(() => {
    const technicians = new Set<string>();
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.department_id === 2) {
          const tech = unit.serology_data?.technician_name || unit.technician_name;
          if (tech && tech !== '-') technicians.add(tech);
        }
      });
    });
    return Array.from(technicians).sort();
  }, [samples]);

  const filteredRows = useMemo(() => {
    let filtered = unitRows;

    // Apply frontend-only filters (house, cycle, diseases) - these are not sent to backend
    if (selectedHouses.length > 0) {
      filtered = filtered.filter((row) => {
        const rowHouses = row.house.split(', ');
        return selectedHouses.some(h => rowHouses.includes(h));
      });
    }
    if (selectedCycles.length > 0) {
      filtered = filtered.filter((row) => selectedCycles.includes(row.cycle));
    }
    if (selectedDiseases.length > 0) {
      filtered = filtered.filter((row) => {
        const rowDiseases = row.diseases.split(', ');
        return selectedDiseases.some(d => rowDiseases.includes(d));
      });
    }
    if (selectedTechnicians.length > 0) {
      filtered = filtered.filter((row) => selectedTechnicians.includes(row.technician));
    }

    return filtered;
  }, [unitRows, selectedHouses, selectedCycles, selectedDiseases, selectedTechnicians]);

  // For backend pagination, we show the data as-is (already paginated by backend)

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
    setSelectedDiseases([]);
    setSelectedTechnicians([]);
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };





  const handleEdit = (sampleId: number) => {
    navigate(`/register-sample?edit=${sampleId}`);
  };

  const handleDelete = async (unitId: number, unitCode: string) => {
    if (!confirm(`Are you sure you want to delete unit ${unitCode}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/units/${unitId}/`);
      addToast('success', 'Unit deleted successfully');
      setSelectedRow(null);
      fetchSamples();
    } catch (err: any) {
      console.error('Failed to delete unit:', err);
      addToast('error', 'Failed to delete unit. Please try again.');
    }
  };

  const handleStatusChange = async () => {
    if (!selectedRow || !newStatus) return;

    try {
      // Update sample status
      await apiClient.patch(`/samples/${selectedRow.sampleId}`, { 
        status: newStatus
      });
      
      // Only save notes if status is NOT 'completed' and there's a reason
      if (newStatus !== 'completed' && statusNote.trim()) {
        // Build the status change note with timestamp
        const timestamp = new Date().toLocaleString();
        const statusChangeNote = `[Status Change - ${timestamp}]\nStatus: ${selectedRow.status} → ${newStatus}\nReason: ${statusNote}`;
        
        // Get the current unit notes to append status change
        const unitResponse = await apiClient.get(`/units/${selectedRow.unitId}`);
        const currentUnitNotes = unitResponse.data.notes || '';
        
        // Append status change note to unit's notes with clear separator
        let updatedNotes = currentUnitNotes;
        if (updatedNotes) {
          updatedNotes = `${updatedNotes}\n\n---\n${statusChangeNote}`;
        } else {
          updatedNotes = statusChangeNote;
        }
        
        // Update unit notes with status change info
        await apiClient.patch(`/units/${selectedRow.unitId}`, { 
          notes: updatedNotes
        });
      }
      
      addToast('success', `Status changed to ${newStatus}`);
      setShowStatusModal(false);
      setNewStatus('');
      setStatusNote('');
      setSelectedRow(null);
      fetchSamples();
    } catch (err: any) {
      console.error('Failed to change status:', err);
      addToast('error', 'Failed to change status. Please try again.');
    }
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    setExportDropdownOpen(false);

    try {
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
        'Technician': row.technician,
        'Sample Type': row.sampleType,
        'Diseases': row.diseases,
        'Number of Wells': row.numberOfWells ?? '-',
        'Samples Number': row.samplesNumber ?? '-',
        'Tests Count': row.testsCount ?? '-',
        'Status': row.status,
        'Notes': row.notes || '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Serology Samples');

      const fileName = `serology_samples_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      addToast('success', 'Export successful');
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
      const headers = ['Sample Code', 'Unit Code', 'Date Received', 'Company', 'Farm', 'Flock', 'Cycle', 'House', 'Age', 'Source', 'Technician', 'Sample Type', 'Diseases', 'Number of Wells', 'Samples Number', 'Tests Count', 'Status', 'Notes'];

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
          `"${row.technician}"`,
          `"${row.sampleType}"`,
          `"${row.diseases}"`,
          `"${row.numberOfWells ?? '-'}"`,
          `"${row.samplesNumber ?? '-'}"`,
          `"${row.testsCount ?? '-'}"`,
          `"${row.status}"`,
          `"${(row.notes || '-').replace(/"/g, '""')}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `serology_samples_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addToast('success', 'Export successful');
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
              <thead className="bg-green-100">
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
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-700">Serology Samples</h2>
          {/* Mobile: Show filter button */}
          <button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className="lg:hidden p-2 rounded-lg bg-green-100 hover:bg-green-200"
          >
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>

        {error && (
          <ApiErrorDisplay 
            error={{ message: error }} 
            onRetry={() => fetchSamples()}
            compact={true}
            className="mb-4"
          />
        )}

        <div className="mb-4 lg:mb-6 space-y-3 lg:space-y-4">
          {/* Search and Year row - Responsive */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            <div className="flex-shrink-0">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full sm:w-auto px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 relative">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="🔍 Search..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              {loading && (
                <div className="absolute right-3 top-9 transform -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
            <div className="hidden lg:flex flex-shrink-0 gap-2">
              <button
                onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                className="px-3 sm:px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="hidden sm:inline">Filters</span>
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 whitespace-nowrap"
              >
                Clear All
              </button>
              {/* Export Dropdown */}
              <div className="relative" ref={exportDropdownRef}>
                <button
                  onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                  disabled={isExporting || filteredRows.length === 0}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-sm">Exporting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span className="text-sm font-medium">Export</span>
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
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export to Excel
                      </button>
                      <button
                        onClick={exportToCSV}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export to CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

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
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">To</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Company Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Companies</label>
                    {uniqueCompanies.length > 0 && (
                      <button
                        onClick={() => setSelectedCompanies(selectedCompanies.length === uniqueCompanies.length ? [] : uniqueCompanies)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{company}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Farm Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Farms</label>
                    {uniqueFarms.length > 0 && (
                      <button
                        onClick={() => setSelectedFarms(selectedFarms.length === uniqueFarms.length ? [] : uniqueFarms)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{farm}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Flock Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Flocks</label>
                    {uniqueFlocks.length > 0 && (
                      <button
                        onClick={() => setSelectedFlocks(selectedFlocks.length === uniqueFlocks.length ? [] : uniqueFlocks)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{flock}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Age Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Ages</label>
                    {uniqueAges.length > 0 && (
                      <button
                        onClick={() => setSelectedAges(selectedAges.length === uniqueAges.length ? [] : uniqueAges)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{age}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Sample Type Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Sample Types</label>
                    {uniqueSampleTypes.length > 0 && (
                      <button
                        onClick={() => setSelectedSampleTypes(selectedSampleTypes.length === uniqueSampleTypes.length ? [] : uniqueSampleTypes)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                                setSelectedSampleTypes(selectedSampleTypes.filter(t => t !== type));
                              }
                            }}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{type}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Source Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Sources</label>
                    {uniqueSources.length > 0 && (
                      <button
                        onClick={() => setSelectedSources(selectedSources.length === uniqueSources.length ? [] : uniqueSources)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{source}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Status Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Statuses</label>
                    {uniqueStatuses.length > 0 && (
                      <button
                        onClick={() => setSelectedStatuses(selectedStatuses.length === uniqueStatuses.length ? [] : uniqueStatuses)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{status}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* House Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Houses</label>
                    {uniqueHouses.length > 0 && (
                      <button
                        onClick={() => setSelectedHouses(selectedHouses.length === uniqueHouses.length ? [] : uniqueHouses)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{house}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Cycle Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Cycles</label>
                    {uniqueCycles.length > 0 && (
                      <button
                        onClick={() => setSelectedCycles(selectedCycles.length === uniqueCycles.length ? [] : uniqueCycles)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{cycle}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Diseases Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Diseases</label>
                    {uniqueDiseases.length > 0 && (
                      <button
                        onClick={() => setSelectedDiseases(selectedDiseases.length === uniqueDiseases.length ? [] : uniqueDiseases)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                      >
                        {selectedDiseases.length === uniqueDiseases.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                    {uniqueDiseases.length === 0 ? (
                      <div className="text-xs text-gray-500 py-1 px-2">No diseases available</div>
                    ) : (
                      uniqueDiseases.map((disease) => (
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
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{disease}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Technicians Multi-Select with Checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-gray-700">Technicians</label>
                    {uniqueTechnicians.length > 0 && (
                      <button
                        onClick={() => setSelectedTechnicians(selectedTechnicians.length === uniqueTechnicians.length ? [] : uniqueTechnicians)}
                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                      >
                        {selectedTechnicians.length === uniqueTechnicians.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className="border border-gray-300 rounded p-2 max-h-32 overflow-y-auto bg-white">
                    {uniqueTechnicians.length === 0 ? (
                      <div className="text-xs text-gray-500 py-1 px-2">No technicians available</div>
                    ) : (
                      uniqueTechnicians.map((technician) => (
                        <label key={technician} className="flex items-center py-1 px-1 hover:bg-gray-50 cursor-pointer rounded">
                          <input
                            type="checkbox"
                            checked={selectedTechnicians.includes(technician)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTechnicians([...selectedTechnicians, technician]);
                              } else {
                                setSelectedTechnicians(selectedTechnicians.filter(t => t !== technician));
                              }
                            }}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{technician}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Filter Chips */}
          {(selectedCompanies.length > 0 || selectedFarms.length > 0 || selectedFlocks.length > 0 || selectedAges.length > 0 || selectedSampleTypes.length > 0 || selectedSources.length > 0 || selectedStatuses.length > 0 || selectedHouses.length > 0 || selectedCycles.length > 0 || selectedDiseases.length > 0 || selectedTechnicians.length > 0 || startDate || endDate) && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 self-center">Active filters:</span>
              {startDate && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-sky-100 text-sky-800 rounded-full">
                  <span className="font-medium">From:</span>
                  <span>{new Date(startDate).toLocaleDateString()}</span>
                  <button onClick={() => setStartDate('')} className="ml-1 text-sky-600 hover:text-sky-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              )}
              {endDate && (
                <span className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-sky-100 text-sky-800 rounded-full">
                  <span className="font-medium">To:</span>
                  <span>{new Date(endDate).toLocaleDateString()}</span>
                  <button onClick={() => setEndDate('')} className="ml-1 text-sky-600 hover:text-sky-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              )}
              {selectedCompanies.map((company) => (
                <span key={company} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                  <span className="font-medium">Company:</span>
                  <span>{company}</span>
                  <button onClick={() => setSelectedCompanies(selectedCompanies.filter(c => c !== company))} className="ml-1 text-green-600 hover:text-green-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedFarms.map((farm) => (
                <span key={farm} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-emerald-100 text-emerald-800 rounded-full">
                  <span className="font-medium">Farm:</span>
                  <span>{farm}</span>
                  <button onClick={() => setSelectedFarms(selectedFarms.filter(f => f !== farm))} className="ml-1 text-emerald-600 hover:text-emerald-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedFlocks.map((flock) => (
                <span key={flock} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full">
                  <span className="font-medium">Flock:</span>
                  <span>{flock}</span>
                  <button onClick={() => setSelectedFlocks(selectedFlocks.filter(f => f !== flock))} className="ml-1 text-yellow-600 hover:text-yellow-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedAges.map((age) => (
                <span key={age} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-indigo-100 text-indigo-800 rounded-full">
                  <span className="font-medium">Age:</span>
                  <span>{age}</span>
                  <button onClick={() => setSelectedAges(selectedAges.filter(a => a !== age))} className="ml-1 text-indigo-600 hover:text-indigo-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedSampleTypes.map((type) => (
                <span key={type} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-teal-100 text-teal-800 rounded-full">
                  <span className="font-medium">Type:</span>
                  <span>{type}</span>
                  <button onClick={() => setSelectedSampleTypes(selectedSampleTypes.filter(t => t !== type))} className="ml-1 text-teal-600 hover:text-teal-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedSources.map((source) => (
                <span key={source} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-pink-100 text-pink-800 rounded-full">
                  <span className="font-medium">Source:</span>
                  <span>{source}</span>
                  <button onClick={() => setSelectedSources(selectedSources.filter(s => s !== source))} className="ml-1 text-pink-600 hover:text-pink-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedStatuses.map((status) => (
                <span key={status} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-full">
                  <span className="font-medium">Status:</span>
                  <span>{status}</span>
                  <button onClick={() => setSelectedStatuses(selectedStatuses.filter(s => s !== status))} className="ml-1 text-gray-600 hover:text-gray-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedHouses.map((house) => (
                <span key={house} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-orange-100 text-orange-800 rounded-full">
                  <span className="font-medium">House:</span>
                  <span>{house}</span>
                  <button onClick={() => setSelectedHouses(selectedHouses.filter(h => h !== house))} className="ml-1 text-orange-600 hover:text-orange-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedCycles.map((cycle) => (
                <span key={cycle} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-cyan-100 text-cyan-800 rounded-full">
                  <span className="font-medium">Cycle:</span>
                  <span>{cycle}</span>
                  <button onClick={() => setSelectedCycles(selectedCycles.filter(c => c !== cycle))} className="ml-1 text-cyan-600 hover:text-cyan-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedDiseases.map((disease) => (
                <span key={disease} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-100 text-red-800 rounded-full">
                  <span className="font-medium">Disease:</span>
                  <span>{disease}</span>
                  <button onClick={() => setSelectedDiseases(selectedDiseases.filter(d => d !== disease))} className="ml-1 text-red-600 hover:text-red-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
              {selectedTechnicians.map((technician) => (
                <span key={technician} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full">
                  <span className="font-medium">Technician:</span>
                  <span>{technician}</span>
                  <button onClick={() => setSelectedTechnicians(selectedTechnicians.filter(t => t !== technician))} className="ml-1 text-purple-600 hover:text-purple-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-800">{filteredRows.length}</span> records
              {filteredRows.length === 100 && <span className="text-gray-500 ml-2">(Page {page})</span>}
            </div>
          </div>
        </div>

        {selectedRow && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-green-900">Selected: {selectedRow.unitCode}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => hasWriteAccess && handleEdit(selectedRow.sampleId)}
                disabled={!hasWriteAccess}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${hasWriteAccess ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                title={!hasWriteAccess ? 'No write permission' : 'Edit sample'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(selectedRow.unitId, selectedRow.unitCode)}
                  className="px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
                  title="Delete unit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
              <button
                onClick={() => hasWriteAccess && setShowStatusModal(true)}
                disabled={!hasWriteAccess}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${hasWriteAccess ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                title={!hasWriteAccess ? 'No write permission' : 'Change status'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Status
              </button>
              <button
                onClick={() => setSelectedRow(null)}
                className="ml-2 p-2 text-gray-400 hover:text-gray-600 rounded"
                aria-label="Deselect"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {filteredRows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🩸</div>
            <p className="text-gray-500 text-lg mb-4">
              {unitRows.length === 0 ? 'No Serology samples registered yet' : 'No samples match your filters'}
            </p>
            {(selectedCompanies.length > 0 || selectedFarms.length > 0 || selectedFlocks.length > 0 || selectedAges.length > 0 || selectedSampleTypes.length > 0 || selectedSources.length > 0 || selectedStatuses.length > 0 || selectedHouses.length > 0 || selectedCycles.length > 0 || selectedDiseases.length > 0 || startDate || endDate) && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[600px] relative border rounded-lg">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-green-100 shadow-sm">
                  <tr>
                    <th className="border border-gray-300 px-1 py-2 w-8 text-center font-semibold" title="Edit History"></th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Status</th>
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
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Technician</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Sample Type</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Diseases</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">No. Wells</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">No. Samples</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">No. Tests</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row: UnitRow) => (
                    <tr
                      key={`${row.sampleId}-${row.unitId}`}
                      onClick={() => setSelectedRow(row)}
                      className={`cursor-pointer transition-colors ${selectedRow?.unitId === row.unitId
                        ? 'bg-green-200 border-l-4 border-l-green-600 ring-2 ring-green-400 ring-inset'
                        : 'hover:bg-gray-50 focus-within:bg-green-50 border-l-4 border-l-transparent'
                        }`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Select unit ${row.unitCode}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedRow(row);
                        }
                      }}
                    >
                      {/* Consolidated Edit History Icon */}
                      <td className="border border-gray-300 px-1 py-2 w-8">
                        {(editedSampleIds.has(row.sampleId) || editedUnitIds.has(row.unitId)) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); showEditHistory(row.sampleId, row.unitId, row.sampleCode); }}
                            className="flex items-center justify-center w-6 h-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded shadow-sm transition-all"
                            title="View all edit history for this sample and unit"
                          >
                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block w-fit ${
                            row.status?.toLowerCase() === 'completed' || row.status?.toLowerCase() === 'complete'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : row.status?.toLowerCase() === 'postponed' || row.status?.toLowerCase() === 'hold'
                                ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                : row.status?.toLowerCase() === 'need approval' || row.status?.toLowerCase() === 'pending approval'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : row.status?.toLowerCase() === 'rejected'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : row.status?.toLowerCase() === 'in_progress' || row.status?.toLowerCase() === 'in progress'
                                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                      : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-2 py-2 font-semibold text-green-600">
                        {row.sampleCode}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 font-semibold text-green-700">
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
                      <td className="border border-gray-300 px-2 py-2">{row.technician}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.sampleType}</td>
                      <td className="border border-gray-300 px-2 py-2 text-xs">{row.diseases}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{row.numberOfWells ?? '-'}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {row.samplesNumber ?? '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {row.testsCount ?? '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        {row.notes && row.status !== 'completed' && (
                          <button
                            onClick={() => setNoteDialog({ open: true, note: row.notes })}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="underline">Notes</span>
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
                              ? 'bg-green-600 text-white'
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

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 animate-slide-in ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
              }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <NotesDialog
        open={noteDialog.open}
        note={noteDialog.note}
        onClose={() => setNoteDialog({ open: false, note: '' })}
      />

      {/* Edit History Dialog */}
      {editHistoryDialog.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Edit History</h3>
                  <p className="text-sm text-gray-500">{editHistoryDialog.code}</p>
                </div>
              </div>
              <button
                onClick={() => setEditHistoryDialog({ open: false, code: '', history: [] })}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {editHistoryDialog.history.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No edit history found</p>
              ) : (
                <div className="space-y-4">
                  {editHistoryDialog.history.map((edit: any, idx: number) => {
                    // Helper to parse Python-style dict strings (single quotes) to JSON
                    const parsePythonList = (value: string): any[] => {
                      if (!value) return [];
                      try {
                        return JSON.parse(value);
                      } catch {
                        try {
                          const jsonStr = value
                            .replace(/'/g, '"')
                            .replace(/None/g, 'null')
                            .replace(/True/g, 'true')
                            .replace(/False/g, 'false');
                          return JSON.parse(jsonStr);
                        } catch {
                          return [];
                        }
                      }
                    };

                    // Check if value looks like a list/array
                    const isListValue = (val: string): boolean => {
                      if (!val) return false;
                      const trimmed = val.trim();
                      return trimmed.startsWith('[') && trimmed.endsWith(']');
                    };
                    
                    // Check if this is a diseases_list field with objects (pcr/serology have disease, kit_type, test_count)
                    if (edit.field_name === 'diseases_list' || edit.field_name === 'pcr_diseases_list' || edit.field_name === 'serology_diseases_list') {
                      const oldDiseases = parsePythonList(edit.old_value);
                      const newDiseases = parsePythonList(edit.new_value);
                      
                      return (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <div className="bg-amber-50 px-3 py-2 border-b flex justify-between items-center">
                            <span className="font-semibold text-amber-800">Diseases List Change</span>
                            <span className="text-xs text-gray-500">{edit.edited_by} • {new Date(edit.edited_at).toLocaleString()}</span>
                          </div>
                          <div className="grid grid-cols-2 divide-x divide-gray-300">
                            {/* Before Section */}
                            <div className="bg-red-50">
                              <div className="px-3 py-2 bg-red-100 border-b border-gray-200 text-center">
                                <span className="font-semibold text-red-700 text-sm">Before</span>
                              </div>
                              <table className="w-full text-sm">
                                <thead className="bg-red-100/50">
                                  <tr>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-red-800 border-b border-red-200">Disease</th>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-red-800 border-b border-red-200">Kit Type</th>
                                    <th className="px-2 py-1 text-center text-xs font-medium text-red-800 border-b border-red-200">Count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {oldDiseases.length === 0 ? (
                                    <tr><td colSpan={3} className="px-2 py-2 text-center text-gray-400 text-xs">No diseases</td></tr>
                                  ) : oldDiseases.map((d: any, i: number) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-red-50' : 'bg-red-100/30'}>
                                      <td className="px-2 py-1 text-red-700 border-b border-red-100">{d?.disease || '-'}</td>
                                      <td className="px-2 py-1 text-red-700 border-b border-red-100">{d?.kit_type || '-'}</td>
                                      <td className="px-2 py-1 text-red-700 border-b border-red-100 text-center">{d?.test_count ?? '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {/* After Section */}
                            <div className="bg-green-50">
                              <div className="px-3 py-2 bg-green-100 border-b border-gray-200 text-center">
                                <span className="font-semibold text-green-700 text-sm">After</span>
                              </div>
                              <table className="w-full text-sm">
                                <thead className="bg-green-100/50">
                                  <tr>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-green-800 border-b border-green-200">Disease</th>
                                    <th className="px-2 py-1 text-left text-xs font-medium text-green-800 border-b border-green-200">Kit Type</th>
                                    <th className="px-2 py-1 text-center text-xs font-medium text-green-800 border-b border-green-200">Count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {newDiseases.length === 0 ? (
                                    <tr><td colSpan={3} className="px-2 py-2 text-center text-gray-400 text-xs">No diseases</td></tr>
                                  ) : newDiseases.map((d: any, i: number) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-green-50' : 'bg-green-100/30'}>
                                      <td className="px-2 py-1 text-green-700 border-b border-green-100">{d?.disease || '-'}</td>
                                      <td className="px-2 py-1 text-green-700 border-b border-green-100">{d?.kit_type || '-'}</td>
                                      <td className="px-2 py-1 text-green-700 border-b border-green-100 text-center">{d?.test_count ?? '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Microbiology diseases_list and index_list - simple string arrays
                    if (edit.field_name === 'microbiology_diseases_list' || edit.field_name === 'microbiology_index_list') {
                      const oldItems = parsePythonList(edit.old_value);
                      const newItems = parsePythonList(edit.new_value);
                      const fieldLabel = edit.field_name === 'microbiology_diseases_list' ? 'Diseases List' : 'Index List';
                      
                      return (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <div className="bg-amber-50 px-3 py-2 border-b flex justify-between items-center">
                            <span className="font-semibold text-amber-800">{fieldLabel} Change</span>
                            <span className="text-xs text-gray-500">{edit.edited_by} • {new Date(edit.edited_at).toLocaleString()}</span>
                          </div>
                          <div className="grid grid-cols-2 divide-x divide-gray-300">
                            {/* Before Section */}
                            <div className="bg-red-50">
                              <div className="px-3 py-2 bg-red-100 border-b border-gray-200 text-center">
                                <span className="font-semibold text-red-700 text-sm">Before</span>
                              </div>
                              <div className="p-2">
                                {oldItems.length === 0 ? (
                                  <p className="text-center text-gray-400 text-xs py-2">No items</p>
                                ) : (
                                  <div className="space-y-1">
                                    {oldItems.map((item: any, i: number) => (
                                      <div key={i} className="px-2 py-1 bg-red-100/50 rounded text-red-700 text-sm">
                                        {typeof item === 'string' ? item : JSON.stringify(item)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* After Section */}
                            <div className="bg-green-50">
                              <div className="px-3 py-2 bg-green-100 border-b border-gray-200 text-center">
                                <span className="font-semibold text-green-700 text-sm">After</span>
                              </div>
                              <div className="p-2">
                                {newItems.length === 0 ? (
                                  <p className="text-center text-gray-400 text-xs py-2">No items</p>
                                ) : (
                                  <div className="space-y-1">
                                    {newItems.map((item: any, i: number) => (
                                      <div key={i} className="px-2 py-1 bg-green-100/50 rounded text-green-700 text-sm">
                                        {typeof item === 'string' ? item : JSON.stringify(item)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Generic list/array field - auto-detect
                    if (isListValue(edit.old_value) || isListValue(edit.new_value)) {
                      const oldItems = parsePythonList(edit.old_value);
                      const newItems = parsePythonList(edit.new_value);
                      const fieldLabel = edit.field_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                      
                      return (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <div className="bg-amber-50 px-3 py-2 border-b flex justify-between items-center">
                            <span className="font-semibold text-amber-800">{fieldLabel} Change</span>
                            <span className="text-xs text-gray-500">{edit.edited_by} • {new Date(edit.edited_at).toLocaleString()}</span>
                          </div>
                          <div className="grid grid-cols-2 divide-x divide-gray-300">
                            {/* Before Section */}
                            <div className="bg-red-50">
                              <div className="px-3 py-2 bg-red-100 border-b border-gray-200 text-center">
                                <span className="font-semibold text-red-700 text-sm">Before</span>
                              </div>
                              <div className="p-2">
                                {oldItems.length === 0 ? (
                                  <p className="text-center text-gray-400 text-xs py-2">No items</p>
                                ) : (
                                  <div className="space-y-1">
                                    {oldItems.map((item: any, i: number) => (
                                      <div key={i} className="px-2 py-1 bg-red-100/50 rounded text-red-700 text-sm">
                                        {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* After Section */}
                            <div className="bg-green-50">
                              <div className="px-3 py-2 bg-green-100 border-b border-gray-200 text-center">
                                <span className="font-semibold text-green-700 text-sm">After</span>
                              </div>
                              <div className="p-2">
                                {newItems.length === 0 ? (
                                  <p className="text-center text-gray-400 text-xs py-2">No items</p>
                                ) : (
                                  <div className="space-y-1">
                                    {newItems.map((item: any, i: number) => (
                                      <div key={i} className="px-2 py-1 bg-green-100/50 rounded text-green-700 text-sm">
                                        {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // Regular field display - compact card style
                    return (
                      <div key={idx} className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b flex justify-between items-center">
                          <span className="font-semibold text-gray-800 capitalize">{edit.field_name.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-500">{edit.edited_by} • {new Date(edit.edited_at).toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-gray-200">
                          <div className="p-3 bg-red-50">
                            <div className="text-xs font-medium text-red-600 mb-1">Before</div>
                            <div className="text-sm text-red-700 break-words">{edit.old_value || '-'}</div>
                          </div>
                          <div className="p-3 bg-green-50">
                            <div className="text-xs font-medium text-green-600 mb-1">After</div>
                            <div className="text-sm text-green-700 break-words">{edit.new_value || '-'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && selectedRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Change Status</h3>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setNewStatus('');
                  setStatusNote('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Change status for: <span className="font-semibold">{selectedRow.unitCode}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select status...</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                  <option value="rejected">Rejected</option>
                  <option value="need approval">Need Approval</option>
                </select>
              </div>
              {/* Only show reason field if status is NOT 'completed' */}
              {newStatus !== 'completed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Enter the reason for this status change..."
                    rows={3}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                      !statusNote.trim() ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  />
                  {!statusNote.trim() && (
                    <p className="text-xs text-red-500 mt-1">Reason is required</p>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setNewStatus('');
                    setStatusNote('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={!newStatus || (newStatus !== 'completed' && !statusNote.trim())}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};