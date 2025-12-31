import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { usePermissions } from "../../../hooks/usePermissions";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { apiClient } from "../../../services/apiClient";
import {
  useCompanies,
  useFarms,
  useFlocks,
  useCycles,
  useHouses,
  useSources,
  useSampleTypes,
  useDiseases,
  useKitTypes,
  useExtractionMethods,
  DropdownItem,
} from "../../controls/hooks/useControlsData";
import { DiseaseKitSelector } from "./DiseaseKitSelector";

interface Department {
  id: number;
  code: string;
  name: string;
}

export interface DiseaseKitItem {
  disease: string;
  kit_type: string;
  test_count?: number;
}

interface PCRData {
  diseases_list: DiseaseKitItem[];
  kit_type: string;
  technician_name?: string;
  extraction_method?: string;
  extraction?: number;
  detection?: number;
}

interface SerologyData {
  diseases_list: DiseaseKitItem[];
  kit_type: string;
  number_of_wells: number;
  tests_count?: number;
  technician_name?: string;
}

interface MicrobiologyData {
  diseases_list: string[];
  batch_no: string;
  fumigation: string;
  index_list: string[];
  technician_name?: string;
}

interface UnitData {
  id?: number;
  unit_code?: string;
  department_id: number;
  house: string[]; // Changed to array for multi-select
  age: string;
  source: string[]; // Changed to array for multi-select
  sample_type: string[]; // Changed to array for multi-select
  samples_number: number;
  notes: string;
  pcr_data?: PCRData;
  serology_data?: SerologyData;
  microbiology_data?: MicrobiologyData;
}

interface UnitFieldsFormProps {
  unit: UnitData;
  globalIndex: number;
  updateUnit: (index: number, updates: Partial<UnitData>) => void;
  houses: DropdownItem[];
  sources: DropdownItem[];
  departments: Department[];
  departmentId: number;
  colors: {
    bg: string;
    border: string;
    chip: string;
    badge: string;
    gradient: string;
    text: string;
    focusRing: string;
    focusBorder: string;
    checkbox: string;
  };
}

