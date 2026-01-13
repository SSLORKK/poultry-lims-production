import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiClient } from '../../../services/apiClient';
import * as XLSX from 'xlsx-js-style';
import { Sample, Unit, MicrobiologyCOAData, DatabaseFilters, DEPARTMENT_IDS } from '../types';

interface MicrobiologyDatabaseTableProps {
  units: Array<Unit & { sample: Sample }>;
  totalUnits: number;
  totalCount: number;
  visibleColumns: Record<string, boolean>;
  page: number;
  onPageChange: (page: number) => void;
  selectedMicrobiologyResults: string[];
  filters: DatabaseFilters;
}

export function MicrobiologyDatabaseTable({
  units,
  totalUnits,
  totalCount,
  visibleColumns,
  page,
  onPageChange,
  selectedMicrobiologyResults,
  filters,
}: MicrobiologyDatabaseTableProps) {
  const location = useLocation();
  const [coaResults, setCoaResults] = useState<Record<number, MicrobiologyCOAData | null>>({});
  const [loading, setLoading] = useState(true);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  // Memoize unit IDs to prevent unnecessary refetches
  const unitIds = useMemo(() => units.map(u => u.id), [units]);
  const unitIdsKey = useMemo(() => unitIds.join(','), [unitIds]);

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

  const allDiseases = useMemo(() => {
    const diseaseSet = new Set<string>();
    units.forEach((unit) => {
      unit.microbiology_data?.diseases_list?.forEach((d) => diseaseSet.add(d));
    });
    return Array.from(diseaseSet).sort();
  }, [units]);

  // Optimized COA fetching with batch processing
  useEffect(() => {
    const controller = new AbortController();
    
    const fetchAllCOAResults = async () => {
      if (units.length === 0) {
        setCoaResults({});
        setLoading(false);
        return;
      }

      setLoading(true);
      const results: Record<number, MicrobiologyCOAData | null> = {};

      try {
        // Batch fetch in chunks of 100 for very large datasets
        const BATCH_SIZE = 100;
        const chunks: number[][] = [];
        for (let i = 0; i < unitIds.length; i += BATCH_SIZE) {
          chunks.push(unitIds.slice(i, i + BATCH_SIZE));
        }

        // Process chunks in parallel (max 3 concurrent)
        for (let i = 0; i < chunks.length; i += 3) {
          const batch = chunks.slice(i, i + 3);
          const promises = batch.map(chunk =>
            apiClient.get('/microbiology-coa/batch/', {
              params: { unit_ids: chunk.join(',') },
              signal: controller.signal
            })
          );
          
          const responses = await Promise.all(promises);
          responses.forEach(response => {
            const coaList: MicrobiologyCOAData[] = response.data;
            coaList.forEach(coa => {
              results[coa.unit_id] = coa;
            });
          });
        }

        // Mark missing COAs as null
        unitIds.forEach(unitId => {
          if (!(unitId in results)) {
            results[unitId] = null;
          }
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Failed to fetch Microbiology COAs:', error);
          unitIds.forEach(unitId => {
            results[unitId] = null;
          });
        }
      }

      if (!controller.signal.aborted) {
        setCoaResults(results);
        setLoading(false);
      }
    };

    fetchAllCOAResults();
    
    return () => controller.abort();
  }, [unitIdsKey, refetchKey]);

  const parseNumericValue = (value: string): number | null => {
    if (!value || value === '-' || value === '') return null;
    const upper = value.toUpperCase().trim();
    
    if (upper.includes('LESS THAN')) {
      const match = upper.match(/LESS\s*THAN\s*(\d+)/i);
      if (match) return parseFloat(match[1]) - 1;
      return 0;
    }
    
    const sciMatch = value.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*10\s*[\^]?\s*(\d+)/i);
    if (sciMatch) {
      return parseFloat(sciMatch[1]) * Math.pow(10, parseInt(sciMatch[2]));
    }
    
    const numMatch = value.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }
    
    return null;
  };

  const getUnitDiseaseResult = (unit: Unit, disease: string, coa: MicrobiologyCOAData | null): string | null => {
    const unitDiseases = unit.microbiology_data?.diseases_list || [];
    if (!unitDiseases.includes(disease)) return null;
    
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
        if (num !== null) {
          hasValue = true;
          maxValue = Math.max(maxValue, num);
        }
      });
      
      if (!hasValue) return 'Within Limit';
      
      if (lowerDisease.includes('bacterial') || lowerDisease.includes('tbc')) {
        return maxValue > 56 ? 'Over Limit' : 'Within Limit';
      }
      
      if (lowerDisease.includes('coliform') || lowerDisease.includes('e-coli') || 
          lowerDisease.includes('e.coli') || lowerDisease.includes('ecoli') ||
          lowerDisease.includes('pseudomonas')) {
        return maxValue > 1 ? 'Over Limit' : 'Within Limit';
      }
      
      return maxValue > 1 ? 'Over Limit' : 'Within Limit';
    }
    
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
      
      if (isFeed) {
        return maxValue >= 100000 ? 'Over Limit' : 'Within Limit';
      }
      
      return maxValue > 1000 ? 'Over Limit' : 'Within Limit';
    }
    
    const hasPositive = allValues.some(v => {
      const upper = v?.toUpperCase() || '';
      return upper !== 'NOT DETECTED' && upper !== 'NEGATIVE' && upper !== '-' && upper !== '' && !upper.includes('LESS THAN') && upper !== 'NO BACTERIAL GROWTH' && upper !== 'NO COLIFORM GROWTH' && upper !== 'NO FUNGAL GROWTH';
    });
    
    return hasPositive ? 'Detected' : 'Not Detected';
  };

  const getUnitIsolateType = (coa: MicrobiologyCOAData | null): string => {
    if (!coa) return '-';
    
    const isolateTypes = (coa as any).isolate_types;
    if (!isolateTypes) return '-';
    
    const diseaseIsolates: Record<string, Set<string>> = {};
    
    Object.entries(isolateTypes).forEach(([disease, locations]: [string, any]) => {
      if (typeof locations === 'object') {
        Object.values(locations).forEach((type: any) => {
          if (type && 
              typeof type === 'string' &&
              type.trim() !== '' && 
              !type.match(/^-+$/) &&
              !type.match(/^[\-─━]+$/) &&
              type !== 'Not Detected' &&
              type !== 'NO BACTERIAL GROWTH' &&
              type !== 'NO COLIFORM GROWTH' &&
              type !== 'NO FUNGAL GROWTH') {
            if (!diseaseIsolates[disease]) {
              diseaseIsolates[disease] = new Set();
            }
            diseaseIsolates[disease].add(type.trim());
          }
        });
      }
    });
    
    const diseaseStrings: string[] = [];
    Object.entries(diseaseIsolates).forEach(([disease, types]) => {
      const sortedTypes = Array.from(types).sort();
      if (sortedTypes.length > 0) {
        diseaseStrings.push(`${disease.toLowerCase()} (${sortedTypes.join(', ')})`);
      }
    });
    
    return diseaseStrings.length > 0 ? diseaseStrings.join(', ') : '-';
  };

  const getUnitPositiveLocations = (unit: Unit, coa: MicrobiologyCOAData | null): string => {
    if (!coa?.test_results) return '-';
    
    const sampleTypes = unit.sample_type || [];
    const isFeed = sampleTypes.some(t => t.toLowerCase().includes('feed'));
    const indexList = unit.microbiology_data?.index_list || [];
    const diseaseLocations: Record<string, Set<string>> = {};
    
    Object.entries(coa.test_results).forEach(([disease, results]) => {
      const lowerDisease = disease.toLowerCase();
      
      Object.entries(results).forEach(([location, value]) => {
        if (!value || value === '-' || value === '') return;
        
        const upper = value.toUpperCase();
        let isPositive = false;
        
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
        } else if (lowerDisease.includes('total count')) {
          const num = parseNumericValue(value);
          if (num !== null) {
            isPositive = isFeed ? num >= 100000 : num > 1000;
          }
        } else {
          isPositive = upper !== 'NOT DETECTED' && upper !== 'NEGATIVE' && 
                       !upper.includes('LESS THAN') && upper !== 'NO BACTERIAL GROWTH' && 
                       upper !== 'NO COLIFORM GROWTH' && upper !== 'NO FUNGAL GROWTH';
        }
        
        if (isPositive) {
          let actualLocationName = '';
          
          const rowMatch = location.match(/^row(\d+)_/);
          if (rowMatch) {
            const rowIndex = parseInt(rowMatch[1], 10);
            if (rowIndex >= 0 && rowIndex < indexList.length) {
              actualLocationName = indexList[rowIndex];
            }
          } else {
            const directRowMatch = location.match(/^row(\d+)$/i);
            if (directRowMatch) {
              const rowIndex = parseInt(directRowMatch[1], 10);
              if (rowIndex >= 0 && rowIndex < indexList.length) {
                actualLocationName = indexList[rowIndex];
              }
            } else {
              actualLocationName = location;
            }
          }
          
          if (actualLocationName && 
              actualLocationName.trim() !== '' && 
              !actualLocationName.match(/^-+$/) &&
              !actualLocationName.match(/^row\d+$/i)) {
            if (!diseaseLocations[disease]) {
              diseaseLocations[disease] = new Set();
            }
            diseaseLocations[disease].add(actualLocationName);
          }
        }
      });
    });
    
    const diseaseStrings: string[] = [];
    
    Object.entries(diseaseLocations).forEach(([disease, locationNames]) => {
      const sortedLocations = Array.from(locationNames).sort();
      
      if (sortedLocations.length > 0) {
        const displayDisease = disease.toLowerCase();
        diseaseStrings.push(`${displayDisease} (${sortedLocations.join(', ')})`);
      }
    });
    
    return diseaseStrings.length > 0 ? diseaseStrings.join(', ') : '-';
  };

  const getUnitResultStatus = (unitId: number): string[] => {
    const results: string[] = [];
    const unit = units.find(u => u.id === unitId);
    if (!unit) return results;
    
    const unitDiseases = unit.microbiology_data?.diseases_list || [];
    unitDiseases.forEach(disease => {
      const result = getUnitDiseaseResult(unit, disease, coaResults[unitId]);
      if (result) {
        results.push(result);
      }
    });
    return results;
  };

  const filteredDisplayUnits = useMemo(() => {
    if (selectedMicrobiologyResults.length === 0) return units;
    
    return units.filter(unit => {
      const unitResults = getUnitResultStatus(unit.id);
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

  const exportToExcel = async () => {
    setExportDropdownOpen(false);
    
    const progressOverlay = document.createElement('div');
    progressOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    progressOverlay.innerHTML = `
      <div class="bg-white rounded-lg p-6 shadow-xl min-w-[400px]">
        <h3 class="text-lg font-semibold mb-4 text-gray-800">Exporting Microbiology Data...</h3>
        <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div id="mic-export-progress-bar" class="bg-green-600 h-4 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
        <p id="mic-export-progress-text" class="text-sm text-gray-600 text-center">Preparing export... 0%</p>
      </div>
    `;
    document.body.appendChild(progressOverlay);
    
    const progressBar = document.getElementById('mic-export-progress-bar');
    const progressText = document.getElementById('mic-export-progress-text');
    
    const updateProgress = (percent: number, message: string) => {
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${message} ${Math.round(percent)}%`;
    };

    try {
      updateProgress(5, 'Fetching all data...');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Fetch ALL matching data for export
      const params: any = {
        department_id: DEPARTMENT_IDS['Microbiology'],
        limit: 100000,
      };
      
      if (filters.companies.length) params.company = filters.companies;
      if (filters.farms.length) params.farm = filters.farms;
      if (filters.flocks.length) params.flock = filters.flocks;
      if (filters.ages.length) params.age = filters.ages;
      if (filters.sampleTypes.length) params.sample_type = filters.sampleTypes;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;

      const response = await apiClient.get('/samples/', { params });
      const allSamples = response.data;
      
      // Extract units
      let allUnits: Array<Unit & { sample: Sample }> = [];
      allSamples.forEach((sample: Sample) => {
        sample.units.forEach((unit: Unit) => {
          allUnits.push({ ...unit, sample });
        });
      });

      // Apply Microbiology specific filters (Diseases) in memory
      if (filters.microbiologyDiseases.length > 0) {
        allUnits = allUnits.filter(unit => {
          const unitDiseases = unit.microbiology_data?.diseases_list || [];
          return filters.microbiologyDiseases.some(d => unitDiseases.includes(d));
        });
      }

      const totalRows = allUnits.length;
      updateProgress(15, `Found ${totalRows} records. Fetching COA data...`);

      // Fetch COAs for all units
      const unitIds = allUnits.map(u => u.id);
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
          console.error('Failed to fetch COA batch for export:', e);
        }
        const progress = 15 + ((i / unitIds.length) * 35);
        updateProgress(progress, 'Fetching COA results...');
      }

      // Collect all diseases across all export units for headers
      const exportAllDiseases = new Set<string>();
      allUnits.forEach(unit => {
        unit.microbiology_data?.diseases_list?.forEach(d => exportAllDiseases.add(d));
      });
      const sortedExportDiseases = Array.from(exportAllDiseases).sort();

      updateProgress(50, 'Building Excel file...');

      const wb = XLSX.utils.book_new();
      const wsData: any[] = [];
      const headers = ['Sample Code', 'Unit Code', 'Date Received', 'Company', 'Farm', 'Sample Type'];
      sortedExportDiseases.forEach(d => headers.push(d));
      headers.push('Type of Isolate', 'Location', 'COA Status');
      wsData.push(headers);

      allUnits.forEach((unit, idx) => {
        // Result filtering if active
        // This is expensive to do for all, but necessary if result filter is applied
        if (filters.microbiologyResults.length > 0) {
          const unitCoa = exportCoaResults[unit.id];
          // Re-implement result filter logic locally
          const unitResults: string[] = [];
          const unitDiseases = unit.microbiology_data?.diseases_list || [];
          unitDiseases.forEach(disease => {
            const result = getUnitDiseaseResult(unit, disease, unitCoa);
            if (result) unitResults.push(result);
          });
          
          const matches = filters.microbiologyResults.some(selectedResult => {
            if (selectedResult === 'Detected') return unitResults.includes('Detected');
            if (selectedResult === 'Not Detected') return unitResults.includes('Not Detected');
            if (selectedResult === 'Over Limit') return unitResults.includes('Over Limit');
            if (selectedResult === 'Within Limit') return unitResults.includes('Within Limit');
            return false;
          });
          
          if (!matches) return; // Skip unit
        }

        const row: any[] = [
          unit.sample.sample_code,
          unit.unit_code,
          unit.sample.date_received,
          unit.sample.company,
          unit.sample.farm,
          unit.sample_type?.join(', ') || '-',
        ];
        
        const unitCoa = exportCoaResults[unit.id];

        sortedExportDiseases.forEach(disease => {
          const result = getUnitDiseaseResult(unit, disease, unitCoa);
          row.push(result === null ? '-' : result);
        });
        
        row.push(getUnitIsolateType(unitCoa));
        row.push(getUnitPositiveLocations(unit, unitCoa));
        row.push(unit.coa_status || '-');
        wsData.push(row);
        
        if (idx % 100 === 0) {
          updateProgress(50 + ((idx / totalRows) * 40), 'Processing rows...');
        }
      });

      updateProgress(90, 'Applying formatting...');
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      const diseaseStartCol = 6;
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = 1; R <= range.e.r; ++R) {
        for (let C = diseaseStartCol; C < diseaseStartCol + sortedExportDiseases.length; ++C) {
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
      successToast.textContent = `Successfully exported ${wsData.length - 1} rows!`;
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

  if (loading) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <p className="mt-2 text-gray-600">Loading COA results...</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3 mb-4">
        {filteredDisplayUnits.slice(0, 50).map((unit) => (
          <div key={`mobile-mic-${unit.id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="font-bold text-purple-700 text-sm">{unit.unit_code}</span>
                <span className="text-xs text-gray-500 ml-2">{unit.sample.date_received}</span>
              </div>
              {unit.coa_status && (
                <Link
                  to={`/microbiology-coa/${unit.id}`}
                  state={{ fromDatabase: true, department: 'Microbiology', readOnly: true }}
                  className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  View COA
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
              <div><span className="text-gray-500 text-xs">Company</span><p className="font-medium text-gray-800 truncate">{unit.sample.company}</p></div>
              <div><span className="text-gray-500 text-xs">Farm</span><p className="font-medium text-gray-800 truncate">{unit.sample.farm}</p></div>
              <div><span className="text-gray-500 text-xs">Sample Type</span><p className="font-medium text-gray-800 truncate">{unit.sample_type?.join(', ') || '-'}</p></div>
              <div><span className="text-gray-500 text-xs">Age</span><p className="font-medium text-gray-800">{unit.age || '-'}</p></div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500 block mb-2">Test Results</span>
              <div className="flex flex-wrap gap-2">
                {allDiseases.map((disease) => {
                  const result = getUnitDiseaseResult(unit, disease, coaResults[unit.id]);
                  if (result === null) return null;
                  const isPositive = result === 'Detected' || result === 'Over Limit';
                  return (
                    <span key={disease} className={`px-2 py-1 rounded text-xs font-medium ${isPositive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {disease}: {result}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        {filteredDisplayUnits.length > 50 && (
          <p className="text-center text-sm text-gray-500 py-2">Showing first 50 of {filteredDisplayUnits.length} records. Use desktop for full view.</p>
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
                    const result = getUnitDiseaseResult(unit, disease, coaResults[unit.id]);
                    if (result === null) {
                      return (
                        <td key={disease} className="px-4 py-2 border border-gray-300 text-center text-gray-400 whitespace-nowrap">-</td>
                      );
                    }
                    const isPositive = result === 'Detected' || result === 'Over Limit';
                    return (
                      <td key={disease} className={`px-4 py-2 border border-gray-300 text-center font-semibold whitespace-nowrap ${isPositive ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {result}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap">
                    {getUnitIsolateType(coaResults[unit.id])}
                  </td>
                  <td className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap">
                    {getUnitPositiveLocations(unit, coaResults[unit.id])}
                  </td>
                  <td className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap">
                    {unit.coa_status ? (
                      <Link
                        to={`/microbiology-coa/${unit.id}`}
                        state={{ fromDatabase: true, department: 'Microbiology', readOnly: true }}
                        className="px-2 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
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
