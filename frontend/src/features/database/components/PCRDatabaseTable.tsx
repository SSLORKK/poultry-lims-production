import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiClient } from '../../../services/apiClient';
import * as XLSX from 'xlsx-js-style';
import { Sample, Unit, PCRCOAData, DatabaseFilters, DEPARTMENT_IDS } from '../types';

interface PCRDatabaseTableProps {
  units: Array<Unit & { sample: Sample }>;
  totalUnits: number;
  totalCount: number;
  diseases: string[];
  renderCTCell: (value: string | undefined) => React.ReactElement;
  selectedSampleTypes: string[];
  resultsFilter: string;
  visibleColumns: Record<string, boolean>;
  page: number;
  onPageChange: (page: number) => void;
  filters: DatabaseFilters;
}

export function PCRDatabaseTable({
  units,
  totalUnits,
  totalCount,
  diseases,
  renderCTCell,
  selectedSampleTypes,
  resultsFilter,
  visibleColumns,
  page,
  onPageChange,
  filters,
}: PCRDatabaseTableProps) {
  const location = useLocation();
  const [coaResults, setCoaResults] = useState<Record<number, PCRCOAData | null>>({});
  const [loading, setLoading] = useState(true);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  // Refetch COA data when navigating back to this page
  useEffect(() => {
    setRefetchKey(prev => prev + 1);
  }, [location.key]);

  // Fetch COA results for all units
  useEffect(() => {
    const fetchAllCOAResults = async () => {
      setLoading(true);
      const results: Record<number, PCRCOAData | null> = {};

      if (units.length === 0) {
        setCoaResults({});
        setLoading(false);
        return;
      }

      try {
        const unitIds = units.map(u => u.id);
        const response = await apiClient.get('/pcr-coa/batch/', {
          params: { unit_ids: unitIds.join(',') }
        });

        const coaList: PCRCOAData[] = response.data;
        coaList.forEach(coa => {
          results[coa.unit_id] = coa;
        });

        unitIds.forEach(unitId => {
          if (!results[unitId]) {
            results[unitId] = null;
          }
        });
      } catch (error) {
        console.error('Failed to fetch COAs:', error);
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
    if (!coa?.test_results) {
      return undefined;
    }

    let diseaseValue = (coa.test_results as any)[disease];
    
    if (!diseaseValue) {
      const allKeys = Object.keys(coa.test_results);
      const matchingKeys = allKeys.filter(key => key.startsWith(`${disease}|||`));
      if (matchingKeys.length > 0) {
        const mergedPools: any[] = [];
        matchingKeys.forEach(key => {
          const value = (coa.test_results as any)[key];
          if (Array.isArray(value)) {
            mergedPools.push(...value);
          }
        });
        if (mergedPools.length > 0) {
          diseaseValue = mergedPools;
        }
      }
    }
    
    if (!diseaseValue) return undefined;

    let pools: Array<{ houses: string; values: { [sampleType: string]: string }; pos_control: string }>;
    if (Array.isArray(diseaseValue)) {
      pools = diseaseValue;
    } else if (typeof diseaseValue === 'object') {
      pools = [{
        houses: '',
        values: diseaseValue,
        pos_control: diseaseValue['pos_control'] || diseaseValue['POS. CONTROL'] || diseaseValue['Pos. Control'] || ''
      }];
    } else {
      return undefined;
    }

    const allNumericCTValues: number[] = [];
    let hasNegative = false;

    pools.forEach(pool => {
      Object.entries(pool.values || {}).forEach(([key, value]) => {
        if (key === 'pos_control' || key === 'neg_control') return;
        const upperKey = key.toUpperCase();
        if (upperKey === 'POS. CONTROL' || upperKey === 'POS CONTROL' || upperKey === 'POS_CONTROL') return;

        const strVal = String(value || '');
        if (!strVal || strVal === '') return;
        
        const upperValue = strVal.toUpperCase();
        if (upperValue === 'N/A' || upperValue === 'NA') return;

        if (upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE') {
          hasNegative = true;
        } else {
          let numStr = strVal;
          if (strVal.toUpperCase().startsWith('CT:')) {
            numStr = strVal.substring(3).trim();
          }
          const num = parseFloat(numStr);
          if (!isNaN(num)) {
            allNumericCTValues.push(num);
          }
        }
      });
    });

    if (resultsFilter === 'Positive') {
      if (allNumericCTValues.length > 0) {
        const lowestCT = Math.min(...allNumericCTValues);
        return lowestCT.toString();
      }
      return undefined;
    } else if (resultsFilter === 'Negative') {
      return hasNegative ? 'NEG.' : undefined;
    } else {
      if (allNumericCTValues.length > 0) {
        const lowestCT = Math.min(...allNumericCTValues);
        return lowestCT.toString();
      }
      return hasNegative ? 'NEG.' : undefined;
    }
  };

  const exportToExcel = async () => {
    try {
      setExportDropdownOpen(false);

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

      updateProgress(5, 'Fetching all data...');
      
      // Prepare params for full export
      const params: any = {
        year: new Date().getFullYear(),
        department_id: DEPARTMENT_IDS.PCR, // department_id 1 = PCR
        skip: 0,
        limit: 100000,
      };
      
      if (filters.companies.length) params.company = filters.companies;
      if (filters.farms.length) params.farm = filters.farms;
      if (filters.flocks.length) params.flock = filters.flocks;
      if (filters.ages.length) params.age = filters.ages;
      if (filters.sampleTypes.length) params.sample_type = filters.sampleTypes;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      // Add PCR-specific backend filtering
      if (filters.pcrDiseases.length) params.diseases = filters.pcrDiseases;

      const response = await apiClient.get('/samples/', { params });
      const allSamples = response.data;
      
      // Extract units - all filtering now handled by backend
      let allUnits: Array<Unit & { sample: Sample }> = [];
      allSamples.forEach((sample: Sample) => {
        sample.units.forEach((unit: Unit) => {
          allUnits.push({ ...unit, sample });
        });
      });

      const totalRows = allUnits.length;
      updateProgress(15, `Found ${totalRows} records. Fetching COA data...`);

      // Fetch COAs for all units in batches
      const unitIds = allUnits.map(u => u.id);
      const batchSize = 100;
      const exportCoaResults: Record<number, PCRCOAData | null> = {};

      for (let i = 0; i < unitIds.length; i += batchSize) {
        const batchIds = unitIds.slice(i, i + batchSize);
        try {
          const coaResponse = await apiClient.get('/pcr-coa/batch/', {
            params: { unit_ids: batchIds.join(',') }
          });
          coaResponse.data.forEach((coa: PCRCOAData) => {
            exportCoaResults[coa.unit_id] = coa;
          });
        } catch (e) {
          console.error('Failed to fetch COA batch for export:', e);
        }
        const progress = 15 + ((i / unitIds.length) * 35);
        updateProgress(progress, 'Fetching COA results...');
      }

      updateProgress(50, 'Building Excel file...');

      const wb = XLSX.utils.book_new();
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
        'COA'
      ];
      wsData.push(headers);

      // Helper functions for export context using fetched COAs
      const getExportPoolHouses = (unitId: number): string => {
        const coa = exportCoaResults[unitId];
        if (!coa?.test_results) return '-';
        const housesSet = new Set<string>();
        Object.values(coa.test_results).forEach((diseaseValue: any) => {
          let pools: Array<{ houses: string }> = [];
          if (Array.isArray(diseaseValue)) pools = diseaseValue;
          else if (typeof diseaseValue === 'object') pools = [{ houses: diseaseValue.indices || diseaseValue.houses || '' }];
          pools.forEach(pool => {
            if (pool.houses && pool.houses.trim() !== '') housesSet.add(pool.houses.trim());
          });
        });
        const housesList = Array.from(housesSet);
        return housesList.length > 0 ? housesList.join(', ') : '-';
      };

      const getExportCTValue = (unitId: number, disease: string): string | undefined => {
        const coa = exportCoaResults[unitId];
        if (!coa?.test_results) return undefined;

        let diseaseValue = (coa.test_results as any)[disease];
        if (!diseaseValue) {
          const allKeys = Object.keys(coa.test_results);
          const matchingKeys = allKeys.filter(key => key.startsWith(`${disease}|||`));
          if (matchingKeys.length > 0) {
            const mergedPools: any[] = [];
            matchingKeys.forEach(key => {
              const value = (coa.test_results as any)[key];
              if (Array.isArray(value)) mergedPools.push(...value);
            });
            if (mergedPools.length > 0) diseaseValue = mergedPools;
          }
        }
        if (!diseaseValue) return undefined;

        let pools: Array<{ houses: string; values: { [sampleType: string]: string }; pos_control: string }> = [];
        if (Array.isArray(diseaseValue)) pools = diseaseValue;
        else if (typeof diseaseValue === 'object') pools = [{
          houses: '',
          values: diseaseValue,
          pos_control: diseaseValue['pos_control'] || diseaseValue['POS. CONTROL'] || ''
        }];
        else return undefined;

        const allNumericCTValues: number[] = [];
        let hasNegative = false;

        pools.forEach(pool => {
          Object.entries(pool.values || {}).forEach(([key, value]) => {
            if (key === 'pos_control' || key === 'neg_control') return;
            const upperKey = key.toUpperCase();
            if (upperKey === 'POS. CONTROL' || upperKey === 'POS CONTROL' || upperKey === 'POS_CONTROL') return;
            const strVal = String(value || '');
            if (!strVal || strVal === '') return;
            const upperValue = strVal.toUpperCase();
            if (upperValue === 'N/A' || upperValue === 'NA') return;

            if (upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE') {
              hasNegative = true;
            } else {
              let numStr = strVal;
              if (strVal.toUpperCase().startsWith('CT:')) numStr = strVal.substring(3).trim();
              const num = parseFloat(numStr);
              if (!isNaN(num)) allNumericCTValues.push(num);
            }
          });
        });

        const filter = filters.resultsFilter;
        if (filter === 'Positive') {
          if (allNumericCTValues.length > 0) return Math.min(...allNumericCTValues).toString();
          return undefined;
        } else if (filter === 'Negative') {
          return hasNegative ? 'NEG.' : undefined;
        } else {
          if (allNumericCTValues.length > 0) return Math.min(...allNumericCTValues).toString();
          return hasNegative ? 'NEG.' : undefined;
        }
      };

      const CHUNK_SIZE = 1000;
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = allUnits.slice(i, Math.min(i + CHUNK_SIZE, totalRows));

        const progress = 50 + ((i / totalRows) * 40);
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
            getExportPoolHouses(unit.id),
            unit.age || '-',
            Array.isArray(unit.source) ? unit.source.join(', ') : unit.source || '-',
            selectedSampleTypes.length > 0
              ? (unit.sample_type?.filter((st: string) => selectedSampleTypes.includes(st)).join(', ') || '-')
              : (unit.sample_type?.join(', ') || '-'),
          ];

          let hasMatchingResult = false;
          diseases.forEach((disease) => {
            const value = getExportCTValue(unit.id, disease);
            if (value !== undefined) hasMatchingResult = true;
            row.push(value || '-');
          });

          // Add COA status
          row.push(unit.coa_status || '-');

          // Respect results filter for including the row
          if (filters.resultsFilter !== 'All' && !hasMatchingResult) {
            // Skip this row if it doesn't match the result filter
            return; 
          }

          wsData.push(row);
        });

        await new Promise(resolve => setTimeout(resolve, 0));
      }

      updateProgress(65, 'Generating Excel file...');
      await new Promise(resolve => setTimeout(resolve, 10));

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'PCR Results');
      const ws = XLSX.utils.aoa_to_sheet(wsData);

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
                  fill: { patternType: 'solid', fgColor: { rgb: 'FFD4EDDA' }, bgColor: { rgb: 'FFD4EDDA' } },
                  font: { color: { rgb: 'FF155724' }, bold: true },
                };
              } else if (!value.includes(':') && value !== '-' && !isNaN(parseFloat(value))) {
                cell.s = {
                  fill: { patternType: 'solid', fgColor: { rgb: 'FFF8D7DA' }, bgColor: { rgb: 'FFF8D7DA' } },
                  font: { color: { rgb: 'FFC82333' }, bold: true },
                };
              } else if (value.includes(':')) {
                cell.s = {
                  fill: { patternType: 'solid', fgColor: { rgb: 'FFF8D7DA' }, bgColor: { rgb: 'FFF8D7DA' } },
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

          diseases.forEach((disease) => {
            const value = getCTValue(unit.id, disease) || '-';
            row.push(value);
          });

          chunkRows.push(row.join(','));
        });

        csvChunks.push(...chunkRows);

        if (i + CHUNK_SIZE < totalRows) {
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

  const filteredByResults = useMemo(() => {
    return units;
  }, [units]);

  const expandedRows = useMemo(() => {
    const rows: Array<{
      unit: Unit & { sample: Sample };
      poolIndex: number;
      poolHouses: string;
      poolData: { [disease: string]: { values: { [sampleType: string]: string }; pos_control: string } };
      sampleTypes?: string[];
    }> = [];

    filteredByResults.forEach(unit => {
      const coa = coaResults[unit.id];
      if (!coa?.test_results) {
        rows.push({
          unit,
          poolIndex: 0,
          poolHouses: unit.house?.join(', ') || '-',
          poolData: {},
          sampleTypes: undefined
        });
        return;
      }

      const poolsMap = new Map<number, {
        houses: string;
        diseaseResults: { [disease: string]: { values: { [sampleType: string]: string }; pos_control: string } };
      }>();

      Object.entries(coa.test_results).forEach(([diseaseKey, diseaseValue]: [string, any]) => {
        const disease = diseaseKey.includes('|||') ? diseaseKey.split('|||')[0] : diseaseKey;
        
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
          if (!poolEntry.houses && pool.houses) {
            poolEntry.houses = pool.houses;
          }
        });
      });

      if (poolsMap.size === 0) {
        rows.push({
          unit,
          poolIndex: 0,
          poolHouses: unit.house?.join(', ') || '-',
          poolData: {},
          sampleTypes: coa.sample_types
        });
      } else {
        Array.from(poolsMap.entries()).forEach(([poolIdx, poolInfo]) => {
          rows.push({
            unit,
            poolIndex: poolIdx,
            poolHouses: poolInfo.houses || unit.house?.join(', ') || '-',
            poolData: poolInfo.diseaseResults,
            sampleTypes: coa.sample_types
          });
        });
      }
    });

    return rows;
  }, [filteredByResults, coaResults]);

  const getPoolCTValue = (poolData: any, disease: string, sampleTypesArray?: string[]): string | undefined => {
    const diseaseData = poolData[disease];
    if (!diseaseData) return undefined;

    const values = diseaseData.values || {};

    const getSampleTypeName = (key: string): string => {
      if (key.startsWith('col_') && sampleTypesArray) {
        const idx = parseInt(key.replace('col_', ''), 10);
        if (!isNaN(idx) && idx < sampleTypesArray.length) {
          return sampleTypesArray[idx];
        }
      }
      return key;
    };

    const allValidValues: string[] = [];
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'pos_control' || key === 'neg_control') return;
      const strValue = String(value || '');
      if (strValue && strValue !== '') {
        const upperValue = strValue.toUpperCase();
        if (upperValue !== 'N/A' && upperValue !== 'NA') {
          allValidValues.push(strValue);
        }
      }
    });

    if (selectedSampleTypes.length > 0) {
      for (const sampleType of selectedSampleTypes) {
        const specificValue = values[sampleType];
        if (!specificValue || specificValue === '') continue;

        const upperValue = specificValue.toUpperCase();
        if (upperValue === 'N/A' || upperValue === 'NA') continue;

        const isNegative = upperValue === 'NEG' || upperValue === 'NEG.' || upperValue === 'NEGATIVE';
        const isPositive = !isNegative && !isNaN(parseFloat(specificValue));

        if (resultsFilter === 'Positive' && !isPositive) continue;
        if (resultsFilter === 'Negative' && !isNegative) continue;

        return specificValue;
      }
      if (allValidValues.length === 0) return undefined;
    }

    const sampleTypeEntries: Array<[string, string]> = [];
    Object.entries(values).forEach(([st, value]) => {
      const upperKey = st.toUpperCase();
      if (upperKey === 'POS. CONTROL' || upperKey === 'POS CONTROL' || upperKey === 'POS_CONTROL') return;
      if (st === 'pos_control' || st === 'neg_control') return;

      const upperValue = (value as string)?.toUpperCase() || '';
      if (value && value !== '' && upperValue !== 'N/A' && upperValue !== 'NA') {
        const displayName = getSampleTypeName(st);
        sampleTypeEntries.push([displayName, value as string]);
      }
    });

    if (sampleTypeEntries.length === 0) return undefined;

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

    if (resultsFilter === 'Positive') {
      if (numericEntries.length > 0) {
        const lowestEntry = numericEntries.reduce((min, curr) => curr.ct < min.ct ? curr : min);
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
        const lowestEntry = numericEntries.reduce((min, curr) => curr.ct < min.ct ? curr : min);
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

  const sampleTypeColumnLabel = selectedSampleTypes.length > 0 ? selectedSampleTypes.join(', ') : 'Sample Type';
  const showAllSampleTypes = selectedSampleTypes.length === 0;

  return (
    <>
      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3 mb-4">
        {expandedRows.slice(0, 50).map((row, rowIdx) => (
          <div key={`mobile-${row.unit.id}-${row.poolIndex}-${rowIdx}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="font-bold text-blue-700 text-sm">{row.unit.unit_code}</span>
                <span className="text-xs text-gray-500 ml-2">{row.unit.sample.date_received}</span>
              </div>
              {row.unit.coa_status && (
                <Link
                  to={`/pcr-coa/${row.unit.id}`}
                  state={{ fromDatabase: true, department: 'PCR', readOnly: true }}
                  className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  View COA
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
              <div><span className="text-gray-500 text-xs">Company</span><p className="font-medium text-gray-800 truncate">{row.unit.sample.company}</p></div>
              <div><span className="text-gray-500 text-xs">Farm</span><p className="font-medium text-gray-800 truncate">{row.unit.sample.farm}</p></div>
              <div><span className="text-gray-500 text-xs">House</span><p className="font-medium text-gray-800">{row.poolHouses}</p></div>
              <div><span className="text-gray-500 text-xs">Age</span><p className="font-medium text-gray-800">{row.unit.age || '-'}</p></div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <span className="text-xs text-gray-500 block mb-2">Test Results</span>
              <div className="flex flex-wrap gap-2">
                {diseases.map((disease) => {
                  const ctValue = getPoolCTValue(row.poolData, disease, row.sampleTypes);
                  if (!ctValue) return null;
                  const isPositive = ctValue !== 'NEG.' && !ctValue.includes('NEG');
                  return (
                    <span key={disease} className={`px-2 py-1 rounded text-xs font-medium ${isPositive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {disease}: {ctValue}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        {expandedRows.length > 50 && (
          <p className="text-center text-sm text-gray-500 py-2">Showing first 50 of {expandedRows.length} records. Use desktop for full view.</p>
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
                  {diseases.map((disease) => renderCTCell(getPoolCTValue(row.poolData, disease, row.sampleTypes)))}
                  <td className="px-4 py-2 border border-gray-300 text-center whitespace-nowrap">
                    {row.unit.coa_status ? (
                      <Link
                        to={`/pcr-coa/${row.unit.id}`}
                        state={{ fromDatabase: true, department: 'PCR', readOnly: true }}
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
                    <button onClick={exportToCSV} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
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

            {(() => {
              const itemsPerPage = 100;
              const effectiveTotal = totalCount;
              const totalPages = Math.max(1, Math.ceil(effectiveTotal / itemsPerPage));
              const pagesToShow = [];
              const startPage = Math.max(1, page - 2);
              const endPage = Math.min(totalPages, page + 2);
              for (let i = startPage; i <= endPage; i++) {
                pagesToShow.push(i);
              }
              const isLastPage = page >= totalPages;
              return (
                <>
                  {pagesToShow.map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`px-3 py-1 border rounded text-sm ${page === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={isLastPage}
                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    aria-label="Next page"
                  >
                    &rsaquo;
                  </button>
                  <button
                    onClick={() => onPageChange(Math.min(totalPages, page + 10))}
                    disabled={isLastPage}
                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    aria-label="Jump forward"
                  >
                    &raquo;
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