function UnitFieldsForm({
  unit,
  globalIndex,
  updateUnit,
  houses,
  sources,
  departments,
  departmentId,
  colors,
}: UnitFieldsFormProps) {
  const { data: sampleTypes = [] } = useSampleTypes(departmentId);
  const [houseSearchTerm, setHouseSearchTerm] = useState("");
  const [sampleTypeSearchTerm, setSampleTypeSearchTerm] = useState("");
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");
  const [isHouseDropdownOpen, setIsHouseDropdownOpen] = useState(false);
  const [isSampleTypeDropdownOpen, setIsSampleTypeDropdownOpen] = useState(false);
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);
  const houseDropdownRef = useRef<HTMLDivElement>(null);
  const sampleTypeDropdownRef = useRef<HTMLDivElement>(null);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);

  // Check if current department is Serology
  const isSerology = departments.find(d => d.id === departmentId)?.code === 'SER';

  // Check if current department is Microbiology
  const isMicrobiology = departments.find(d => d.id === departmentId)?.code === 'MIC';

  // Check if current department is PCR
  const isPCR = departments.find(d => d.id === departmentId)?.code === 'PCR';

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (houseDropdownRef.current && !houseDropdownRef.current.contains(event.target as Node)) {
        setIsHouseDropdownOpen(false);
      }
      if (sampleTypeDropdownRef.current && !sampleTypeDropdownRef.current.contains(event.target as Node)) {
        setIsSampleTypeDropdownOpen(false);
      }
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setIsSourceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleHouse = (houseName: string) => {
    const currentHouses = unit.house || [];
    const newHouses = currentHouses.includes(houseName)
      ? currentHouses.filter((h) => h !== houseName)
      : [...currentHouses, houseName];
    updateUnit(globalIndex, { house: newHouses });
  };

  const toggleSampleType = (typeName: string) => {
    const currentTypes = unit.sample_type || [];
    const newTypes = currentTypes.includes(typeName)
      ? currentTypes.filter((t) => t !== typeName)
      : [...currentTypes, typeName];
    updateUnit(globalIndex, { sample_type: newTypes });
  };

  const toggleSource = (sourceName: string) => {
    const currentSources = unit.source || [];
    const newSources = currentSources.includes(sourceName)
      ? currentSources.filter((s) => s !== sourceName)
      : [...currentSources, sourceName];
    updateUnit(globalIndex, { source: newSources });
  };

  const filteredHouses = houses.filter(h =>
    h.name.toLowerCase().includes(houseSearchTerm.toLowerCase())
  );

  const filteredSampleTypes = sampleTypes.filter(st =>
    st.name.toLowerCase().includes(sampleTypeSearchTerm.toLowerCase())
  );

  const filteredSources = sources.filter(s =>
    s.name.toLowerCase().includes(sourceSearchTerm.toLowerCase())
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Houses Multi-Select Dropdown */}
        <div className="space-y-1.5" ref={houseDropdownRef}>
          <label className="block text-sm font-semibold text-gray-700">
            Houses
          </label>

          {/* Selected Houses Chips */}
          {(unit.house?.length || 0) > 0 && (
            <div className={`flex flex-wrap gap-1.5 p-2 ${colors.bg} rounded-lg border-2 ${colors.border} shadow-sm`}>
              {unit.house?.map((h) => (
                <span key={h} className={`inline-flex items-center gap-1 px-2.5 py-1 ${colors.chip} text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all`}>
                  {h}
                  <button
                    type="button"
                    onClick={() => toggleHouse(h)}
                    className="hover:scale-110 transition-transform"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsHouseDropdownOpen(!isHouseDropdownOpen)}
              className={`w-full border-2 rounded-xl px-4 py-3 text-left flex justify-between items-center transition-all ${(unit.house?.length || 0) > 0
                ? `bg-gradient-to-r from-${colors.bg} to-${colors.bg} border-${colors.border} shadow-md`
                : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                } focus:outline-none focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100`}
            >
              <span className={`font-medium ${(unit.house?.length || 0) > 0 ? 'text-gray-900' : 'text-gray-600'
                }`}>
                {(unit.house?.length || 0) > 0
                  ? `${unit.house.length} selected`
                  : 'Select houses'}
              </span>
              <svg className={`w-5 h-5 transition-transform duration-200 ${isHouseDropdownOpen ? 'rotate-180' : ''
                } ${(unit.house?.length || 0) > 0 ? colors.text : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isHouseDropdownOpen && (
              <div className={`absolute z-[9999] w-full mt-2 bg-white border-2 ${colors.border} rounded-xl shadow-2xl max-h-80 overflow-hidden`}>
                {/* Search and Actions */}
                <div className={`p-3 bg-gradient-to-r ${colors.gradient} border-b-2 ${colors.border}`}>
                  <input
                    type="text"
                    placeholder="Search houses..."
                    value={houseSearchTerm}
                    onChange={(e) => setHouseSearchTerm(e.target.value)}
                    className={`w-full border-2 ${colors.border} rounded-lg px-3 py-1.5 text-sm ${colors.focusBorder} ${colors.focusRing} transition-all`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Options List */}
                <div className="max-h-60 overflow-y-auto">
                  {filteredHouses.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-sm text-gray-500 font-medium">No houses found</p>
                    </div>
                  ) : (
                    filteredHouses.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-center px-4 py-2.5 cursor-pointer hover:${colors.bg} transition-colors border-b border-gray-100 last:border-b-0`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={(unit.house || []).includes(item.name)}
                          onChange={() => toggleHouse(item.name)}
                          className={`mr-3 h-5 w-5 ${colors.checkbox} rounded-md focus:ring-2 ${colors.focusRing} cursor-pointer`}
                        />
                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">Age</label>
          <input
            type="text"
            value={unit.age}
            onChange={(e) => updateUnit(globalIndex, { age: e.target.value })}
            className={`w-full border-2 rounded-xl px-4 py-2.5 transition-all ${unit.age && unit.age.trim() !== ''
              ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md focus:shadow-lg`
              : 'bg-gray-50 border-gray-300'
              } focus:bg-white focus:${colors.border} focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100`}
            placeholder="28 days or 4 weeks"
          />
        </div>

        {/* Source Multi-Select Dropdown */}
        <div className="space-y-1.5" ref={sourceDropdownRef}>
          <label className="block text-sm font-semibold text-gray-700">Source</label>

          {/* Selected Sources Chips */}
          {(unit.source?.length || 0) > 0 && (
            <div className={`flex flex-wrap gap-1.5 p-2 ${colors.bg} rounded-lg border-2 ${colors.border} shadow-sm`}>
              {unit.source?.map((s) => (
                <span key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 ${colors.chip} text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all`}>
                  {s}
                  <button
                    type="button"
                    onClick={() => toggleSource(s)}
                    className="hover:scale-110 transition-transform"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
              className={`w-full border-2 rounded-xl px-4 py-3 text-left flex justify-between items-center transition-all ${(unit.source?.length || 0) > 0
                ? `${colors.bg} ${colors.border} shadow-md`
                : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                } focus:outline-none focus:ring-4 focus:ring-blue-100`}
            >
              <span className={`font-medium ${(unit.source?.length || 0) > 0 ? 'text-gray-900' : 'text-gray-600'
                }`}>
                {(unit.source?.length || 0) > 0
                  ? `${unit.source.length} selected`
                  : 'Select sources'}
              </span>
              <svg className={`w-5 h-5 transition-transform duration-200 ${isSourceDropdownOpen ? 'rotate-180' : ''
                } text-gray-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isSourceDropdownOpen && (
              <div className={`absolute z-[9999] w-full mt-2 bg-white border-2 ${colors.border} rounded-xl shadow-2xl max-h-80 overflow-hidden`}>
                {/* Search */}
                <div className={`p-3 ${colors.bg} border-b-2 ${colors.border}`}>
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={sourceSearchTerm}
                    onChange={(e) => setSourceSearchTerm(e.target.value)}
                    className={`w-full border-2 ${colors.border} rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-100 transition-all`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Options List */}
                <div className="max-h-60 overflow-y-auto">
                  {filteredSources.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-sm text-gray-500 font-medium">No sources found</p>
                    </div>
                  ) : (
                    filteredSources.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-center px-4 py-2.5 cursor-pointer hover:${colors.bg} transition-colors border-b border-gray-100 last:border-b-0`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={(unit.source || []).includes(item.name)}
                          onChange={() => toggleSource(item.name)}
                          className={`mr-3 h-5 w-5 ${colors.checkbox} rounded-md focus:ring-2 ${colors.focusRing} cursor-pointer`}
                        />
                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5" ref={sampleTypeDropdownRef}>
          <label className="block text-sm font-semibold text-gray-700">
            Sample Types <span className="text-red-500">*</span>
          </label>

          {/* Selected Sample Types Chips */}
          {(unit.sample_type?.length || 0) > 0 && (
            <div className={`flex flex-wrap gap-1.5 p-2 ${colors.bg} rounded-lg border-2 ${colors.border} shadow-sm`}>
              {unit.sample_type?.map((st) => (
                <span key={st} className={`inline-flex items-center gap-1 px-2.5 py-1 ${colors.chip} text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all`}>
                  {st}
                  <button
                    type="button"
                    onClick={() => toggleSampleType(st)}
                    className="hover:scale-110 transition-transform"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSampleTypeDropdownOpen(!isSampleTypeDropdownOpen)}
              className={`w-full border-2 rounded-xl px-4 py-3 text-left flex justify-between items-center transition-all ${(unit.sample_type?.length || 0) > 0
                ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
                : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                } focus:outline-none focus:ring-4`}
            >
              <span className={`font-medium ${(unit.sample_type?.length || 0) > 0 ? 'text-gray-900' : 'text-gray-600'
                }`}>
                {(unit.sample_type?.length || 0) > 0
                  ? `${unit.sample_type.length} selected`
                  : 'Select sample types'}
              </span>
              <svg className={`w-5 h-5 transition-transform duration-200 ${isSampleTypeDropdownOpen ? 'rotate-180' : ''}
                } ${(unit.sample_type?.length || 0) > 0 ? colors.text : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isSampleTypeDropdownOpen && (
              <div className={`absolute z-[9999] w-full mt-2 bg-white border-2 ${colors.border} rounded-xl shadow-2xl max-h-80 overflow-hidden`}>
                {/* Search and Actions */}
                <div className={`p-3 bg-gradient-to-r ${colors.gradient} border-b-2 ${colors.border}`}>
                  <input
                    type="text"
                    placeholder="Search sample types..."
                    value={sampleTypeSearchTerm}
                    onChange={(e) => setSampleTypeSearchTerm(e.target.value)}
                    className={`w-full border-2 ${colors.border} rounded-lg px-3 py-1.5 text-sm ${colors.focusBorder} ${colors.focusRing} transition-all`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Options List */}
                <div className="max-h-60 overflow-y-auto">
                  {filteredSampleTypes.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-sm text-gray-500 font-medium">No sample types found</p>
                    </div>
                  ) : (
                    filteredSampleTypes.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-center px-4 py-2.5 cursor-pointer hover:${colors.bg} transition-colors border-b border-gray-100 last:border-b-0`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={(unit.sample_type || []).includes(item.name)}
                          onChange={() => toggleSampleType(item.name)}
                          className={`mr-3 h-5 w-5 ${colors.checkbox} rounded-md focus:ring-2 ${colors.focusRing} cursor-pointer`}
                        />
                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Samples Count - Hidden for PCR, shown for Serology and Microbiology */}
        {!isPCR && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              {isMicrobiology ? 'Sub-Samples Count' : 'Samples Count'} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={unit.samples_number || ''}
              onChange={(e) =>
                updateUnit(globalIndex, { samples_number: e.target.value ? parseInt(e.target.value) : null as unknown as number })
              }
              className={`w-full border-2 rounded-xl px-4 py-2.5 transition-all ${unit.samples_number && unit.samples_number > 0
                ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
                : 'bg-gray-50 border-gray-300'
                } focus:bg-white focus:${colors.border} focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              placeholder={isMicrobiology ? "Enter sub-samples count" : "Enter samples count"}
              onWheel={(e) => e.currentTarget.blur()}
            />
          </div>
        )}

        {/* Tests Count display for Serology - auto-calculated from diseases list */}
        {isSerology && unit.serology_data?.diseases_list && unit.serology_data.diseases_list.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Total Tests <span className="text-xs text-gray-500">(auto-calculated)</span>
            </label>
            <div className={`w-full border-2 rounded-xl px-4 py-2.5 bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md font-semibold`}>
              {unit.serology_data.diseases_list.reduce((sum, d) => sum + (d.test_count || 0), 0)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface PCRFieldsProps {
  unit: UnitData;
  globalIndex: number;
  updateUnit: (index: number, updates: Partial<UnitData>) => void;
  departmentId: number;
  colors: {
    bg: string;
    border: string;
    chip: string;
    badge: string;
    gradient: string;
    text: string;
    focusRing: string;
    focusBorder: string;
    checkbox: string;
  };
  setNotification: (notification: { type: 'success' | 'error' | 'warning' | 'info'; message: string } | null) => void;
}

function PCRFields({
  unit,
  globalIndex,
  updateUnit,
  departmentId,
  colors,
  setNotification,
}: PCRFieldsProps) {
  const { data: diseases = [] } = useDiseases(departmentId);
  const { data: kitTypes = [] } = useKitTypes(departmentId);
  const { data: extractionMethods = [] } = useExtractionMethods();
  const [technicianPIN, setTechnicianPIN] = useState('');
  const [verifyingPIN, setVerifyingPIN] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Arrow key navigation between fields
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!formRef.current) return;
    const focusableElements = formRef.current.querySelectorAll<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );
    const focusArray = Array.from(focusableElements);
    const currentIndex = focusArray.findIndex(el => el === document.activeElement);
    
    if (currentIndex === -1) return;
    
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % focusArray.length;
      focusArray[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + focusArray.length) % focusArray.length;
      focusArray[prevIndex]?.focus();
    } else if (e.key === 'ArrowRight' && e.target instanceof HTMLInputElement) {
      const input = e.target as HTMLInputElement;
      if (input.selectionStart === input.value.length) {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % focusArray.length;
        focusArray[nextIndex]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && e.target instanceof HTMLInputElement) {
      const input = e.target as HTMLInputElement;
      if (input.selectionStart === 0) {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + focusArray.length) % focusArray.length;
        focusArray[prevIndex]?.focus();
      }
    }
  };

  // Load default kit types from localStorage
  const getDefaultKitTypes = () => {
    try {
      const stored = localStorage.getItem('sample_registration_defaults');
      if (stored) {
        const defaults = JSON.parse(stored);
        return defaults.pcr_disease_kit_defaults || {};
      }
    } catch (e) {
      console.error('Error loading defaults:', e);
    }
    return {};
  };

  const verifyTechnicianPIN = async (pin: string) => {
    if (!pin || pin.length < 4 || verifyingPIN) return; // Prevent double calls
    setVerifyingPIN(true);
    try {
      const response = await apiClient.post('/controls/signatures/verify-pin', { pin });
      if (response.data.is_valid) {
        updateUnit(globalIndex, {
          pcr_data: {
            ...unit.pcr_data!,
            technician_name: response.data.name,
          },
        });
        setTechnicianPIN('');
        setNotification({ type: 'success', message: `Technician verified: ${response.data.name}` });
      } else {
        setNotification({ type: 'error', message: 'Invalid PIN. Please check and try again.' });
        setTechnicianPIN('');
      }
    } catch (error) {
      console.error('PIN verification failed:', error);
      setNotification({ type: 'error', message: 'PIN verification failed. Please try again.' });
      setTechnicianPIN('');
    }
    setVerifyingPIN(false);
  };

  return (
    <div ref={formRef} onKeyDown={handleKeyDown} className={`border-t-2 ${colors.border} pt-4 mt-4 space-y-4`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Extraction Method <span className="text-red-500">*</span>
          </label>
          <select
            value={unit.pcr_data?.extraction_method || ""}
            onChange={(e) =>
              updateUnit(globalIndex, {
                pcr_data: {
                  ...unit.pcr_data!,
                  extraction_method: e.target.value,
                },
              })
            }
            className={`w-full border-2 rounded-xl px-4 py-2.5 transition-all ${unit.pcr_data?.extraction_method && unit.pcr_data.extraction_method !== ''
              ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
              : 'bg-gray-50 border-gray-300'
              } focus:bg-white focus:${colors.border} focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100`}
          >
            <option value="">Select extraction method...</option>
            {extractionMethods.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Extraction <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={unit.pcr_data?.extraction || ""}
            onChange={(e) =>
              updateUnit(globalIndex, {
                pcr_data: {
                  ...unit.pcr_data!,
                  extraction: e.target.value ? parseInt(e.target.value) : undefined,
                },
              })
            }
            className={`w-full border-2 rounded-xl px-4 py-2.5 transition-all ${unit.pcr_data?.extraction
              ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
              : 'bg-gray-50 border-gray-300'
              } focus:bg-white focus:${colors.border} focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            placeholder="Enter extraction number"
            onWheel={(e) => e.currentTarget.blur()}
          />
        </div>

      </div>

      <DiseaseKitSelector
        availableDiseases={diseases}
        availableKitTypes={kitTypes}
        selectedDiseases={unit.pcr_data?.diseases_list || []}
        onChange={(diseases) => {
          // Calculate total test count from all selected diseases
          const totalTestCount = diseases.reduce((sum, d) => sum + (d.test_count || 1), 0);
          updateUnit(globalIndex, {
            pcr_data: { 
              ...unit.pcr_data!, 
              diseases_list: diseases,
              detection: totalTestCount > 0 ? totalTestCount : undefined
            },
          });
        }}
        departmentName="PCR"
        defaultKitTypes={getDefaultKitTypes()}
      />
      {(!unit.pcr_data?.diseases_list || unit.pcr_data.diseases_list.length === 0) && (
        <p className="text-xs text-red-600 mt-1">At least one disease required</p>
      )}

      {/* Technician field - last field */}
      <div className="space-y-1.5 mt-4">
        <label className="block text-sm font-semibold text-gray-700">
          Technician <span className="text-red-500">*</span>
        </label>
        {unit.pcr_data?.technician_name ? (
          <div className="flex items-center gap-2">
            <span className={`flex-1 border-2 rounded-xl px-4 py-2.5 bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md font-semibold`}>
              {unit.pcr_data.technician_name}
            </span>
            <button
              type="button"
              onClick={() => updateUnit(globalIndex, { pcr_data: { ...unit.pcr_data!, technician_name: '' } })}
              className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm font-semibold"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={technicianPIN}
              onChange={(e) => setTechnicianPIN(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && verifyTechnicianPIN(technicianPIN)}
              placeholder="Enter PIN to verify"
              className={`flex-1 border-2 ${colors.border} rounded-xl px-4 py-2.5 focus:ring-2 ${colors.focusRing}`}
              maxLength={8}
              disabled={verifyingPIN}
            />
            {verifyingPIN && <span className="text-sm text-gray-500">Verifying...</span>}
          </div>
        )}
        {(!unit.pcr_data?.technician_name || unit.pcr_data.technician_name === "") && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Enter PIN to verify technician
          </p>
        )}
      </div>
    </div>
  );
}

interface SerologyFieldsProps {
  unit: UnitData;
  globalIndex: number;
  updateUnit: (index: number, updates: Partial<UnitData>) => void;
  departmentId: number;
  colors: {
    bg: string;
    border: string;
    chip: string;
    badge: string;
    gradient: string;
    text: string;
    focusRing: string;
    focusBorder: string;
    checkbox: string;
  };
  setNotification: (notification: { type: 'success' | 'error' | 'warning' | 'info'; message: string } | null) => void;
}

function SerologyFields({
  unit,
  globalIndex,
  updateUnit,
  departmentId,
  colors,
  setNotification,
}: SerologyFieldsProps) {
  const { data: diseases = [] } = useDiseases(departmentId);
  const { data: kitTypes = [] } = useKitTypes(departmentId);
  const [technicianPIN, setTechnicianPIN] = useState('');
  const [verifyingPIN, setVerifyingPIN] = useState(false);

  // Load default kit types from localStorage
  const getDefaultKitTypes = () => {
    try {
      const stored = localStorage.getItem('sample_registration_defaults');
      if (stored) {
        const defaults = JSON.parse(stored);
        return defaults.serology_disease_kit_defaults || {};
      }
    } catch (e) {
      console.error('Error loading defaults:', e);
    }
    return {};
  };

  const verifyTechnicianPIN = async (pin: string) => {
    if (!pin || pin.length < 4 || verifyingPIN) return; // Prevent double calls
    setVerifyingPIN(true);
    try {
      const response = await apiClient.post('/controls/signatures/verify-pin', { pin });
      if (response.data.is_valid) {
        updateUnit(globalIndex, {
          serology_data: {
            ...unit.serology_data!,
            technician_name: response.data.name,
          },
        });
        setTechnicianPIN('');
        setNotification({ type: 'success', message: `Technician verified: ${response.data.name}` });
      } else {
        setNotification({ type: 'error', message: 'Invalid PIN. Please check and try again.' });
        setTechnicianPIN('');
      }
    } catch (error) {
      console.error('PIN verification failed:', error);
      setNotification({ type: 'error', message: 'PIN verification failed. Please try again.' });
      setTechnicianPIN('');
    }
    setVerifyingPIN(false);
  };

  return (
    <div className={`border-t-2 ${colors.border} pt-4 mt-4 space-y-4`}>
      <DiseaseKitSelector
        availableDiseases={diseases}
        availableKitTypes={kitTypes}
        selectedDiseases={unit.serology_data?.diseases_list || []}
        onChange={(diseases) =>
          updateUnit(globalIndex, {
            serology_data: { ...unit.serology_data!, diseases_list: diseases },
          })
        }
        departmentName="Serology"
        defaultKitTypes={getDefaultKitTypes()}
      />
      {(!unit.serology_data?.diseases_list || unit.serology_data.diseases_list.length === 0) && (
        <p className="text-xs text-red-600 mt-1">At least one disease required</p>
      )}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">
          Wells Count <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="1"
          value={unit.serology_data?.number_of_wells || ""}
          onChange={(e) =>
            updateUnit(globalIndex, {
              serology_data: {
                ...unit.serology_data!,
                number_of_wells: parseInt(e.target.value) || 0,
              },
            })
          }
          className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="Enter wells count"
          onWheel={(e) => e.currentTarget.blur()}
        />
        {(!unit.serology_data?.number_of_wells || unit.serology_data.number_of_wells <= 0) && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Wells count required
          </p>
        )}
      </div>

      {/* Technician field - last field */}
      <div className="space-y-1.5 mt-4">
        <label className="block text-sm font-semibold text-gray-700">
          Technician <span className="text-red-500">*</span>
        </label>
        {unit.serology_data?.technician_name ? (
          <div className="flex items-center gap-2">
            <span className={`flex-1 border-2 rounded-xl px-4 py-2.5 bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md font-semibold`}>
              {unit.serology_data.technician_name}
            </span>
            <button
              type="button"
              onClick={() => updateUnit(globalIndex, { serology_data: { ...unit.serology_data!, technician_name: '' } })}
              className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm font-semibold"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={technicianPIN}
              onChange={(e) => setTechnicianPIN(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && verifyTechnicianPIN(technicianPIN)}
              placeholder="Enter PIN to verify"
              className={`flex-1 border-2 ${colors.border} rounded-xl px-4 py-2.5 focus:ring-2 ${colors.focusRing}`}
              maxLength={8}
              disabled={verifyingPIN}
            />
            {verifyingPIN && <span className="text-sm text-gray-500">Verifying...</span>}
          </div>
        )}
        {(!unit.serology_data?.technician_name || unit.serology_data.technician_name === "") && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Enter PIN to verify technician
          </p>
        )}
      </div>
    </div>
  );
}

interface MicrobiologyFieldsProps {
  unit: UnitData;
  globalIndex: number;
  updateUnit: (index: number, updates: Partial<UnitData>) => void;
  departmentId: number;
  colors: {
    bg: string;
    border: string;
    chip: string;
    badge: string;
    gradient: string;
    text: string;
    focusRing: string;
    focusBorder: string;
    checkbox: string;
  };
  setNotification: (notification: { type: 'success' | 'error' | 'warning' | 'info'; message: string } | null) => void;
}

function MicrobiologyFields({
  unit,
  globalIndex,
  updateUnit,
  departmentId,
  colors,
  setNotification,
}: MicrobiologyFieldsProps) {
  const { data: diseases = [] } = useDiseases(departmentId);
  const [bulkLocations, setBulkLocations] = useState("");
  const [isDiseaseDropdownOpen, setIsDiseaseDropdownOpen] = useState(false);
  const diseaseDropdownRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [technicianPIN, setTechnicianPIN] = useState('');
  const [verifyingPIN, setVerifyingPIN] = useState(false);

  const verifyTechnicianPIN = async (pin: string) => {
    if (!pin || pin.length < 4 || verifyingPIN) return; // Prevent double calls
    setVerifyingPIN(true);
    try {
      const response = await apiClient.post('/controls/signatures/verify-pin', { pin });
      if (response.data.is_valid) {
        updateUnit(globalIndex, {
          microbiology_data: {
            ...unit.microbiology_data!,
            technician_name: response.data.name,
          },
        });
        setTechnicianPIN('');
        setNotification({ type: 'success', message: `Technician verified: ${response.data.name}` });
      } else {
        setNotification({ type: 'error', message: 'Invalid PIN. Please check and try again.' });
        setTechnicianPIN('');
      }
    } catch (error) {
      console.error('PIN verification failed:', error);
      setNotification({ type: 'error', message: 'PIN verification failed. Please try again.' });
      setTechnicianPIN('');
    }
    setVerifyingPIN(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (diseaseDropdownRef.current && !diseaseDropdownRef.current.contains(event.target as Node)) {
        setIsDiseaseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDisease = (diseaseName: string) => {
    const currentDiseases = unit.microbiology_data?.diseases_list || [];
    const newDiseases = currentDiseases.includes(diseaseName)
      ? currentDiseases.filter((d) => d !== diseaseName)
      : [...currentDiseases, diseaseName];
    updateUnit(globalIndex, {
      microbiology_data: {
        ...unit.microbiology_data!,
        diseases_list: newDiseases,
      },
    });
  };

  const importBulkLocations = () => {
    if (!bulkLocations.trim()) return;
    const newLocations = bulkLocations
      .split("\n")
      .map((loc) => loc.trim())
      .filter((loc) => loc);
    const currentLocations = unit.microbiology_data?.index_list || [];
    const uniqueLocations = [
      ...new Set([...currentLocations, ...newLocations]),
    ];
    updateUnit(globalIndex, {
      microbiology_data: {
        ...unit.microbiology_data!,
        index_list: uniqueLocations,
      },
    });
    setBulkLocations("");
  };

  const removeLocation = (location: string) => {
    const currentLocations = unit.microbiology_data?.index_list || [];
    updateUnit(globalIndex, {
      microbiology_data: {
        ...unit.microbiology_data!,
        index_list: currentLocations.filter((loc) => loc !== location),
      },
    });
  };

  // Drag and drop state for reordering locations
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIdx) {
      setDraggedIndex(null);
      return;
    }
    const currentLocations = [...(unit.microbiology_data?.index_list || [])];
    const [draggedItem] = currentLocations.splice(draggedIndex, 1);
    currentLocations.splice(dropIdx, 0, draggedItem);
    updateUnit(globalIndex, {
      microbiology_data: {
        ...unit.microbiology_data!,
        index_list: currentLocations,
      },
    });
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const startEditLocation = (idx: number, location: string) => {
    setEditingIndex(idx);
    setEditValue(location);
  };

  const saveEditLocation = (idx: number) => {
    if (!editValue.trim()) return;
    const currentLocations = unit.microbiology_data?.index_list || [];
    const newLocations = [...currentLocations];
    newLocations[idx] = editValue.trim();
    updateUnit(globalIndex, {
      microbiology_data: {
        ...unit.microbiology_data!,
        index_list: newLocations,
      },
    });
    setEditingIndex(null);
    setEditValue("");
  };

  const cancelEditLocation = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  return (
    <div className="border-t-2 border-purple-200 pt-4 mt-4 space-y-4">
      {/* Diseases Dropdown Multi-Select */}
      <div className="space-y-1.5" ref={diseaseDropdownRef}>
        <label className="block text-sm font-semibold text-gray-700">
          Diseases <span className="text-red-500">*</span>
        </label>

        {/* Selected Diseases Chips */}
        {(unit.microbiology_data?.diseases_list?.length || 0) > 0 && (
          <div className={`flex flex-wrap gap-1.5 p-2 bg-gradient-to-r ${colors.gradient} rounded-lg border-2 ${colors.border} shadow-sm`}>
            {unit.microbiology_data?.diseases_list?.map((disease) => (
              <span key={disease} className={`inline-flex items-center gap-1 px-2.5 py-1 ${colors.badge} text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all`}>
                {disease}
                <button
                  type="button"
                  onClick={() => toggleDisease(disease)}
                  className="hover:scale-110 transition-transform"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Dropdown Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDiseaseDropdownOpen(!isDiseaseDropdownOpen)}
            className={`w-full border-2 rounded-xl px-4 py-3 text-left flex justify-between items-center transition-all ${(unit.microbiology_data?.diseases_list?.length || 0) > 0
              ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
              : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
              } focus:outline-none focus:ring-4`}
          >
            <span className={`font-medium ${(unit.microbiology_data?.diseases_list?.length || 0) > 0 ? 'text-purple-900' : 'text-gray-600'
              }`}>
              {((unit.microbiology_data?.diseases_list?.length || 0) > 0)
                ? `${(unit.microbiology_data?.diseases_list?.length || 0)} selected`
                : 'Select diseases'}
            </span>
            <svg className={`w-5 h-5 transition-transform duration-200 ${isDiseaseDropdownOpen ? 'rotate-180' : ''
              } ${(unit.microbiology_data?.diseases_list?.length || 0) > 0 ? colors.badge.replace('bg-', 'text-') : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDiseaseDropdownOpen && (
            <div className={`absolute z-[9999] w-full mt-2 bg-white border-2 ${colors.border} rounded-xl shadow-2xl max-h-80 overflow-hidden`}>
              {/* Search and Actions */}
              <div className={`p-3 bg-gradient-to-r ${colors.gradient} border-b-2 ${colors.border}`}>
                {/* Removed Select All / Clear All buttons */}
              </div>

              {/* Options List */}
              <div className="max-h-60 overflow-y-auto">
                {diseases.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">No diseases found</p>
                  </div>
                ) : (
                  diseases.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center px-4 py-2.5 cursor-pointer hover:${colors.bg} transition-colors border-b border-gray-100 last:border-b-0`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={(unit.microbiology_data?.diseases_list || []).includes(item.name)}
                        onChange={() => toggleDisease(item.name)}
                        className={`mr-3 h-5 w-5 ${colors.badge.replace('bg-', 'text-')} rounded-md focus:ring-2 cursor-pointer`}
                      />
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {(!unit.microbiology_data?.diseases_list || unit.microbiology_data.diseases_list.length === 0) && (
          <p className="text-xs text-red-600 mt-1">At least one disease required</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">Batch No.</label>
        <input
          type="text"
          value={unit.microbiology_data?.batch_no || ""}
          onChange={(e) =>
            updateUnit(globalIndex, {
              microbiology_data: {
                ...unit.microbiology_data!,
                batch_no: e.target.value,
              },
            })
          }
          className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
          onWheel={(e) => e.currentTarget.blur()}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">Fumigation</label>
        <select
          value={unit.microbiology_data?.fumigation || ""}
          onChange={(e) =>
            updateUnit(globalIndex, {
              microbiology_data: {
                ...unit.microbiology_data!,
                fumigation: e.target.value,
              },
            })
          }
          className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
        >
          <option value="">Select fumigation...</option>
          <option value="Before Fumigation">Before Fumigation</option>
          <option value="After Fumigation">After Fumigation</option>
        </select>
      </div>

      {/* Bulk Import Locations Only */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          Sample Index <span className="text-red-500">*</span>
        </label>

        <div className="border-2 border-gray-300 rounded-xl p-4 bg-gray-50">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Paste multiple locations (one per line):
          </label>
          <textarea
            value={bulkLocations}
            onChange={(e) => setBulkLocations(e.target.value)}
            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 bg-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            rows={5}
            placeholder="Paste locations here"
          />
          <button
            type="button"
            onClick={importBulkLocations}
            className={`mt-3 px-4 py-2 ${colors.badge} text-white text-sm font-semibold rounded-lg hover:opacity-90 shadow-sm hover:shadow transition-all`}
          >
            Import
          </button>
        </div>

        {/* Locations List with Edit and Remove Buttons */}
        {(unit.microbiology_data?.index_list?.length || 0) > 0 && (
          <div className="border-2 border-gray-300 rounded-xl p-4 bg-white">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Added Locations ({unit.microbiology_data?.index_list?.length}):
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {unit.microbiology_data?.index_list?.map((location, idx) => (
                <div
                  key={idx}
                  draggable={editingIndex !== idx}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors cursor-move ${
                    draggedIndex === idx ? 'opacity-50 bg-purple-100' : ''
                  }`}
                >
                  {editingIndex === idx ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 border-2 border-blue-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditLocation(idx);
                          if (e.key === 'Escape') cancelEditLocation();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => saveEditLocation(idx)}
                        className="text-green-600 hover:text-green-800 text-sm font-semibold"
                      >
                        ✓ Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditLocation}
                        className="text-gray-600 hover:text-gray-800 text-sm font-semibold"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 cursor-grab" title="Drag to reorder">⋮⋮</span>
                        <span className="text-sm font-medium text-gray-700">
                          {idx + 1}. {location}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditLocation(idx, location)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-semibold hover:scale-110 transition-all"
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLocation(location)}
                          className="text-red-600 hover:text-red-800 text-sm font-semibold hover:scale-110 transition-all"
                        >
                          × Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {(!unit.microbiology_data?.index_list || unit.microbiology_data.index_list.length === 0) && (
          <p className="text-xs text-red-600 mt-1">At least one location required</p>
        )}
      </div>

      {/* Technician field - last field */}
      <div className="space-y-1.5 mt-4">
        <label className="block text-sm font-semibold text-gray-700">
          Technician <span className="text-red-500">*</span>
        </label>
        {unit.microbiology_data?.technician_name ? (
          <div className="flex items-center gap-2">
            <span className={`flex-1 border-2 rounded-xl px-4 py-2.5 bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md font-semibold`}>
              {unit.microbiology_data.technician_name}
            </span>
            <button
              type="button"
              onClick={() => updateUnit(globalIndex, { microbiology_data: { ...unit.microbiology_data!, technician_name: '' } })}
              className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm font-semibold"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={technicianPIN}
              onChange={(e) => setTechnicianPIN(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && verifyTechnicianPIN(technicianPIN)}
              placeholder="Enter PIN to verify"
              className={`flex-1 border-2 ${colors.border} rounded-xl px-4 py-2.5 focus:ring-2 ${colors.focusRing}`}
              maxLength={8}
              disabled={verifyingPIN}
            />
            {verifyingPIN && <span className="text-sm text-gray-500">Verifying...</span>}
          </div>
        )}
        {(!unit.microbiology_data?.technician_name || unit.microbiology_data.technician_name === "") && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Enter PIN to verify technician
          </p>
        )}
      </div>
    </div>
  );
}

export const UnifiedSampleRegistration = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { canRead, isLoading: permissionsLoading } = usePermissions();
  const { user, isLoading: userLoading } = useCurrentUser();
  const hasReadAccess = canRead('Register Sample');

  // Check permission - redirect if no access
  if (!permissionsLoading && !hasReadAccess) {
    return <Navigate to="/" replace />;
  }

  // Detect edit mode from URL query parameter
  const editSampleId = searchParams.get("edit");
  const isEditMode = !!editSampleId;
  
  // Detect duplicate mode from URL query parameter
  const duplicateSampleId = searchParams.get("duplicate");
  const isDuplicateMode = !!duplicateSampleId;

  // UI state
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());
  const [completedFields, setCompletedFields] = useState<{
    sampleInfo: boolean;
    units: { [key: number]: boolean };
  }>({ sampleInfo: false, units: {} });

  // Load persisted draft from localStorage (user-specific)
  const loadDraft = () => {
    if (isEditMode || isDuplicateMode || !user?.id) return null;
    try {
      const draftKey = `sample_registration_draft_user_${user.id}`;
      const draft = localStorage.getItem(draftKey);
      return draft ? JSON.parse(draft) : null;
    } catch {
      return null;
    }
  };

  const draft = !userLoading ? loadDraft() : null;

  // Shared sample-level fields
  const [dateReceived, setDateReceived] = useState(draft?.dateReceived || "");
  const [company, setCompany] = useState(draft?.company || "");
  const [farm, setFarm] = useState<string[]>(draft?.farm || []);
  const [cycle, setCycle] = useState(draft?.cycle || "");
  const [flock, setFlock] = useState(draft?.flock || "");
  const [status, setStatus] = useState(draft?.status || "In Progress");

  // Units array - each unit has its own fields
  const [units, setUnits] = useState<UnitData[]>(draft?.units || []);
  
  // Edit history dialog state
  const [editHistoryDialog, setEditHistoryDialog] = useState<{ open: boolean; history: any[] }>({
    open: false,
    history: []
  });

  // Searchable dropdown states for sample info fields
  const [companySearch, setCompanySearch] = useState('');
  const [farmSearch, setFarmSearch] = useState('');
  const [cycleSearch, setCycleSearch] = useState('');
  const [flockSearch, setFlockSearch] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isFarmDropdownOpen, setIsFarmDropdownOpen] = useState(false);
  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const [isFlockDropdownOpen, setIsFlockDropdownOpen] = useState(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const farmDropdownRef = useRef<HTMLDivElement>(null);
  const cycleDropdownRef = useRef<HTMLDivElement>(null);
  const flockDropdownRef = useRef<HTMLDivElement>(null);

  // Close sample info dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
      if (farmDropdownRef.current && !farmDropdownRef.current.contains(event.target as Node)) {
        setIsFarmDropdownOpen(false);
      }
      if (cycleDropdownRef.current && !cycleDropdownRef.current.contains(event.target as Node)) {
        setIsCycleDropdownOpen(false);
      }
      if (flockDropdownRef.current && !flockDropdownRef.current.contains(event.target as Node)) {
        setIsFlockDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Notification state for professional toast messages
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  
  // Defaults panel state and values (persisted in localStorage)
  const [showDefaultsPanel, setShowDefaultsPanel] = useState(false);
  
  // Load defaults from localStorage
  const loadDefaults = () => {
    try {
      const stored = localStorage.getItem('sample_registration_defaults');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading defaults:', e);
    }
    return {
      pcr_extraction_method: '',
      pcr_disease_kit_defaults: {} as Record<string, string>, // disease name -> default kit type
      serology_disease_kit_defaults: {} as Record<string, string>, // disease name -> default kit type
      serology_wells: '',
    };
  };
  
  const [fieldDefaults, setFieldDefaults] = useState(loadDefaults);
  
  // Save defaults to localStorage whenever they change
  const saveDefaults = (newDefaults: typeof fieldDefaults) => {
    setFieldDefaults(newDefaults);
    localStorage.setItem('sample_registration_defaults', JSON.stringify(newDefaults));
    setNotification({ type: 'success', message: 'Default values saved!' });
  };
  
  // Auto-hide notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Persist form data to localStorage (only in create mode, user-specific)
  useEffect(() => {
    if (!isEditMode && user?.id && (dateReceived || company || farm || cycle || flock || units.length > 0)) {
      const draftKey = `sample_registration_draft_user_${user.id}`;
      const draftData = {
        dateReceived,
        company,
        farm,
        cycle,
        flock,
        status,
        units,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    }
  }, [dateReceived, company, farm, cycle, flock, status, units, isEditMode, user?.id]);

  // Clear draft after successful submission (user-specific)
  const clearDraft = () => {
    if (user?.id) {
      const draftKey = `sample_registration_draft_user_${user.id}`;
      localStorage.removeItem(draftKey);
    }
  };

  // Toggle unit expansion
  const toggleUnitExpansion = (globalIndex: number) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(globalIndex)) {
      newExpanded.delete(globalIndex);
    } else {
      newExpanded.add(globalIndex);
    }
    setExpandedUnits(newExpanded);
  };

  // Check if sample info is complete
  const checkSampleInfoComplete = () => {
    const isComplete = !!(dateReceived && company);
    setCompletedFields(prev => ({ ...prev, sampleInfo: isComplete }));
    return isComplete;
  };

  // Check if unit is complete
  const checkUnitComplete = (unit: UnitData, globalIndex: number) => {
    // House is optional - not required for completion
    const hasSampleTypes = unit.sample_type && unit.sample_type.length > 0;
    const deptInfo = getDepartmentInfo(unit.department_id);

    let deptComplete = true;
    if (deptInfo.code === "PCR" && unit.pcr_data) {
      deptComplete = !!(unit.pcr_data.diseases_list && unit.pcr_data.diseases_list.length > 0);
    } else if (deptInfo.code === "SER" && unit.serology_data) {
      deptComplete = !!(unit.serology_data.diseases_list && unit.serology_data.diseases_list.length > 0 && unit.serology_data.number_of_wells > 0);
    } else if (deptInfo.code === "MIC" && unit.microbiology_data) {
      deptComplete = !!(unit.microbiology_data.diseases_list && unit.microbiology_data.diseases_list.length > 0 && unit.microbiology_data.index_list && unit.microbiology_data.index_list.length > 0);
    }

    const isComplete = hasSampleTypes && deptComplete;
    setCompletedFields(prev => ({
      ...prev,
      units: { ...prev.units, [globalIndex]: isComplete }
    }));
    return isComplete;
  };

  // Fetch departments
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: async () => {
      const response = await apiClient.get("/departments/");
      return response.data;
    },
  });

  // Fetch existing sample data when in edit mode
  const { data: existingSample, isLoading: isLoadingExistingSample, error: sampleError } = useQuery(
    {
      queryKey: ["sample", editSampleId],
      queryFn: async () => {
        const response = await apiClient.get(`/samples/${editSampleId}`);
        return response.data;
      },
      enabled: isEditMode,
    },
  );

  // Fetch sample data for duplication
  const { data: duplicateSample, isLoading: isLoadingDuplicateSample } = useQuery(
    {
      queryKey: ["sample-duplicate", duplicateSampleId],
      queryFn: async () => {
        const response = await apiClient.get(`/samples/${duplicateSampleId}`);
        return response.data;
      },
      enabled: isDuplicateMode,
    },
  );

  // Fetch dropdown data from Controls
  const { data: companies = [] } = useCompanies();
  const { data: allFarms = [] } = useFarms();
  const { data: flocks = [] } = useFlocks();
  const { data: cycles = [] } = useCycles();
  const { data: houses = [] } = useHouses();
  const { data: sources = [] } = useSources();
  const { data: extractionMethodsData = [] } = useExtractionMethods();

  // Get department IDs for PCR and Serology
  const pcrDeptId = departments.find(d => d.code === 'PCR')?.id;
  const serDeptId = departments.find(d => d.code === 'SER')?.id;
  
  // Fetch diseases and kit types for Quick Defaults panel
  const { data: pcrDiseasesData = [] } = useDiseases(pcrDeptId);
  const { data: pcrKitTypesData = [] } = useKitTypes(pcrDeptId);
  const { data: serologyDiseasesData = [] } = useDiseases(serDeptId);
  const { data: serologyKitTypesData = [] } = useKitTypes(serDeptId);

  // Filter farms by selected company - ONLY show farms belonging to selected company
  const farms: DropdownItem[] = useMemo(() => {
    if (!company || company.length === 0) {
      return []; // Show no farms if no company selected
    }
    // Get company IDs from selected company names
    const selectedCompanyIds = companies
      .filter((c: DropdownItem) => company.includes(c.name))
      .map((c: DropdownItem) => c.id);
    // Filter farms by company_id - ONLY farms that belong to selected companies
    return allFarms.filter((f: DropdownItem) => 
      f.company_id !== null && 
      f.company_id !== undefined && 
      selectedCompanyIds.includes(f.company_id)
    );
  }, [allFarms, company, companies]);

  // Helper function to format field names in a human-readable way
  const formatFieldName = (fieldName: string): string => {
    const fieldMappings: { [key: string]: string } = {
      'company': 'Company',
      'farm': 'Farm',
      'flock': 'Flock',
      'cycle': 'Cycle',
      'date_received': 'Date Received',
      'status': 'Status',
      'house': 'House',
      'age': 'Age',
      'source': 'Source',
      'sample_type': 'Sample Type',
      'samples_number': 'Number of Samples',
      'notes': 'Notes',
      'pcr_diseases_list': 'PCR Diseases',
      'pcr_kit_type': 'PCR Kit Type',
      'pcr_technician_name': 'PCR Technician',
      'pcr_extraction_method': 'PCR Extraction Method',
      'pcr_extraction': 'PCR Extraction Count',
      'pcr_detection': 'PCR Detection Count',
      'serology_diseases_list': 'Serology Diseases',
      'serology_kit_type': 'Serology Kit Type',
      'serology_number_of_wells': 'Serology Wells Count',
      'serology_tests_count': 'Serology Tests Count',
      'microbiology_diseases_list': 'Microbiology Diseases',
      'microbiology_index_list': 'Microbiology Index List',
      'microbiology_batch_no': 'Microbiology Batch Number',
      'microbiology_fumigation': 'Microbiology Fumigation',
      'microbiology_technician_name': 'Microbiology Technician',
      'microbiology_hidden_indexes': 'Microbiology Hidden Rows',
    };
    return fieldMappings[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Function to fetch and show detailed edit history
  const showDetailedEditHistory = async () => {
    if (!editSampleId) return;
    try {
      // Fetch both sample and unit edit history
      const [sampleHistory, unitHistory] = await Promise.all([
        apiClient.get(`/edit-history/sample/${editSampleId}`),
        // Get unit IDs from existing sample and fetch their history
        Promise.all(
          (existingSample?.units || []).map((unit: any) =>
            apiClient.get(`/edit-history/unit/${unit.id}`).then(res => res.data).catch(() => [])
          )
        )
      ]);
      
      // Combine and sort all history entries
      const allHistory = [
        ...sampleHistory.data,
        ...unitHistory.flat()
      ].sort((a, b) => new Date(b.edited_at).getTime() - new Date(a.edited_at).getTime());
      
      setEditHistoryDialog({
        open: true,
        history: allHistory
      });
    } catch (err) {
      console.error('Failed to fetch edit history:', err);
    }
  };

  // Fetch preview codes with auto-refresh to keep reservation alive and update if changed
  const { data: previewData } = useQuery({
    queryKey: ["preview-codes"],
    queryFn: async () => {
      const response = await apiClient.get("/samples/preview-codes");
      return response.data;
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchIntervalInBackground: false, // Only refresh when tab is active
  });

  // Pre-fill form when editing existing sample
  useEffect(() => {
    if (isEditMode && existingSample && departments.length > 0) {
      // Set sample-level fields
      setDateReceived(existingSample.date_received || "");
      setCompany(existingSample.company || "");
      setFarm(Array.isArray(existingSample.farm) ? existingSample.farm : (existingSample.farm ? [existingSample.farm] : []));
      setCycle(existingSample.cycle || "");
      setFlock(existingSample.flock || "");
      setStatus(existingSample.status || "");

      // Transform units from API response to form format
      const transformedUnits: UnitData[] = existingSample.units.map(
        (unit: any) => {
          const unitData: UnitData = {
            id: unit.id,
            unit_code: unit.unit_code,
            department_id: unit.department_id,
            house: unit.house || [],
            age: unit.age?.toString() || "",
            source: Array.isArray(unit.source) ? unit.source : (unit.source ? [unit.source] : []),
            sample_type: unit.sample_type || [],
            samples_number: unit.samples_number || null as unknown as number,
            notes: unit.notes || "",
          };

          // Add department-specific data
          if (unit.pcr_data) {
            unitData.pcr_data = {
              diseases_list: unit.pcr_data.diseases_list || [],
              kit_type: unit.pcr_data.kit_type || "",
              technician_name: unit.pcr_data.technician_name || "",
              extraction_method: unit.pcr_data.extraction_method || "",
              extraction: unit.pcr_data.extraction || undefined,
              detection: unit.pcr_data.detection || undefined,
            };
          }

          if (unit.serology_data) {
            // Auto-calculate tests_count from diseases_list (sum of test_count from each disease)
            const calculatedTestsCount = (unit.serology_data.diseases_list || []).reduce(
              (sum: number, d: DiseaseKitItem) => sum + (d.test_count || 0), 0
            );
            unitData.serology_data = {
              diseases_list: unit.serology_data.diseases_list || [],
              kit_type: unit.serology_data.kit_type || "",
              number_of_wells: unit.serology_data.number_of_wells || 0,
              tests_count: calculatedTestsCount > 0 ? calculatedTestsCount : null,
            };
          }

          if (unit.microbiology_data) {
            unitData.microbiology_data = {
              diseases_list: unit.microbiology_data.diseases_list || [],
              batch_no: unit.microbiology_data.batch_no || "",
              fumigation: unit.microbiology_data.fumigation || "",
              index_list: unit.microbiology_data.index_list || [],
              technician_name: unit.microbiology_data.technician_name || "",
            };
          }

          return unitData;
        },
      );

      setUnits(transformedUnits);
      // Expand all units on load
      setExpandedUnits(new Set(transformedUnits.map((_, idx) => idx)));
      // Check completion
      setTimeout(checkSampleInfoComplete, 200);
      transformedUnits.forEach((unit, idx) => {
        setTimeout(() => checkUnitComplete(unit, idx), 300);
      });
    }
  }, [isEditMode, existingSample, departments]);

  // Pre-fill form when duplicating a sample (without IDs - creates new sample)
  useEffect(() => {
    if (isDuplicateMode && duplicateSample && departments.length > 0) {
      // Set sample-level fields (use today's date for new sample)
      setDateReceived(new Date().toISOString().split('T')[0]);
      setCompany(duplicateSample.company || "");
      setFarm(Array.isArray(duplicateSample.farm) ? duplicateSample.farm : (duplicateSample.farm ? [duplicateSample.farm] : []));
      setCycle(duplicateSample.cycle || "");
      setFlock(duplicateSample.flock || "");
      setStatus("In Progress"); // New sample starts as In Progress

      // Transform units from API response to form format (without IDs)
      const transformedUnits: UnitData[] = duplicateSample.units.map(
        (unit: any) => {
          const unitData: UnitData = {
            // No id - this is a new unit
            department_id: unit.department_id,
            house: unit.house || [],
            age: unit.age?.toString() || "",
            source: Array.isArray(unit.source) ? unit.source : (unit.source ? [unit.source] : []),
            sample_type: unit.sample_type || [],
            samples_number: unit.samples_number || null as unknown as number,
            notes: "", // Clear notes for new sample
          };

          // Add department-specific data
          if (unit.pcr_data) {
            unitData.pcr_data = {
              diseases_list: unit.pcr_data.diseases_list || [],
              kit_type: unit.pcr_data.kit_type || "",
              technician_name: unit.pcr_data.technician_name || "",
              extraction_method: unit.pcr_data.extraction_method || "",
              extraction: unit.pcr_data.extraction || undefined,
              detection: unit.pcr_data.detection || undefined,
            };
          }

          if (unit.serology_data) {
            const calculatedTestsCount = (unit.serology_data.diseases_list || []).reduce(
              (sum: number, d: DiseaseKitItem) => sum + (d.test_count || 0), 0
            );
            unitData.serology_data = {
              diseases_list: unit.serology_data.diseases_list || [],
              kit_type: unit.serology_data.kit_type || "",
              number_of_wells: unit.serology_data.number_of_wells || 0,
              tests_count: calculatedTestsCount > 0 ? calculatedTestsCount : null,
            };
          }

          if (unit.microbiology_data) {
            unitData.microbiology_data = {
              diseases_list: unit.microbiology_data.diseases_list || [],
              batch_no: unit.microbiology_data.batch_no || "",
              fumigation: unit.microbiology_data.fumigation || "",
              index_list: unit.microbiology_data.index_list || [],
              technician_name: unit.microbiology_data.technician_name || "",
            };
          }

          return unitData;
        },
      );

      setUnits(transformedUnits);
      setExpandedUnits(new Set(transformedUnits.map((_, idx) => idx)));
      setTimeout(checkSampleInfoComplete, 200);
      transformedUnits.forEach((unit, idx) => {
        setTimeout(() => checkUnitComplete(unit, idx), 300);
      });
    }
  }, [isDuplicateMode, duplicateSample, departments]);

  // Calculate unit codes preview based on current units
  const calculateUnitCodesPreview = () => {
    const unitsByDept: { [key: number]: number } = {};
    units.forEach((unit) => {
      unitsByDept[unit.department_id] =
        (unitsByDept[unit.department_id] || 0) + 1;
    });

    const unitPreviews: any[] = [];
    Object.entries(unitsByDept).forEach(([deptId, count]) => {
      const deptIdNum = parseInt(deptId);

      if (isEditMode) {
        // In edit mode, use existing unit codes for existing units and generate new codes for new units
        const existingUnits = units.filter(u => u.department_id === deptIdNum);
        const existingCodes = existingUnits.filter(u => u.unit_code).map(u => u.unit_code!);
        const newUnitsCount = existingUnits.filter(u => !u.unit_code).length;

        const dept = departments.find(d => d.id === deptIdNum);
        if (dept && existingCodes.length > 0) {
          let codes = [...existingCodes];

          // Generate new codes for units without codes (newly added units)
          if (newUnitsCount > 0 && previewData?.unit_counters?.[deptIdNum]) {
            const deptCounter = previewData.unit_counters[deptIdNum];
            // Find the highest existing number to continue from there
            const existingNumbers = existingCodes
              .map(code => {
                const match = code.match(/-(\d+)$/);
                return match ? parseInt(match[1]) : 0;
              })
              .filter(n => n > 0);
            const maxExistingNumber = Math.max(...existingNumbers, 0);

            for (let i = 0; i < newUnitsCount; i++) {
              codes.push(`${deptCounter.department_code}-${maxExistingNumber + i + 1}`);
            }
          }

          unitPreviews.push({
            department_name: dept.name,
            department_code: dept.code,
            codes,
            count,
          });
        }
      } else {
        // In create mode, generate new unit codes
        const deptCounter = previewData.unit_counters[deptIdNum];
        if (deptCounter) {
          const codes = [];
          for (let i = 0; i < count; i++) {
            codes.push(
              `${deptCounter.department_code}-${deptCounter.next_unit_number + i}`,
            );
          }
          unitPreviews.push({
            department_name: deptCounter.department_name,
            department_code: deptCounter.department_code,
            codes,
            count,
          });
        }
      }
    });
    return unitPreviews;
  };

  // Suppress unused variable warning - kept for future use
  void calculateUnitCodesPreview;
  const totalUnits = units.length;

  // Calculate overall progress
  const calculateProgress = () => {
    const sampleInfoProgress = completedFields.sampleInfo ? 1 : 0;
    const unitsProgress = units.length > 0
      ? Object.values(completedFields.units).filter(Boolean).length / units.length
      : 0;
    const totalProgress = units.length > 0
      ? ((sampleInfoProgress + unitsProgress) / 2) * 100
      : (sampleInfoProgress * 100);
    return Math.round(totalProgress);
  };

  const progress = calculateProgress();
  const completedUnitsCount = Object.values(completedFields.units).filter(Boolean).length;

  // Get department info - moved before calculateMicrobiologySummary to fix hoisting issue
  const getDepartmentInfo = (deptId: number) => {
    const dept = departments.find((d) => d.id === deptId);
    return {
      name: dept?.name || "",
      code: dept?.code || "",
    };
  };

  // Get color scheme for department - moved before calculateMicrobiologySummary
  const getDepartmentColors = (code: string) => {
    if (code === "PCR") {
      return {
        bg: "bg-blue-50",
        border: "border-blue-300",
        chip: "bg-blue-600",
        chipSelected: "bg-blue-700 border-2 border-blue-400 ring-2 ring-blue-300",
        badge: "bg-blue-600",
        gradient: "from-blue-50 to-blue-100",
        text: "text-blue-600",
        focusRing: "focus:ring-blue-500",
        focusBorder: "focus:border-blue-500",
        checkbox: "text-blue-600",
      };
    } else if (code === "SER") {
      return {
        bg: "bg-green-50",
        border: "border-green-300",
        chip: "bg-green-600",
        chipSelected: "bg-green-700 border-2 border-green-400 ring-2 ring-green-300",
        badge: "bg-green-600",
        gradient: "from-green-50 to-green-100",
        text: "text-green-600",
        focusRing: "focus:ring-green-500",
        focusBorder: "focus:border-green-500",
        checkbox: "text-green-600",
      };
    } else {
      return {
        bg: "bg-purple-50",
        border: "border-purple-300",
        chip: "bg-purple-600",
        chipSelected: "bg-purple-700 border-2 border-purple-400 ring-2 ring-purple-300",
        badge: "bg-purple-600",
        gradient: "from-purple-50 to-purple-100",
        text: "text-purple-600",
        focusRing: "focus:ring-purple-500",
        focusBorder: "focus:border-purple-500",
        checkbox: "text-purple-600",
      };
    }
  };

  // Get units grouped by department for rendering
  const getUnitsByDepartment = () => {
    const grouped: { [key: number]: UnitData[] } = {};
    units.forEach((unit) => {
      if (!grouped[unit.department_id]) {
        grouped[unit.department_id] = [];
      }
      grouped[unit.department_id].push(unit);
    });
    return grouped;
  };


  // Add a new unit for a department
  const addUnit = (deptId: number) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return;

    // Apply saved defaults
    const defaults = loadDefaults();
    
    // Find the highest existing unit code number for this department
    const sameDepUnits = units.filter(u => u.department_id === deptId);
    let maxNumber = 0;
    sameDepUnits.forEach(u => {
      if (u.unit_code) {
        const match = u.unit_code.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNumber) maxNumber = num;
        }
      }
    });
    
    // If no existing codes found, start from preview data or 1
    if (maxNumber === 0 && previewData?.unit_counters?.[deptId]) {
      maxNumber = previewData.unit_counters[deptId].next_unit_number + sameDepUnits.length - 1;
      if (maxNumber < 0) maxNumber = 0;
    }
    
    const nextNumber = maxNumber + 1;
    const unitCode = `${dept.code}-${nextNumber}`;
    
    const newUnit: UnitData = {
      department_id: deptId,
      unit_code: unitCode,
      house: [],
      age: "",
      source: [],
      sample_type: [],
      samples_number: null as unknown as number,
      notes: "",
    };

    // Initialize department-specific data with defaults
    if (dept.code === "PCR") {
      newUnit.pcr_data = {
        diseases_list: [],
        kit_type: "",
        extraction_method: defaults.pcr_extraction_method || "",
      };
    } else if (dept.code === "SER") {
      newUnit.samples_number = 1; // Default samples count to 1 for Serology
      newUnit.sample_type = ["Blood"]; // Pre-select Blood for Serology
      newUnit.serology_data = {
        diseases_list: [],
        kit_type: "",
        number_of_wells: defaults.serology_wells ? parseInt(defaults.serology_wells) : 0,
        tests_count: undefined,
      };
    } else if (dept.code === "MIC") {
      newUnit.microbiology_data = {
        diseases_list: [],
        batch_no: "",
        fumigation: "",
        index_list: [],
      };
    }

    setUnits([...units, newUnit]);
    // Auto-expand the new unit
    setExpandedUnits(prev => new Set([...prev, units.length]));
  };

  // Remove a specific unit
  const removeUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
  };

  // Update a specific unit
  const updateUnit = (index: number, updates: Partial<UnitData>) => {
    const newUnits = [...units];
    newUnits[index] = { ...newUnits[index], ...updates };
    setUnits(newUnits);
    // Check completion after update
    setTimeout(() => checkUnitComplete(newUnits[index], index), 100);
  };

  // Duplicate a specific unit (department)
  const duplicateUnit = (index: number) => {
    const unitToDuplicate = units[index];
    const duplicatedUnit = JSON.parse(JSON.stringify(unitToDuplicate)); // Deep clone
    
    // Generate new unit code by finding the highest existing number and incrementing
    const departmentId = unitToDuplicate.department_id;
    const deptInfo = getDepartmentInfo(departmentId);
    const departmentCode = deptInfo.code || 'UNK';
    
    // Find the highest unit code number for this department across all units
    const sameDepUnits = units.filter(u => u.department_id === departmentId);
    let maxNumber = 0;
    sameDepUnits.forEach(u => {
      if (u.unit_code) {
        const match = u.unit_code.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNumber) maxNumber = num;
        }
      }
    });
    
    // Increment from the highest found number
    const nextNumber = maxNumber + 1;
    duplicatedUnit.unit_code = `${departmentCode}-${nextNumber}`;
    
    // Remove id for new unit (will be assigned by backend)
    delete duplicatedUnit.id;
    
    const newUnits = [...units];
    newUnits.splice(index + 1, 0, duplicatedUnit); // Insert after current unit
    setUnits(newUnits);
    
    // Expand the new unit
    setExpandedUnits(prev => new Set([...prev, index + 1]));
    
    setNotification({ type: 'success', message: `Unit duplicated with code ${duplicatedUnit.unit_code}` });
  };

  // Create sample mutation
  const createSampleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post("/samples/", data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      // Reset form to allow registering another sample
      setNotification({ type: 'success', message: `Sample ${data.sample_code} created successfully!` });
      // Clear draft and reset to initial state
      clearDraft();
      setDateReceived("");
      setCompany("");
      setFarm([]);
      setCycle("");
      setFlock("");
      setStatus("In Progress");
      setUnits([]);
      setExpandedUnits(new Set());
      setCompletedFields({
        sampleInfo: false,
        units: {},
      });
    },
    onError: (error: any) => {
      console.error("Sample creation error:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      // Extract error message properly
      let errorMessage = "Unknown error";
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
        } else if (typeof detail === 'object') {
          errorMessage = detail.msg || detail.message || JSON.stringify(detail);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      setNotification({ 
        type: 'error', 
        message: `Failed to create sample: ${errorMessage}` 
      });
    },
  });

  // Update sample mutation
  const updateSampleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.put(`/samples/${editSampleId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["samples"] });
      queryClient.invalidateQueries({ queryKey: ["sample", editSampleId] });
      setNotification({ type: 'success', message: `Sample ${data.sample_code} updated successfully!` });
      // Navigate back after update
      navigate(-1);
    },
    onError: (error: any) => {
      console.error("Sample update error:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      setNotification({ 
        type: 'error', 
        message: `Failed to update sample: ${error.response?.data?.detail || error.message || "Unknown error"}` 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const errors: string[] = [];

    // Check sample-level required fields
    if (!status || status === "") {
      errors.push("Status is required");
    }

    // Check each unit for required fields
    units.forEach((unit, idx) => {
      const deptInfo = getDepartmentInfo(unit.department_id);
      const unitLabel = `Unit ${idx + 1} (${deptInfo.name})`;

      if (!unit.sample_type || unit.sample_type.length === 0) {
        errors.push(`${unitLabel}: At least one Sample Type is required`);
      }

      if (deptInfo.code === "PCR" && unit.pcr_data) {
        if (!unit.pcr_data.diseases_list || unit.pcr_data.diseases_list.length === 0) {
          errors.push(`${unitLabel}: At least one PCR disease is required`);
        } else if (unit.pcr_data.diseases_list.some(d => !d.kit_type || d.kit_type.trim() === '')) {
          errors.push(`${unitLabel}: Kit Type is required for all selected diseases`);
        }
        if (!unit.pcr_data.technician_name || unit.pcr_data.technician_name === "") {
          errors.push(`${unitLabel}: Technician is required`);
        }
        if (!unit.pcr_data.extraction_method || unit.pcr_data.extraction_method === "") {
          errors.push(`${unitLabel}: Extraction Method is required`);
        }
        if (!unit.pcr_data.extraction || unit.pcr_data.extraction === 0) {
          errors.push(`${unitLabel}: Extraction is required`);
        }
      }

      if (deptInfo.code === "SER" && unit.serology_data) {
        if (!unit.serology_data.diseases_list || unit.serology_data.diseases_list.length === 0) {
          errors.push(`${unitLabel}: At least one Serology disease is required`);
        } else if (unit.serology_data.diseases_list.some(d => !d.kit_type || d.kit_type.trim() === '')) {
          errors.push(`${unitLabel}: Kit Type is required for all selected diseases`);
        }
        if (!unit.serology_data.number_of_wells || unit.serology_data.number_of_wells <= 0) {
          errors.push(`${unitLabel}: Number of wells must be greater than 0`);
        }
        // Check if diseases have test_count defined (auto-calculated)
        const totalTestCount = (unit.serology_data.diseases_list || []).reduce(
          (sum: number, d: DiseaseKitItem) => sum + (d.test_count || 0), 0
        );
        if (totalTestCount <= 0) {
          errors.push(`${unitLabel}: Each disease must have a test count defined`);
        }
        if (!unit.serology_data.technician_name || unit.serology_data.technician_name === "") {
          errors.push(`${unitLabel}: Technician is required`);
        }
      }

      if (deptInfo.code === "MIC" && unit.microbiology_data) {
        if (!unit.microbiology_data.diseases_list || unit.microbiology_data.diseases_list.length === 0) {
          errors.push(`${unitLabel}: At least one Microbiology disease is required`);
        }
        if (!unit.microbiology_data.index_list || unit.microbiology_data.index_list.length === 0) {
          errors.push(`${unitLabel}: At least one environmental location is required`);
        }
        if (!unit.microbiology_data.technician_name || unit.microbiology_data.technician_name === "") {
          errors.push(`${unitLabel}: Technician is required`);
        }
        if (!unit.samples_number || unit.samples_number === 0) {
          errors.push(`${unitLabel}: Sub-Samples Count is required and must be greater than 0`);
        }
      }
    });

    if (errors.length > 0) {
      setNotification({ 
        type: 'warning', 
        message: `Please fix validation errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? ` and ${errors.length - 3} more...` : ''}` 
      });
      return;
    }

    // Transform units data for API
    const transformedUnits = units.map((unit) => ({
      id: unit.id,
      unit_code: unit.unit_code,
      department_id: unit.department_id,
      house: unit.house || null,
      age: unit.age || null,  // Keep as string
      source: unit.source || null,
      sample_type: unit.sample_type || null,
      samples_number: unit.samples_number || null,
      notes: unit.notes || null,
      pcr_data: unit.pcr_data || null,
      serology_data: unit.serology_data || null,
      microbiology_data: unit.microbiology_data || null,
    }));

    const sampleData = {
      date_received: dateReceived,
      company,
      farm: farm.join(', '), // Convert array to comma-separated string for backend
      cycle: cycle || null,
      flock: flock || null,
      status,
      units: transformedUnits,
    };

    // Use update mutation in edit mode, create mutation otherwise
    if (isEditMode) {
      updateSampleMutation.mutate(sampleData);
    } else {
      createSampleMutation.mutate(sampleData);
    }
  };

  // Show loading while fetching existing sample data
  if (isEditMode && isLoadingExistingSample) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">⏳</div>
          <p className="text-gray-500 text-lg">Loading sample data...</p>
        </div>
      </div>
    );
  }

  // Show loading while fetching sample data for duplication
  if (isDuplicateMode && isLoadingDuplicateSample) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <p className="text-gray-500 text-lg">Loading sample for duplication...</p>
        </div>
      </div>
    );
  }

  // Show error if sample fetch failed
  if (isEditMode && sampleError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Sample</h3>
          <p className="text-red-600 mb-6">
            Unable to load sample data. The sample may not exist or you may not have permission to edit it.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50">
      {/* Professional Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`px-5 py-4 rounded-xl shadow-lg flex items-center gap-3 min-w-[320px] max-w-md ${
            notification.type === 'success' ? 'bg-green-600 text-white' :
            notification.type === 'error' ? 'bg-red-600 text-white' :
            notification.type === 'warning' ? 'bg-amber-500 text-white' :
            'bg-blue-600 text-white'
          }`}>
            {notification.type === 'success' && (
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {notification.type === 'error' && (
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            {notification.type === 'warning' && (
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            {notification.type === 'info' && (
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Defaults Panel Toggle Button - Fixed on right */}
      <button
        type="button"
        onClick={() => setShowDefaultsPanel(!showDefaultsPanel)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 p-3 rounded-l-xl shadow-lg transition-all duration-300 ${
          showDefaultsPanel 
            ? 'bg-gray-700 text-white' 
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
        }`}
        title="Quick Defaults"
      >
        <svg className={`w-5 h-5 transition-transform duration-300 ${showDefaultsPanel ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Defaults Panel - Slide from Right */}
      <div className={`fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
        showDefaultsPanel ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Panel Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Quick Defaults
              </h3>
              <button
                type="button"
                onClick={() => setShowDefaultsPanel(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-indigo-100 text-xs mt-1">Set default values for faster registration</p>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* PCR Section */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-600 rounded text-white text-[10px] flex items-center justify-center font-bold">PCR</span>
                PCR Defaults
              </p>
              
              {/* PCR Extraction Method - Dropdown from Controls */}
              <div className="space-y-1.5 mb-3">
                <label className="text-sm font-semibold text-gray-700">Extraction Method</label>
                <select
                  value={fieldDefaults.pcr_extraction_method || ''}
                  onChange={(e) => setFieldDefaults({ ...fieldDefaults, pcr_extraction_method: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                >
                  <option value="">Select default...</option>
                  {(() => {
                    const pcrDept = departments.find(d => d.code === 'PCR');
                    return pcrDept ? extractionMethodsData.map((method) => (
                      <option key={method.id} value={method.name}>{method.name}</option>
                    )) : null;
                  })()}
                </select>
              </div>

              {/* PCR Disease Kit Type Defaults */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Default Kit Types by Disease</label>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-white rounded-lg border border-blue-200 p-2">
                  {(() => {
                    const pcrDept = departments.find(d => d.code === 'PCR');
                    if (!pcrDept) return <p className="text-xs text-gray-500">Loading...</p>;
                    return pcrDiseasesData.length > 0 ? pcrDiseasesData.map((disease) => (
                      <div key={disease.id} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700 min-w-[80px] truncate" title={disease.name}>{disease.name}</span>
                        <select
                          value={fieldDefaults.pcr_disease_kit_defaults?.[disease.name] || ''}
                          onChange={(e) => setFieldDefaults({
                            ...fieldDefaults,
                            pcr_disease_kit_defaults: {
                              ...fieldDefaults.pcr_disease_kit_defaults,
                              [disease.name]: e.target.value
                            }
                          })}
                          className="flex-1 border border-gray-200 rounded p-1 text-xs bg-white"
                        >
                          <option value="">No default</option>
                          {pcrKitTypesData.map((kit) => (
                            <option key={kit.id} value={kit.name}>{kit.name}</option>
                          ))}
                        </select>
                      </div>
                    )) : <p className="text-xs text-gray-500">No diseases configured</p>;
                  })()}
                </div>
              </div>
            </div>

            {/* Serology Section */}
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-5 h-5 bg-green-600 rounded text-white text-[10px] flex items-center justify-center font-bold">SER</span>
                Serology Defaults
              </p>

              {/* Serology Wells */}
              <div className="space-y-1.5 mb-3">
                <label className="text-sm font-semibold text-gray-700">Number of Wells</label>
                <input
                  type="number"
                  value={fieldDefaults.serology_wells || ''}
                  onChange={(e) => setFieldDefaults({ ...fieldDefaults, serology_wells: e.target.value })}
                  placeholder="Enter default wells"
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {/* Serology Disease Kit Type Defaults */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Default Kit Types by Disease</label>
                <div className="space-y-2 max-h-48 overflow-y-auto bg-white rounded-lg border border-green-200 p-2">
                  {(() => {
                    const serDept = departments.find(d => d.code === 'SER');
                    if (!serDept) return <p className="text-xs text-gray-500">Loading...</p>;
                    return serologyDiseasesData.length > 0 ? serologyDiseasesData.map((disease) => (
                      <div key={disease.id} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-700 min-w-[80px] truncate" title={disease.name}>{disease.name}</span>
                        <select
                          value={fieldDefaults.serology_disease_kit_defaults?.[disease.name] || ''}
                          onChange={(e) => setFieldDefaults({
                            ...fieldDefaults,
                            serology_disease_kit_defaults: {
                              ...fieldDefaults.serology_disease_kit_defaults,
                              [disease.name]: e.target.value
                            }
                          })}
                          className="flex-1 border border-gray-200 rounded p-1 text-xs bg-white"
                        >
                          <option value="">No default</option>
                          {serologyKitTypesData.map((kit) => (
                            <option key={kit.id} value={kit.name}>{kit.name}</option>
                          ))}
                        </select>
                      </div>
                    )) : <p className="text-xs text-gray-500">No diseases configured</p>;
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Panel Footer */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <button
              type="button"
              onClick={() => saveDefaults(fieldDefaults)}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
            >
              Save Defaults
            </button>
            <button
              type="button"
              onClick={() => {
                const emptyDefaults = {
                  pcr_extraction_method: '',
                  pcr_disease_kit_defaults: {},
                  serology_disease_kit_defaults: {},
                  serology_wells: '',
                };
                saveDefaults(emptyDefaults);
              }}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              Clear All Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Overlay when panel is open */}
      {showDefaultsPanel && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setShowDefaultsPanel(false)}
        />
      )}

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium shadow-sm hover:shadow"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back
          </button>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              {isEditMode
                ? `Edit Sample ${existingSample?.sample_code || ""}`
                : isDuplicateMode
                  ? `Duplicate Sample (from ${duplicateSample?.sample_code || ""})`
                  : "Register New Sample"}
            </h2>
            {units.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-blue-600 to-green-500 h-full transition-all duration-700 ease-out rounded-full shadow-sm"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <span className="text-lg font-bold text-gray-900">
                      {progress}%
                    </span>
                    <span className="text-sm text-gray-500 font-medium">Complete</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <p className="text-xs text-gray-600 font-medium">
                      {completedUnitsCount} of {totalUnits} units completed
                    </p>
                  </div>
                  {completedFields.sampleInfo && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <p className="text-xs text-gray-600 font-medium">Sample info ready</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit History and Postponed Status - Side by side layout */}
        {isEditMode && (existingSample?.last_edited_by || existingSample?.status === 'Postponed') && (
          <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Edit History Note - Show when sample was previously edited */}
            {existingSample?.last_edited_by && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Edit History</p>
                  <p className="text-sm text-amber-700">
                    Last edited by <span className="font-bold">{existingSample.last_edited_by}</span> on{' '}
                    <span className="font-bold">
                      {new Date(existingSample.updated_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={showDetailedEditHistory}
                    className="mt-2 text-sm text-amber-700 hover:text-amber-900 underline font-medium"
                  >
                    View Detailed Edit History →
                  </button>
                </div>
              </div>
            )}
            
            {/* Postponed Status Note - Show when sample is postponed */}
            {existingSample?.status === 'Postponed' && (
              <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">Sample Postponed</p>
                  <p className="text-sm text-orange-700 mt-1">
                    This sample has been postponed. Check COA notes for the reason.
                  </p>
                  {existingSample.units?.some((u: any) => u.notes?.includes('Postponed Reason:')) && (
                    <div className="mt-2 p-2 bg-orange-100 rounded-lg">
                      <p className="text-xs font-semibold text-orange-800">Postponed Reason:</p>
                      {existingSample.units.map((unit: any, idx: number) => {
                        const match = unit.notes?.match(/Postponed Reason:\s*(.+)/);
                        if (match) {
                          return (
                            <p key={idx} className="text-sm text-orange-700 mt-1">
                              <span className="font-medium">{unit.unit_code}:</span> {match[1]}
                            </p>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Code Preview Section */}
        {previewData && (
          <div className="mb-6">
            {/* Main Sample Code Display - Compact */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl shadow-lg p-4 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white bg-opacity-20 p-2 rounded-lg backdrop-blur-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white text-xs font-medium opacity-90">
                      {isEditMode ? "Sample Code" : "Next Sample Code"}
                    </p>
                    <span className="text-2xl font-black text-white tracking-wider">
                      {isEditMode ? existingSample?.sample_code : previewData?.next_sample_code}
                    </span>
                  </div>
                </div>
                {totalUnits > 0 && (
                  <div className="bg-white bg-opacity-20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <span className="text-white font-bold text-sm">
                      {totalUnits} {totalUnits === 1 ? "Unit" : "Units"}
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}


        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sample-Level Fields */}
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200 overflow-visible relative z-20">
            <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <span>Sample Information</span>
                </h3>
                {completedFields.sampleInfo && (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-white bg-opacity-20 backdrop-blur-sm rounded-full">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-semibold text-white">Complete</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dateReceived}
                    onChange={(e) => {
                      setDateReceived(e.target.value);
                      setTimeout(checkSampleInfoComplete, 100);
                    }}
                    className={`w-full border-2 rounded-xl px-4 py-2.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 ${
                      dateReceived ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md' : 'bg-gray-50 border-gray-300'
                    } focus:bg-white`}
                    required
                  />
                </div>

                {/* Company Searchable Dropdown */}
                <div className="space-y-1.5" ref={companyDropdownRef}>
                  <label className="block text-sm font-semibold text-gray-700">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                      className={`w-full border-2 rounded-xl px-4 py-2.5 text-left flex justify-between items-center transition-all ${
                        company ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md' : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                      }`}
                    >
                      <span className={company ? 'text-gray-900' : 'text-gray-500'}>
                        {company || 'Select company...'}
                      </span>
                      <svg className={`w-5 h-5 transition-transform ${isCompanyDropdownOpen ? 'rotate-180' : ''} ${company ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isCompanyDropdownOpen && (
                      <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-blue-300 rounded-xl shadow-2xl max-h-60 overflow-hidden">
                        <div className="p-2 bg-blue-50 border-b border-blue-200">
                          <input
                            type="text"
                            placeholder="Search companies..."
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          {companies.filter(item => item.name.toLowerCase().includes(companySearch.toLowerCase())).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => { setCompany(item.name); setIsCompanyDropdownOpen(false); setCompanySearch(''); setTimeout(checkSampleInfoComplete, 100); }}
                              className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${company === item.name ? 'bg-blue-100 font-semibold' : ''}`}
                            >
                              {item.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Farm Multi-Select Dropdown */}
                <div className="space-y-1.5" ref={farmDropdownRef}>
                  <label className="block text-sm font-semibold text-gray-700">Farm(s)</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsFarmDropdownOpen(!isFarmDropdownOpen)}
                      className={`w-full border-2 rounded-xl px-4 py-2.5 text-left flex justify-between items-center transition-all ${
                        farm.length > 0 ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md' : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                      }`}
                    >
                      <span className={farm.length > 0 ? 'text-gray-900' : 'text-gray-500'}>
                        {farm.length > 0 ? farm.join(', ') : 'Select farms...'}
                      </span>
                      <div className="flex items-center gap-2">
                        {farm.length > 0 && (
                          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{farm.length}</span>
                        )}
                        <svg className={`w-5 h-5 transition-transform ${isFarmDropdownOpen ? 'rotate-180' : ''} ${farm.length > 0 ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {isFarmDropdownOpen && (
                      <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-blue-300 rounded-xl shadow-2xl max-h-60 overflow-hidden">
                        <div className="p-2 bg-blue-50 border-b border-blue-200">
                          <input
                            type="text"
                            placeholder="Search farms..."
                            value={farmSearch}
                            onChange={(e) => setFarmSearch(e.target.value)}
                            className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          {farms.filter(item => item.name.toLowerCase().includes(farmSearch.toLowerCase())).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                const isSelected = farm.includes(item.name);
                                if (isSelected) {
                                  setFarm(farm.filter(f => f !== item.name));
                                } else {
                                  setFarm([...farm, item.name]);
                                }
                                setTimeout(checkSampleInfoComplete, 100);
                              }}
                              className={`px-4 py-2 cursor-pointer hover:bg-blue-50 flex items-center gap-2 ${farm.includes(item.name) ? 'bg-blue-100' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={farm.includes(item.name)}
                                onChange={() => {}}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className={farm.includes(item.name) ? 'font-semibold' : ''}>{item.name}</span>
                            </div>
                          ))}
                        </div>
                        {farm.length > 0 && (
                          <div className="p-2 bg-gray-50 border-t border-gray-200 flex justify-between">
                            <button
                              type="button"
                              onClick={() => { setFarm([]); setTimeout(checkSampleInfoComplete, 100); }}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Clear all
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsFarmDropdownOpen(false)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              Done
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cycle Searchable Dropdown */}
                <div className="space-y-1.5" ref={cycleDropdownRef}>
                  <label className="block text-sm font-semibold text-gray-700">Cycle</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCycleDropdownOpen(!isCycleDropdownOpen)}
                      className={`w-full border-2 rounded-xl px-4 py-2.5 text-left flex justify-between items-center transition-all ${
                        cycle ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md' : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                      }`}
                    >
                      <span className={cycle ? 'text-gray-900' : 'text-gray-500'}>
                        {cycle || 'Select cycle...'}
                      </span>
                      <svg className={`w-5 h-5 transition-transform ${isCycleDropdownOpen ? 'rotate-180' : ''} ${cycle ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isCycleDropdownOpen && (
                      <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-blue-300 rounded-xl shadow-2xl max-h-60 overflow-hidden">
                        <div className="p-2 bg-blue-50 border-b border-blue-200">
                          <input
                            type="text"
                            placeholder="Search cycles..."
                            value={cycleSearch}
                            onChange={(e) => setCycleSearch(e.target.value)}
                            className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          {cycles.filter(item => item.name.toLowerCase().includes(cycleSearch.toLowerCase())).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => { setCycle(item.name); setIsCycleDropdownOpen(false); setCycleSearch(''); }}
                              className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${cycle === item.name ? 'bg-blue-100 font-semibold' : ''}`}
                            >
                              {item.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Flock Searchable Dropdown */}
                <div className="space-y-1.5" ref={flockDropdownRef}>
                  <label className="block text-sm font-semibold text-gray-700">Flock</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsFlockDropdownOpen(!isFlockDropdownOpen)}
                      className={`w-full border-2 rounded-xl px-4 py-2.5 text-left flex justify-between items-center transition-all ${
                        flock ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md' : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                      }`}
                    >
                      <span className={flock ? 'text-gray-900' : 'text-gray-500'}>
                        {flock || 'Select flock...'}
                      </span>
                      <svg className={`w-5 h-5 transition-transform ${isFlockDropdownOpen ? 'rotate-180' : ''} ${flock ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isFlockDropdownOpen && (
                      <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-blue-300 rounded-xl shadow-2xl max-h-60 overflow-hidden">
                        <div className="p-2 bg-blue-50 border-b border-blue-200">
                          <input
                            type="text"
                            placeholder="Search flocks..."
                            value={flockSearch}
                            onChange={(e) => setFlockSearch(e.target.value)}
                            className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-100"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          {flocks.filter(item => item.name.toLowerCase().includes(flockSearch.toLowerCase())).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => { setFlock(item.name); setIsFlockDropdownOpen(false); setFlockSearch(''); }}
                              className={`px-4 py-2 cursor-pointer hover:bg-blue-50 ${flock === item.name ? 'bg-blue-100 font-semibold' : ''}`}
                            >
                              {item.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Status <span className="text-red-500">*</span></label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`w-full border-2 rounded-xl px-4 py-2.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 ${
                      status ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-md' : 'bg-gray-50 border-gray-300'
                    } focus:bg-white`}
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Hold">Hold</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Select Department Section */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 sm:px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <span>Select Department</span>
                {units.length > 0 && (
                  <span className="ml-auto bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm font-medium">
                    {units.length} {units.length === 1 ? 'unit' : 'units'}
                  </span>
                )}
              </h3>
            </div>
            <div className="p-4 sm:p-6">
              <p className="text-sm text-gray-600 mb-3">Select departments for this sample. Use <strong>Duplicate</strong> to add more units per department.</p>
              {/* Department Selection Buttons - Toggle Select/Unselect */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {departments.map((dept) => {
                  const colors = getDepartmentColors(dept.code);
                  const hasUnit = units.some(u => u.department_id === dept.id);
                  
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        if (hasUnit) {
                          // Remove all units for this department
                          setUnits(units.filter(u => u.department_id !== dept.id));
                        } else {
                          addUnit(dept.id);
                        }
                      }}
                      className={`relative flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                        hasUnit 
                          ? `${colors.chipSelected} shadow-lg text-white` 
                          : 'bg-gray-50 border-gray-200 hover:shadow-md hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 ${hasUnit ? 'bg-white/20' : colors.badge} rounded-lg flex items-center justify-center shadow-sm`}>
                          <span className={`font-bold text-xs ${hasUnit ? 'text-white' : 'text-white'}`}>{dept.code}</span>
                        </div>
                        <span className={`font-semibold text-sm ${hasUnit ? 'text-white' : 'text-gray-800'}`}>{dept.name}</span>
                      </div>
                      {hasUnit ? (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors">
                          Unselect
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition-colors">
                          Select
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Department Units - Only show if units exist */}
          {units.length > 0 && (
            <div className="space-y-4">
              {/* Individual Unit Forms - Grouped by Department */}
              {Object.entries(getUnitsByDepartment()).map(
                ([deptIdStr, deptUnits]) => {
                  const deptId = parseInt(deptIdStr);
                  const deptInfo = getDepartmentInfo(deptId);
                  const colors = getDepartmentColors(deptInfo.code);

                  return (
                    <div key={deptId} className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                      {/* Department Header */}
                      <div className={`bg-gradient-to-r ${colors.gradient} px-4 sm:px-5 py-3`}>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                              <span className="text-xs font-bold">{deptInfo.code}</span>
                            </div>
                            <span>{deptInfo.name}</span>
                          </h4>
                          <span className="bg-white bg-opacity-20 px-2.5 py-1 rounded-full text-xs font-semibold text-white">
                            {deptUnits.length} {deptUnits.length === 1 ? 'unit' : 'units'}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 sm:p-4 space-y-3">
                        {deptUnits.map((unit) => {
                          const globalIndex = units.indexOf(unit);

                          // Calculate the correct sequential position for this department's units
                          const sequentialIndex = units.filter((u, idx) =>
                            u.department_id === deptId && idx <= globalIndex
                          ).length - 1;

                          // In edit mode, use the existing unit code if available
                          const unitCode = unit.unit_code 
                            ? unit.unit_code
                            : (previewData?.unit_counters?.[deptId]
                              ? `${previewData.unit_counters[deptId].department_code}-${previewData.unit_counters[deptId].next_unit_number + sequentialIndex}`
                              : `${deptInfo.code}-${sequentialIndex + 1}`);

                          const isExpanded = expandedUnits.has(globalIndex);
                          const isComplete = completedFields.units[globalIndex];

                          return (
                            <div
                              key={globalIndex}
                              className={`rounded-xl border-2 transition-all duration-300 ${
                                isComplete 
                                  ? 'border-green-300 bg-green-50/50' 
                                  : isExpanded 
                                    ? `${colors.border} bg-white shadow-md` 
                                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              {/* Unit Header - Compact & Clean */}
                              <div 
                                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                                  isExpanded ? 'border-b border-gray-200' : ''
                                }`}
                                onClick={() => toggleUnitExpansion(globalIndex)}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {/* Expand/Collapse Icon */}
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                    isExpanded ? `${colors.badge} text-white` : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    <svg
                                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                  
                                  {/* Unit Code Badge */}
                                  <div className={`${colors.badge} px-2.5 py-1 rounded-md shadow-sm`}>
                                    <span className="font-mono font-bold text-white text-xs tracking-wide">
                                      {unitCode}
                                    </span>
                                  </div>
                                  
                                  {/* Status Indicator */}
                                  {isComplete ? (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-xs font-semibold">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="hidden sm:inline">Complete</span>
                                    </div>
                                  ) : !isExpanded && (
                                    <span className="text-xs text-gray-500 truncate">
                                      {unit.house?.length || 0} houses • {unit.sample_type?.length || 0} types
                                    </span>
                                  )}
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="flex gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => duplicateUnit(globalIndex)}
                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                    title="Duplicate"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeUnit(globalIndex)}
                                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                    title="Remove"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Unit Body - Collapsible */}
                              {isExpanded && (
                                <div className="p-3 sm:p-4 bg-white">
                                  {/* Unit-Specific Fields */}
                                  <UnitFieldsForm
                                    unit={unit}
                                    globalIndex={globalIndex}
                                    updateUnit={updateUnit}
                                    houses={houses}
                                    sources={sources}
                                    departments={departments}
                                    departmentId={deptId}
                                    colors={colors}
                                  />

                                  {/* Department-Specific Fields */}
                                  {deptInfo.code === "PCR" && unit.pcr_data && (
                                    <PCRFields
                                      unit={unit}
                                      globalIndex={globalIndex}
                                      updateUnit={updateUnit}
                                      departmentId={deptId}
                                      colors={colors}
                                      setNotification={setNotification}
                                    />
                                  )}

                                  {deptInfo.code === "SER" && unit.serology_data && (
                                    <SerologyFields
                                      unit={unit}
                                      globalIndex={globalIndex}
                                      updateUnit={updateUnit}
                                      departmentId={deptId}
                                      colors={colors}
                                      setNotification={setNotification}
                                    />
                                  )}

                                  {deptInfo.code === "MIC" &&
                                    unit.microbiology_data && (
                                      <MicrobiologyFields
                                        unit={unit}
                                        globalIndex={globalIndex}
                                        updateUnit={updateUnit}
                                        departmentId={deptId}
                                        colors={colors}
                                        setNotification={setNotification}
                                      />
                                    )}

                                  {/* Notes field - before technician */}
                                  <div className="space-y-1.5 mt-4">
                                    <label className="block text-sm font-semibold text-gray-700">
                                      Notes
                                    </label>
                                    <textarea
                                      value={unit.notes}
                                      onChange={(e) =>
                                        updateUnit(globalIndex, {
                                          notes: e.target.value,
                                        })
                                      }
                                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                                      rows={3}
                                      placeholder="Add any additional notes or comments..."
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate("/all-samples")}
              className="px-8 py-3.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 font-semibold transition-all duration-200 shadow-sm hover:shadow"
            >
              Cancel
            </button>
            {!isEditMode && (
              <button
                type="button"
                onClick={() => {
                  // Clear all form data and draft
                  clearDraft();
                  setDateReceived("");
                  setCompany("");
                  setFarm([]);
                  setCycle("");
                  setFlock("");
                  setStatus("In Progress");
                  setUnits([]);
                  setExpandedUnits(new Set());
                  setCompletedFields({ sampleInfo: false, units: {} });
                  setNotification({ type: 'info', message: 'Form cleared' });
                }}
                className="px-8 py-3.5 bg-white border-2 border-orange-300 text-orange-600 rounded-xl hover:bg-orange-50 hover:border-orange-400 font-semibold transition-all duration-200 shadow-sm hover:shadow"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={
                createSampleMutation.isPending ||
                updateSampleMutation.isPending ||
                units.length === 0
              }
              className="flex-1 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isEditMode
                ? updateSampleMutation.isPending
                  ? "Updating..."
                  : `Update Sample with ${totalUnits} ${totalUnits === 1 ? "Unit" : "Units"}`
                : createSampleMutation.isPending
                  ? "Creating..."
                  : `Create Sample with ${totalUnits} ${totalUnits === 1 ? "Unit" : "Units"}`}
            </button>
          </div>

          {(createSampleMutation.isError || updateSampleMutation.isError) && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-red-700 font-medium">
                {isEditMode ? "Error updating sample." : "Error creating sample."}{" "}
                Please check your inputs and try again.
              </p>
            </div>
          )}
        </form>
      </div>

      {/* Edit History Dialog */}
      {editHistoryDialog.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Detailed Edit History</h3>
                  <p className="text-sm text-gray-500">Sample: {existingSample?.sample_code}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditHistoryDialog({ open: false, history: [] })}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {editHistoryDialog.history.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">No detailed edit history found</p>
                  <p className="text-sm text-gray-400 mt-1">Changes made before this feature was enabled are not tracked</p>
                </div>
              ) : (
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Field</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-red-600">Before</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-green-600">After</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Edited By</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editHistoryDialog.history.map((edit: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-300 px-3 py-2 font-medium">
                          {formatFieldName(edit.field_name)}
                          {edit.unit_code && <span className="text-xs text-blue-600 block">Unit: {edit.unit_code}</span>}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-red-700 bg-red-50 break-words max-w-[150px]">{edit.old_value || '-'}</td>
                        <td className="border border-gray-300 px-3 py-2 text-green-700 bg-green-50 break-words max-w-[150px]">{edit.new_value || '-'}</td>
                        <td className="border border-gray-300 px-3 py-2">{edit.edited_by}</td>
                        <td className="border border-gray-300 px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(edit.edited_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setEditHistoryDialog({ open: false, history: [] })}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
