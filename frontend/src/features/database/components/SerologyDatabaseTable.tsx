import { useState, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';
import * as XLSX from 'xlsx-js-style';
import { Sample, Unit, DatabaseFilters, DEPARTMENT_IDS } from '../types';

interface SerologyDatabaseTableProps {
  units: Array<Unit & { sample: Sample }>;
  totalUnits: number;
  totalCount: number;
  visibleColumns: Record<string, boolean>;
  page: number;
  onPageChange: (page: number) => void;
  filters: DatabaseFilters;
}

export function SerologyDatabaseTable({
  units,
  totalUnits,
  totalCount,
  visibleColumns,
  page,
  onPageChange,
  filters,
}: SerologyDatabaseTableProps) {
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

  const handlePdfUpload = async (unitId: number, files: FileList) => {
    if (files.length === 0) return;
    
    setUploadingUnits(prev => new Set(prev).add(unitId));
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
      
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      
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

  const triggerUpload = (unitId: number) => {
    setSelectedUnitForUpload(unitId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && selectedUnitForUpload !== null) {
      handlePdfUpload(selectedUnitForUpload, e.target.files);
    }
    setSelectedUnitForUpload(null);
  };

  const getCoaFileId = (unit: Unit): number | null => {
    const diseases = unit.serology_data?.diseases_list || [];
    for (const d of diseases) {
      if (d.coa_file_id) return d.coa_file_id;
    }
    return null;
  };

  const openPdfInBrowser = async (fileId: number) => {
    try {
      const response = await apiClient.get(`/drive/${fileId}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error('Failed to open PDF:', error);
      alert('Failed to open PDF. Please try again.');
    }
  };

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

  const exportToExcel = async () => {
    setExportDropdownOpen(false);
    
    const progressOverlay = document.createElement('div');
    progressOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    progressOverlay.innerHTML = `
      <div class="bg-white rounded-lg p-6 shadow-xl min-w-[400px]">
        <h3 class="text-lg font-semibold mb-4 text-gray-800">Exporting Serology Data...</h3>
        <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div id="ser-export-progress-bar" class="bg-purple-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <p id="ser-export-progress-text" class="text-sm text-gray-600 text-center">Preparing export... 0%</p>
      </div>
    `;
    document.body.appendChild(progressOverlay);
    
    const progressBar = document.getElementById('ser-export-progress-bar');
    const progressText = document.getElementById('ser-export-progress-text');
    
    const updateProgress = (percent: number, message: string) => {
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${message} ${Math.round(percent)}%`;
    };

    try {
      updateProgress(10, 'Fetching all data...');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Fetch ALL matching data for export
      const params: any = {
        department_id: DEPARTMENT_IDS['Serology'],
        limit: 100000,
      };
      
      if (filters.companies.length) params.company = filters.companies;
      if (filters.farms.length) params.farm = filters.farms;
      if (filters.flocks.length) params.flock = filters.flocks;
      if (filters.ages.length) params.age = filters.ages;
      if (filters.sampleTypes.length) params.sample_type = filters.sampleTypes;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.cycles.length) params.cycle = filters.cycles;
      if (filters.sources.length) params.source = filters.sources;
      // Add serology-specific backend filtering
      if (filters.serologyDiseases.length) params.diseases = filters.serologyDiseases;
      if (filters.serologyKitTypes.length) params.kit_types = filters.serologyKitTypes;

      const response = await apiClient.get('/samples/', { params });
      const allSamples = response.data;
      
      // Extract units - all filtering now handled by backend
      let allUnits: Array<Unit & { sample: Sample }> = [];
      allSamples.forEach((sample: Sample) => {
        sample.units.forEach((unit: Unit) => {
          allUnits.push({ ...unit, sample });
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

      const allExpandedRows: Array<{unit: Unit & { sample: Sample }; disease: string; kitType: string; isFirstRow: boolean; rowSpan: number; mean: any; cv: any; min: any; max: any; coaStatus: string}> = [];
      const totalUnits = allUnits.length;
      
      allUnits.forEach((unit, idx) => {
        const diseases = unit.serology_data?.diseases_list || [];
        if (diseases.length === 0) {
          allExpandedRows.push({ 
            unit, 
            disease: '-', 
            kitType: '-', 
            isFirstRow: true, 
            rowSpan: 1,
            mean: '-', cv: '-', min: '-', max: '-',
            coaStatus: unit.coa_status || '-'
          });
        } else {
          diseases.forEach((d: any, didx: number) => {
            allExpandedRows.push({ 
              unit, 
              disease: d.disease, 
              kitType: d.kit_type || '-', 
              isFirstRow: didx === 0, 
              rowSpan: diseases.length,
              mean: d.mean !== null && d.mean !== undefined ? d.mean : '-',
              cv: d.cv !== null && d.cv !== undefined ? d.cv + '%' : '-',
              min: d.min !== null && d.min !== undefined ? d.min : '-',
              max: d.max !== null && d.max !== undefined ? d.max : '-',
              coaStatus: unit.coa_status || '-'
            });
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
        if (visibleColumns.source) dataRow.push(Array.isArray(row.unit.source) ? row.unit.source.join(', ') : (row.unit.source || '-'));
        dataRow.push(row.disease, row.kitType, row.mean, row.cv, row.min, row.max, row.coaStatus);
        wsData.push(dataRow);
      });

      updateProgress(75, 'Applying formatting...');
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Apply merging for rows from same unit
      const merges: XLSX.Range[] = [];
      let currentRow = 1; // Start after header
      allUnits.forEach(unit => {
        const diseases = unit.serology_data?.diseases_list || [];
        const rowSpan = diseases.length > 0 ? diseases.length : 1;
        if (rowSpan > 1) {
          // Calculate number of columns before disease data
          let colIdx = 0;
          // Fixed columns: Sample Code, Unit Code, Date, Company, Farm (5 cols)
          for (let c = 0; c < 5; c++) merges.push({ s: { r: currentRow, c: c }, e: { r: currentRow + rowSpan - 1, c: c } });
          colIdx = 5;
          // Dynamic columns
          if (visibleColumns.flock) { merges.push({ s: { r: currentRow, c: colIdx }, e: { r: currentRow + rowSpan - 1, c: colIdx } }); colIdx++; }
          if (visibleColumns.cycle) { merges.push({ s: { r: currentRow, c: colIdx }, e: { r: currentRow + rowSpan - 1, c: colIdx } }); colIdx++; }
          if (visibleColumns.house) { merges.push({ s: { r: currentRow, c: colIdx }, e: { r: currentRow + rowSpan - 1, c: colIdx } }); colIdx++; }
          if (visibleColumns.age) { merges.push({ s: { r: currentRow, c: colIdx }, e: { r: currentRow + rowSpan - 1, c: colIdx } }); colIdx++; }
          if (visibleColumns.source) { merges.push({ s: { r: currentRow, c: colIdx }, e: { r: currentRow + rowSpan - 1, c: colIdx } }); colIdx++; }
          
          // Disease data columns are NOT merged (Disease, Kit, Mean, CV, Min, Max) - skip 6 cols
          const coaCol = colIdx + 6;
          // COA Status merged
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
      successToast.textContent = `Successfully exported ${allUnits.length} units (${allExpandedRows.length} rows)!`;
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
  };

  if (units.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No Serology samples found. Try adjusting your filters or check if there are Serology samples in the system.</p>
      </div>
    );
  }

  return (
    <>
      {/* Hidden file input for PDF uploads */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3 mb-4">
        {units.slice(0, 50).map((unit) => {
          const diseases = unit.serology_data?.diseases_list || [];
          const hasCoa = diseases.some((d: any) => d.coa_file_id);
          
          return (
            <div key={`mobile-ser-${unit.id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-bold text-indigo-700 text-sm">{unit.unit_code}</span>
                  <span className="text-xs text-gray-500 ml-2">{unit.sample.date_received}</span>
                </div>
                {uploadingUnits.has(unit.id) ? (
                  <span className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded-lg">Uploading...</span>
                ) : hasCoa ? (
                  <button
                    onClick={() => {
                      const fileId = getCoaFileId(unit);
                      if (fileId) openPdfInBrowser(fileId);
                    }}
                    className="px-3 py-1 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                  >
                    View COA
                  </button>
                ) : (
                  <button
                    onClick={() => triggerUpload(unit.id)}
                    className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Upload COA
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                <div><span className="text-gray-500 text-xs">Company</span><p className="font-medium text-gray-800 truncate">{unit.sample.company}</p></div>
                <div><span className="text-gray-500 text-xs">Farm</span><p className="font-medium text-gray-800 truncate">{unit.sample.farm}</p></div>
                <div><span className="text-gray-500 text-xs">Age</span><p className="font-medium text-gray-800">{unit.age || '-'}</p></div>
                <div><span className="text-gray-500 text-xs">Wells</span><p className="font-medium text-gray-800">{unit.serology_data?.number_of_wells || '-'}</p></div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-500 block mb-2">Diseases & Results</span>
                <div className="space-y-2">
                  {diseases.length > 0 ? diseases.map((d: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 rounded p-2">
                      <span className="font-medium text-gray-700">{d.disease}</span>
                      <div className="flex gap-2 text-gray-600">
                        {d.mean !== null && <span>Mean: {d.mean}</span>}
                        {d.cv !== null && <span>CV: {d.cv}%</span>}
                      </div>
                    </div>
                  )) : (
                    <span className="text-gray-400 text-xs">No diseases</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {units.length > 50 && (
          <p className="text-center text-sm text-gray-500 py-2">Showing first 50 of {units.length} records. Use desktop for full view.</p>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
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
                        {uploadingUnits.has(row.unit.id) ? (
                          <div className="flex items-center gap-2 text-purple-600">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-xs">Uploading...</span>
                          </div>
                        ) : uploadResults[row.unit.id] ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs ${uploadResults[row.unit.id].success ? 'text-green-600' : 'text-red-600'}`}>
                              {uploadResults[row.unit.id].message}
                            </span>
                            {uploadResults[row.unit.id].canRetry && (
                              <button
                                onClick={() => triggerUpload(row.unit.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                              >
                                Retry Upload
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            {row.hasCoa ? (
                              <>
                                <button
                                  onClick={() => {
                                    const fileId = getCoaFileId(row.unit);
                                    if (fileId) openPdfInBrowser(fileId);
                                  }}
                                  className="px-2 py-1 text-xs font-medium bg-amber-500 text-white rounded hover:bg-amber-600"
                                  title="View COA"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => triggerUpload(row.unit.id)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                                  title="Replace COA"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => triggerUpload(row.unit.id)}
                                className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
                                title="Upload COA"
                              >
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
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 gap-3">
          <div className="flex items-center gap-4">
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
                    <button onClick={exportToExcel} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Excel (.xlsx)
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
            {(() => {
              const itemsPerPage = 100;
              const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
              const pagesToShow = [];
              const startPage = Math.max(1, page - 2);
              const endPage = Math.min(totalPages, page + 2);
              for (let i = startPage; i <= endPage; i++) {
                pagesToShow.push(i);
              }
              const isLastPage = page >= totalPages;
              return (
                <>
                  <button onClick={() => onPageChange(1)} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&laquo;</button>
                  <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&lsaquo;</button>
                  {pagesToShow.map(pageNum => (
                    <button key={pageNum} onClick={() => onPageChange(pageNum)} className={`px-3 py-1 border rounded text-sm ${page === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>{pageNum}</button>
                  ))}
                  <button onClick={() => onPageChange(page + 1)} disabled={isLastPage} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&rsaquo;</button>
                  <button onClick={() => onPageChange(Math.min(totalPages, page + 10))} disabled={isLastPage} className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm">&raquo;</button>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
