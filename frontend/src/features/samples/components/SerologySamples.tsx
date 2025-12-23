import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { apiClient } from '../../../services/apiClient';
import { NotesDialog } from '../../../components/NotesDialog';
import { usePermissions } from '../../../hooks/usePermissions';
import { ApiErrorDisplay } from '../../../components/common/ApiErrorDisplay';

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
  diseases: string;
  numberOfWells: number | null;
  coaStatus: string | null;
}

export const SerologySamples = () => {
  const navigate = useNavigate();
  const { canWrite, canRead, isLoading: permissionsLoading } = usePermissions();
  const hasWriteAccess = canWrite('Serology Samples');
  const hasReadAccess = canRead('Serology Samples');

  // Check permission - redirect if no access
  if (!permissionsLoading && !hasReadAccess) {
    return <Navigate to="/" replace />;
  }
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // Only true on first load
  const [error, setError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; note: string }>({
    open: false,
    note: '',
  });
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedRow, setSelectedRow] = useState<UnitRow | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedFilters, setDebouncedFilters] = useState<Record<string, string>>({});
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

  const fetchAvailableYears = async () => {
    try {
      const response = await apiClient.get('/samples/available-years');
      setAvailableYears(response.data.years || []);
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

      // Add column filters to backend params
      if (debouncedFilters.company) {
        params.company = debouncedFilters.company.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (debouncedFilters.farm) {
        params.farm = debouncedFilters.farm.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (debouncedFilters.flock) {
        params.flock = debouncedFilters.flock.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (debouncedFilters.age) {
        params.age = debouncedFilters.age.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (debouncedFilters.sampleType) {
        params.sample_type = debouncedFilters.sampleType.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      const response = await apiClient.get('/samples/', { params });
      setSamples(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load samples:', err);
      setError(err.response?.data?.detail || 'Failed to load samples');
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

  // Function to show edit history
  const showEditHistory = async (entityType: 'sample' | 'unit', entityId: number, code: string) => {
    try {
      const response = await apiClient.get(`/edit-history/${entityType}/${entityId}`);
      setEditHistoryDialog({
        open: true,
        code,
        history: response.data
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

  // Debounce column filters for backend
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(columnFilters);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [columnFilters]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  useEffect(() => {
    fetchSamples();
  }, [selectedYear, debouncedFilters, page, debouncedSearch]);

  const unitRows: UnitRow[] = useMemo(() => {
    const rows: UnitRow[] = [];
    samples.forEach((sample) => {
      sample.units?.forEach((unit: any) => {
        if (unit.department_id === 2) {
          const diseases = unit.serology_data?.diseases_list?.map((d: any) => d.disease).join(', ') || '-';

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
            samplesNumber: unit.samples_number,
            diseases,
            numberOfWells: unit.serology_data?.number_of_wells || null,
            coaStatus: unit.coa_status || null,
          });
        }
      });
    });
    return rows;
  }, [samples]);

  const filteredRows = useMemo(() => {
    let filtered = unitRows;

    // Global search is now handled by the backend API
    // Only apply frontend-only filters (house, source, status, cycle, diseases, numberOfWells)

    // Apply frontend-only filters (house, source, status, cycle, diseases, numberOfWells)
    const frontendOnlyFilters = ['house', 'source', 'status', 'cycle', 'diseases', 'numberOfWells'];
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && frontendOnlyFilters.includes(key)) {
        const search = value.toLowerCase();
        filtered = filtered.filter((row) =>
          String(row[key as keyof UnitRow]).toLowerCase().includes(search)
        );
      }
    });

    return filtered;
  }, [unitRows, columnFilters]);

  // For backend pagination, we show the data as-is (already paginated by backend)

  const handleColumnFilter = (column: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [column]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setGlobalSearch('');
    setColumnFilters({});
    setPage(1);
  };

  const removeFilter = (key: string) => {
    setColumnFilters((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
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
    <div className="p-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-3xl font-bold text-green-700 mb-6">Serology Samples</h2>

        {error && (
          <ApiErrorDisplay 
            error={{ message: error }} 
            onRetry={() => fetchSamples()}
            compact={true}
            className="mb-4"
          />
        )}

        <div className="mb-6 space-y-4">
          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="🔍 Global search across all columns..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
            <div className="flex-shrink-0 self-end flex gap-2">
              <button
                onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 whitespace-nowrap"
              >
                Clear All
              </button>
            </div>
          </div>

          {filterPanelOpen && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Column Filters</h3>
              <div className="text-xs text-gray-500 mb-2">💡 Filters with ⚡ use backend filtering for better performance</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="Company ⚡" value={columnFilters.company || ''} onChange={(e) => handleColumnFilter('company', e.target.value)} />
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="Farm ⚡" value={columnFilters.farm || ''} onChange={(e) => handleColumnFilter('farm', e.target.value)} />
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="Flock ⚡" value={columnFilters.flock || ''} onChange={(e) => handleColumnFilter('flock', e.target.value)} />
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="House" value={columnFilters.house || ''} onChange={(e) => handleColumnFilter('house', e.target.value)} />
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="Age ⚡" value={columnFilters.age || ''} onChange={(e) => handleColumnFilter('age', e.target.value)} />
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="Source" value={columnFilters.source || ''} onChange={(e) => handleColumnFilter('source', e.target.value)} />
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="Sample Type ⚡" value={columnFilters.sampleType || ''} onChange={(e) => handleColumnFilter('sampleType', e.target.value)} />
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="Diseases" value={columnFilters.diseases || ''} onChange={(e) => handleColumnFilter('diseases', e.target.value)} />
                <input className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" placeholder="Status" value={columnFilters.status || ''} onChange={(e) => handleColumnFilter('status', e.target.value)} />
              </div>
            </div>
          )}

          {Object.keys(columnFilters).some((k) => columnFilters[k]) && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 self-center">Active filters:</span>
              {Object.entries(columnFilters)
                .filter(([, v]) => v && v.trim())
                .map(([key, value]) => (
                  <span key={key} className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                    <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span>{value}</span>
                    <button
                      onClick={() => removeFilter(key)}
                      className="ml-1 text-green-600 hover:text-green-800"
                      aria-label={`Remove ${key} filter`}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
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
              <button
                onClick={() => hasWriteAccess && handleDelete(selectedRow.unitId, selectedRow.unitCode)}
                disabled={!hasWriteAccess}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${hasWriteAccess ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                title={!hasWriteAccess ? 'No write permission' : 'Delete unit'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
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
            {Object.keys(columnFilters).length > 0 && (
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
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Sample Type</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Diseases</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">No. Wells</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Status</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">No. Samples</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row: UnitRow) => (
                    <tr
                      key={`${row.sampleId}-${row.unitId}`}
                      onClick={() => setSelectedRow(row)}
                      className={`cursor-pointer transition-colors ${selectedRow?.unitId === row.unitId
                        ? 'bg-green-100 hover:bg-green-150'
                        : 'hover:bg-gray-50 focus-within:bg-green-50'
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
                      {editedSampleIds.has(row.sampleId) && (
                        <td className="border border-gray-300 px-1 py-2 w-8">
                          <button
                            onClick={(e) => { e.stopPropagation(); showEditHistory('sample', row.sampleId, row.sampleCode); }}
                            className="flex items-center justify-center w-6 h-6 bg-orange-500 hover:bg-orange-600 rounded transition-colors"
                            title="This sample has been edited - click to view history"
                          >
                            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        </td>
                      )}
                      {!editedSampleIds.has(row.sampleId) && (
                        <td className="border border-gray-300 px-1 py-2 w-8"></td>
                      )}
                      <td className="border border-gray-300 px-2 py-2 font-semibold text-green-600">
                        {row.sampleCode}
                      </td>
                      <td className="border border-gray-300 px-2 py-2 font-semibold text-green-700">
                        <div className="flex items-center gap-1">
                          {row.unitCode}
                          {editedUnitIds.has(row.unitId) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); showEditHistory('unit', row.unitId, row.unitCode); }}
                              className="ml-1 text-amber-500 hover:text-amber-600 transition-colors"
                              title="This unit has been edited - click to view history"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-2 py-2">{formatDate(row.dateReceived)}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.company}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.farm}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.flock}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.cycle}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.house}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.age ?? '-'}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.source}</td>
                      <td className="border border-gray-300 px-2 py-2">{row.sampleType}</td>
                      <td className="border border-gray-300 px-2 py-2 text-xs">{row.diseases}</td>
                      <td className="border border-gray-300 px-2 py-2 text-center">{row.numberOfWells ?? '-'}</td>
                      <td className="border border-gray-300 px-2 py-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
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
                      <td className="border border-gray-300 px-2 py-2 text-center">
                        {row.samplesNumber ?? '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-2" onClick={(e) => e.stopPropagation()}>
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
                <div className="space-y-3">
                  {editHistoryDialog.history.map((edit: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 border-l-4 border-amber-400">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-800 capitalize">{edit.field_name.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-500">{new Date(edit.edited_at).toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-red-50 rounded p-2">
                          <p className="text-xs text-red-600 font-medium mb-1">Before</p>
                          <p className="text-red-800 break-words">{edit.old_value || '-'}</p>
                        </div>
                        <div className="bg-green-50 rounded p-2">
                          <p className="text-xs text-green-600 font-medium mb-1">After</p>
                          <p className="text-green-800 break-words">{edit.new_value || '-'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Edited by: <span className="font-medium">{edit.edited_by}</span></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div >
  );
};