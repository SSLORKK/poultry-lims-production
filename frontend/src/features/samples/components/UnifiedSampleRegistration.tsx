import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { usePermissions } from "../../../hooks/usePermissions";
import { apiClient } from "../../../services/apiClient";
import {
  useCompanies,
  useFarms,
  useFlocks,
  useCycles,
  useStatuses,
  useHouses,
  useSources,
  useSampleTypes,
  useDiseases,
  useKitTypes,
  useTechnicians,
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
  source: string;
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
  const [isHouseDropdownOpen, setIsHouseDropdownOpen] = useState(false);
  const [isSampleTypeDropdownOpen, setIsSampleTypeDropdownOpen] = useState(false);
  const houseDropdownRef = useRef<HTMLDivElement>(null);
  const sampleTypeDropdownRef = useRef<HTMLDivElement>(null);

  // Check if current department is Serology
  const isSerology = departments.find(d => d.id === departmentId)?.code === 'SER';

  // Check if current department is Microbiology
  const isMicrobiology = departments.find(d => d.id === departmentId)?.code === 'MIC';

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (houseDropdownRef.current && !houseDropdownRef.current.contains(event.target as Node)) {
        setIsHouseDropdownOpen(false);
      }
      if (sampleTypeDropdownRef.current && !sampleTypeDropdownRef.current.contains(event.target as Node)) {
        setIsSampleTypeDropdownOpen(false);
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

  const filteredHouses = houses.filter(h =>
    h.name.toLowerCase().includes(houseSearchTerm.toLowerCase())
  );

  const filteredSampleTypes = sampleTypes.filter(st =>
    st.name.toLowerCase().includes(sampleTypeSearchTerm.toLowerCase())
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Houses Multi-Select Dropdown */}
        <div className="space-y-1.5" ref={houseDropdownRef}>
          <label className="block text-sm font-semibold text-gray-700">
            Houses <span className="text-red-500">*</span>
          </label>

          {/* Selected Houses Chips */}
          {(unit.house?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 shadow-sm">
              {unit.house?.map((h) => (
                <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all">
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
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 shadow-md'
                : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                } focus:outline-none focus:ring-4 focus:ring-blue-100`}
            >
              <span className={`font-medium ${(unit.house?.length || 0) > 0 ? 'text-blue-900' : 'text-gray-600'
                }`}>
                {(unit.house?.length || 0) > 0
                  ? `${unit.house.length} selected`
                  : 'Select houses'}
              </span>
              <svg className={`w-5 h-5 transition-transform duration-200 ${isHouseDropdownOpen ? 'rotate-180' : ''
                } ${(unit.house?.length || 0) > 0 ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isHouseDropdownOpen && (
              <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-blue-300 rounded-xl shadow-2xl max-h-80 overflow-hidden">
                {/* Search and Actions */}
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                  <input
                    type="text"
                    placeholder="Search houses..."
                    value={houseSearchTerm}
                    onChange={(e) => setHouseSearchTerm(e.target.value)}
                    className="w-full border-2 border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
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
                        className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={(unit.house || []).includes(item.name)}
                          onChange={() => toggleHouse(item.name)}
                          className="mr-3 h-5 w-5 text-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 cursor-pointer"
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

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">Source</label>
          <select
            value={unit.source}
            onChange={(e) =>
              updateUnit(globalIndex, { source: e.target.value })
            }
            className={`w-full border-2 rounded-xl px-4 py-2.5 transition-all ${unit.source && unit.source !== ''
              ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
              : 'bg-gray-50 border-gray-300'
              } focus:bg-white focus:${colors.border} focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100`}
          >
            <option value="">Select source...</option>
            {sources.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5" ref={sampleTypeDropdownRef}>
          <label className="block text-sm font-semibold text-gray-700">
            Sample Types <span className="text-red-500">*</span>
          </label>

          {/* Selected Sample Types Chips */}
          {(unit.sample_type?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 shadow-sm">
              {unit.sample_type?.map((st) => (
                <span key={st} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all">
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
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 shadow-md'
                : 'bg-gray-50 border-gray-300 hover:bg-white hover:border-gray-400'
                } focus:outline-none focus:ring-4 focus:ring-blue-100`}
            >
              <span className={`font-medium ${(unit.sample_type?.length || 0) > 0 ? 'text-blue-900' : 'text-gray-600'
                }`}>
                {(unit.sample_type?.length || 0) > 0
                  ? `${unit.sample_type.length} selected`
                  : 'Select sample types'}
              </span>
              <svg className={`w-5 h-5 transition-transform duration-200 ${isSampleTypeDropdownOpen ? 'rotate-180' : ''
                } ${(unit.sample_type?.length || 0) > 0 ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isSampleTypeDropdownOpen && (
              <div className="absolute z-[9999] w-full mt-2 bg-white border-2 border-blue-300 rounded-xl shadow-2xl max-h-80 overflow-hidden">
                {/* Search and Actions */}
                <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                  <input
                    type="text"
                    placeholder="Search sample types..."
                    value={sampleTypeSearchTerm}
                    onChange={(e) => setSampleTypeSearchTerm(e.target.value)}
                    className="w-full border-2 border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
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
                        className="flex items-center px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={(unit.sample_type || []).includes(item.name)}
                          onChange={() => toggleSampleType(item.name)}
                          className="mr-3 h-5 w-5 text-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 cursor-pointer"
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

        {/* Tests Count field for Serology only */}
        {isSerology && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Tests Count <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={unit.serology_data?.tests_count || ''}
              onChange={(e) =>
                updateUnit(globalIndex, {
                  serology_data: {
                    ...unit.serology_data!,
                    tests_count: e.target.value ? parseInt(e.target.value) || 0 : undefined,
                  },
                })
              }
              className={`w-full border-2 rounded-xl px-4 py-2.5 transition-all ${unit.serology_data?.tests_count && unit.serology_data.tests_count > 0
                ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
                : 'bg-gray-50 border-gray-300'
                } focus:bg-white focus:${colors.border} focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              placeholder="Enter tests count"
              onWheel={(e) => e.currentTarget.blur()}
            />
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
  };
}

function PCRFields({
  unit,
  globalIndex,
  updateUnit,
  departmentId,
  colors,
}: PCRFieldsProps) {
  const { data: diseases = [] } = useDiseases(departmentId);
  const { data: kitTypes = [] } = useKitTypes(departmentId);
  const { data: technicians = [] } = useTechnicians();
  const { data: extractionMethods = [] } = useExtractionMethods();

  return (
    <div className={`border-t-2 ${colors.border} pt-4 mt-4 space-y-4`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Technician <span className="text-red-500">*</span>
          </label>
          <select
            value={unit.pcr_data?.technician_name || ""}
            onChange={(e) =>
              updateUnit(globalIndex, {
                pcr_data: {
                  ...unit.pcr_data!,
                  technician_name: e.target.value,
                },
              })
            }
            className={`w-full border-2 rounded-xl px-4 py-2.5 transition-all ${unit.pcr_data?.technician_name && unit.pcr_data.technician_name !== ''
              ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
              : 'bg-gray-50 border-gray-300'
              } focus:bg-white focus:${colors.border} focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100`}
          >
            <option value="">Select technician...</option>
            {technicians.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {(!unit.pcr_data?.technician_name || unit.pcr_data.technician_name === "") && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Technician required
            </p>
          )}
        </div>

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

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">
            Detection <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={unit.pcr_data?.detection || ""}
            onChange={(e) =>
              updateUnit(globalIndex, {
                pcr_data: {
                  ...unit.pcr_data!,
                  detection: e.target.value ? parseInt(e.target.value) : undefined,
                },
              })
            }
            className={`w-full border-2 rounded-xl px-4 py-2.5 transition-all ${unit.pcr_data?.detection
              ? `bg-gradient-to-r ${colors.gradient} ${colors.border} shadow-md`
              : 'bg-gray-50 border-gray-300'
              } focus:bg-white focus:${colors.border} focus:ring-4 focus:ring-${colors.badge.replace('bg-', '')}-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            placeholder="Enter detection number"
            onWheel={(e) => e.currentTarget.blur()}
          />
        </div>
      </div>

      <DiseaseKitSelector
        availableDiseases={diseases}
        availableKitTypes={kitTypes}
        selectedDiseases={unit.pcr_data?.diseases_list || []}
        onChange={(diseases) =>
          updateUnit(globalIndex, {
            pcr_data: { ...unit.pcr_data!, diseases_list: diseases },
          })
        }
        departmentName="PCR"
      />
      {(!unit.pcr_data?.diseases_list || unit.pcr_data.diseases_list.length === 0) && (
        <p className="text-xs text-red-600 mt-1">At least one disease required</p>
      )}
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
  };
}

function SerologyFields({
  unit,
  globalIndex,
  updateUnit,
  departmentId,
  colors,
}: SerologyFieldsProps) {
  const { data: diseases = [] } = useDiseases(departmentId);
  const { data: kitTypes = [] } = useKitTypes(departmentId);
  const { data: technicians = [] } = useTechnicians();

  return (
    <div className={`border-t-2 ${colors.border} pt-4 mt-4 space-y-4`}>
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">
          Technician <span className="text-red-500">*</span>
        </label>
        <select
          value={unit.serology_data?.technician_name || ""}
          onChange={(e) =>
            updateUnit(globalIndex, {
              serology_data: {
                ...unit.serology_data!,
                technician_name: e.target.value,
              },
            })
          }
          className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
        >
          <option value="">Select technician...</option>
          {technicians.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        {(!unit.serology_data?.technician_name || unit.serology_data.technician_name === "") && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Technician required
          </p>
        )}
      </div>

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
  };
}

function MicrobiologyFields({
  unit,
  globalIndex,
  updateUnit,
  departmentId,
  colors,
}: MicrobiologyFieldsProps) {
  const { data: diseases = [] } = useDiseases(departmentId);
  const { data: technicians = [] } = useTechnicians();
  const [bulkLocations, setBulkLocations] = useState("");
  const [isDiseaseDropdownOpen, setIsDiseaseDropdownOpen] = useState(false);
  const diseaseDropdownRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

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
        <label className="block text-sm font-semibold text-gray-700">
          Technician <span className="text-red-500">*</span>
        </label>
        <select
          value={unit.microbiology_data?.technician_name || ""}
          onChange={(e) =>
            updateUnit(globalIndex, {
              microbiology_data: {
                ...unit.microbiology_data!,
                technician_name: e.target.value,
              },
            })
          }
          className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
        >
          <option value="">Select technician...</option>
          {technicians.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        {(!unit.microbiology_data?.technician_name || unit.microbiology_data.technician_name === "") && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Technician required
          </p>
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
                  className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors"
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
                      <span className="text-sm font-medium text-gray-700">
                        {idx + 1}. {location}
                      </span>
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
    </div>
  );
}

export default function UnifiedSampleRegistration() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { canRead, isLoading: permissionsLoading } = usePermissions();
  const hasReadAccess = canRead('Register Sample');

  // Check permission - redirect if no access
  if (!permissionsLoading && !hasReadAccess) {
    return <Navigate to="/" replace />;
  }

  // Detect edit mode from URL query parameter
  const editSampleId = searchParams.get("edit");
  const isEditMode = !!editSampleId;

  // UI state
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());
  const [completedFields, setCompletedFields] = useState<{
    sampleInfo: boolean;
    units: { [key: number]: boolean };
  }>({ sampleInfo: false, units: {} });

  // Shared sample-level fields
  const [dateReceived, setDateReceived] = useState("");
  const [company, setCompany] = useState("");
  const [farm, setFarm] = useState("");
  const [cycle, setCycle] = useState("");
  const [flock, setFlock] = useState("");
  const [status, setStatus] = useState("In Progress");

  // Units array - each unit has its own fields
  const [units, setUnits] = useState<UnitData[]>([]);
  
  // Edit history dialog state
  const [editHistoryDialog, setEditHistoryDialog] = useState<{ open: boolean; history: any[] }>({
    open: false,
    history: []
  });

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
    const hasHouses = unit.house && unit.house.length > 0;
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

    const isComplete = hasHouses && hasSampleTypes && deptComplete;
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

  // Fetch dropdown data from Controls
  const { data: companies = [] } = useCompanies();
  const { data: allFarms = [] } = useFarms();
  const { data: flocks = [] } = useFlocks();
  const { data: cycles = [] } = useCycles();
  const { data: statuses = [] } = useStatuses();
  const { data: houses = [] } = useHouses();
  const { data: sources = [] } = useSources();

  // Filter farms by selected company (if farms have company association)
  const farms = allFarms; // TODO: Add company filter when backend supports it

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
      setFarm(existingSample.farm || "");
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
            source: unit.source || "",
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
            unitData.serology_data = {
              diseases_list: unit.serology_data.diseases_list || [],
              kit_type: unit.serology_data.kit_type || "",
              number_of_wells: unit.serology_data.number_of_wells || 0,
              tests_count: unit.serology_data.tests_count !== undefined ? unit.serology_data.tests_count : null,
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

  const unitCodesPreview = calculateUnitCodesPreview();
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
        chip: "bg-blue-100 border-blue-300 text-blue-900",
        badge: "bg-blue-600",
        gradient: "from-blue-50 to-blue-100",
      };
    } else if (code === "SER") {
      return {
        bg: "bg-green-50",
        border: "border-green-300",
        chip: "bg-green-100 border-green-300 text-green-900",
        badge: "bg-green-600",
        gradient: "from-green-50 to-green-100",
      };
    } else {
      return {
        bg: "bg-purple-50",
        border: "border-purple-300",
        chip: "bg-purple-100 border-purple-300 text-purple-900",
        badge: "bg-purple-600",
        gradient: "from-purple-50 to-purple-100",
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

  // Get departments that have units
  const getUsedDepartments = () => {
    const deptIds = [...new Set(units.map((u) => u.department_id))];
    return deptIds.map((id) => ({
      id,
      ...getDepartmentInfo(id),
      count: units.filter((u) => u.department_id === id).length,
    }));
  };

  // Add a new unit for a department
  const addUnit = (deptId: number) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return;

    const newUnit: UnitData = {
      department_id: deptId,
      house: [], // Multi-select houses
      age: "",
      source: "",
      sample_type: [], // Multi-select sample types (organs)
      samples_number: null as unknown as number,
      notes: "",
    };

    // Initialize department-specific data
    if (dept.code === "PCR") {
      newUnit.pcr_data = {
        diseases_list: [],
        kit_type: "",
      };
    } else if (dept.code === "SER") {
      newUnit.samples_number = 1; // Default samples count to 1 for Serology
      newUnit.serology_data = {
        diseases_list: [],
        kit_type: "",
        number_of_wells: 0,
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

  // Duplicate a specific unit
  const duplicateUnit = (index: number) => {
    const unitToDuplicate = units[index];
    const duplicatedUnit = JSON.parse(JSON.stringify(unitToDuplicate)); // Deep clone
    const newUnits = [...units];
    newUnits.splice(index + 1, 0, duplicatedUnit); // Insert after current unit
    setUnits(newUnits);
    // Expand the new unit
    setExpandedUnits(prev => new Set([...prev, index + 1]));
  };

  // Get available departments (not yet added)
  const getAvailableDepartments = () => {
    return departments;
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
      alert(`Sample ${data.sample_code} created successfully!`);
      // Reset to initial state
      setDateReceived("");
      setCompany("");
      setFarm("");
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
      alert(
        `ERROR CREATING SAMPLE:

${error.response?.data?.detail || error.message || "Unknown error"}

Status: ${error.response?.status || "N/A"}`,
      );
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
      alert(`Sample ${data.sample_code} updated successfully!`);
      // Navigate back after update
      navigate(-1);
    },
    onError: (error: any) => {
      console.error("Sample update error:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      alert(
        `ERROR UPDATING SAMPLE:

${error.response?.data?.detail || error.message || "Unknown error"}

Status: ${error.response?.status || "N/A"}`,
      );
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

      if (!unit.house || unit.house.length === 0) {
        errors.push(`${unitLabel}: At least one House is required`);
      }

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
        if (!unit.samples_number || unit.samples_number === 0) {
          errors.push(`${unitLabel}: Samples Count is required`);
        }
        if (!unit.pcr_data.extraction || unit.pcr_data.extraction === 0) {
          errors.push(`${unitLabel}: Extraction is required`);
        }
        if (!unit.pcr_data.detection || unit.pcr_data.detection === 0) {
          errors.push(`${unitLabel}: Detection is required`);
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
        if (!unit.serology_data.tests_count || unit.serology_data.tests_count <= 0) {
          errors.push(`${unitLabel}: Tests count must be greater than 0`);
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
      alert(`Please fix the following validation errors:\n\n${errors.join('\n')}`);
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
      farm,
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

            {/* Unit Codes Grid - Compact */}
            {unitCodesPreview.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h4 className="text-sm font-bold text-gray-800">Unit Codes</h4>
                </div>

                <div className="grid gap-2">
                  {unitCodesPreview.map((preview, index) => {
                    const colors = getDepartmentColors(preview.department_code);

                    return (
                      <div key={index} className={`bg-gradient-to-r ${colors.gradient} rounded-lg p-3 border ${colors.border}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`${colors.badge} text-white px-2 py-0.5 rounded text-xs font-bold`}>
                              {preview.department_code}
                            </div>
                            <span className="font-semibold text-gray-800 text-sm">{preview.department_name}</span>
                          </div>
                          <span className="text-xs text-gray-600 font-medium">
                            {preview.count} {preview.count === 1 ? "unit" : "units"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {preview.codes.map((code: string, idx: number) => (
                            <div key={idx} className="bg-white px-2 py-1 rounded text-xs font-mono font-bold text-gray-800 shadow-sm">
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {units.length === 0 && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-8 text-center border-2 border-dashed border-gray-300">
                <svg
                  className="w-16 h-16 text-gray-400 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="text-gray-600 font-medium text-lg mb-1">
                  No Units Added
                </p>
                <p className="text-gray-500 text-sm">
                  Add units below to see unit code preview
                </p>
              </div>
            )}
          </div>
        )}


        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sample-Level Fields */}
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200 overflow-hidden">
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
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value);
                      setTimeout(checkSampleInfoComplete, 100);
                    }}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                    required
                  >
                    <option value="">Select company...</option>
                    {companies.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Farm</label>
                  <select
                    value={farm}
                    onChange={(e) => {
                      setFarm(e.target.value);
                      setTimeout(checkSampleInfoComplete, 100);
                    }}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                  >
                    <option value="">Select farm...</option>
                    {farms.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Cycle</label>
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                  >
                    <option value="">Select cycle...</option>
                    {cycles.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Flock</label>
                  <select
                    value={flock}
                    onChange={(e) => setFlock(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                  >
                    <option value="">Select flock...</option>
                    {flocks.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Status <span className="text-red-500">*</span></label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-2.5 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                  >
                    <option value="">Select status...</option>
                    {statuses.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Department Selection & Unit Management */}
          <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
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
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <span>Departments</span>
              </h3>
            </div>
            <div className="p-6">

              {/* Department Chips with Unit Count */}
              {getUsedDepartments().length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <div className="flex flex-wrap gap-3">
                    {getUsedDepartments().map((dept) => {
                      const colors = getDepartmentColors(dept.code);

                      return (
                        <div
                          key={dept.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${colors.chip}`}
                        >
                          <span className="font-semibold">{dept.name}</span>

                          <div className="flex items-center gap-2 bg-white rounded px-3 py-1 border">
                            <span className="font-bold text-sm">
                              {dept.count}
                            </span>
                            <span className="text-xs opacity-75">
                              {dept.count === 1 ? "unit" : "units"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add Department Dropdown */}
              {getAvailableDepartments().length > 0 && (
                <div className="mb-6">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addUnit(parseInt(e.target.value));
                        e.target.value = "";
                      }
                    }}
                    className="w-full border-2 border-blue-300 rounded-lg px-4 py-2 bg-white hover:bg-blue-50 cursor-pointer"
                  >
                    <option value="">+ Add Unit</option>
                    {getAvailableDepartments().map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {units.length === 0 && (
                <p className="text-gray-500 text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  Add units to begin
                </p>
              )}

              {/* Individual Unit Forms */}
              {Object.entries(getUnitsByDepartment()).map(
                ([deptIdStr, deptUnits]) => {
                  const deptId = parseInt(deptIdStr);
                  const deptInfo = getDepartmentInfo(deptId);
                  const colors = getDepartmentColors(deptInfo.code);

                  return (
                    <div key={deptId} className="mb-6">
                      <h4 className={`font-bold text-lg mb-4 pb-2 border-b-2 ${colors.border}`}>
                        {deptInfo.name}
                      </h4>

                      <div className="space-y-4">
                        {deptUnits.map((unit) => {
                          const globalIndex = units.indexOf(unit);

                          // Calculate the correct sequential position for this department's units
                          // Count how many units of this department appear before this one in the units array
                          const sequentialIndex = units.filter((u, idx) =>
                            u.department_id === deptId && idx <= globalIndex
                          ).length - 1;

                          // In edit mode, use the existing unit code if available
                          const unitCode = unit.unit_code 
                            ? unit.unit_code
                            : (previewData?.unit_counters?.[deptId]
                              ? `${previewData.unit_counters[deptId].department_code}-${previewData.unit_counters[deptId].next_unit_number + sequentialIndex}`
                              : `${deptInfo.code}-${sequentialIndex + 1}`);

                          return (
                            <div
                              key={globalIndex}
                              className={`border-2 ${colors.border} rounded-xl transition-all duration-300 hover:shadow-lg ${colors.bg}`}
                            >
                              {/* Unit Header - Always Visible */}
                              <div className="flex items-center justify-between p-4 bg-white border-b-2 transition-colors hover:bg-gray-50">
                                <div className="flex items-center gap-3 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleUnitExpansion(globalIndex)}
                                    className="p-2 hover:bg-gray-200 rounded-lg transition-all duration-200 group"
                                  >
                                    <svg
                                      className={`w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-transform duration-300 ${expandedUnits.has(globalIndex) ? 'rotate-90' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                  <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-4 py-2 rounded-lg shadow-sm">
                                    <span className="font-mono font-bold text-white text-sm">
                                      {unitCode}
                                    </span>
                                  </div>
                                  {completedFields.units[globalIndex] && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold animate-pulse">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Complete
                                    </div>
                                  )}
                                  {!expandedUnits.has(globalIndex) && (
                                    <div className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                                      {unit.house?.length || 0} houses • {unit.sample_type?.length || 0} sample types
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => duplicateUnit(globalIndex)}
                                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 hover:scale-105 active:scale-95 text-sm font-semibold flex items-center gap-1.5 transition-all duration-200 shadow-sm hover:shadow"
                                    title="Duplicate this unit with all its data"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span className="hidden sm:inline">Duplicate</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeUnit(globalIndex)}
                                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 hover:scale-105 active:scale-95 text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>

                              {/* Unit Body - Collapsible */}
                              {expandedUnits.has(globalIndex) && (
                                <div className="p-4">
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

                                  <div className="space-y-1.5">
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

                                  {/* Department-Specific Fields */}
                                  {deptInfo.code === "PCR" && unit.pcr_data && (
                                    <PCRFields
                                      unit={unit}
                                      globalIndex={globalIndex}
                                      updateUnit={updateUnit}
                                      departmentId={deptId}
                                      colors={colors}
                                    />
                                  )}

                                  {deptInfo.code === "SER" && unit.serology_data && (
                                    <SerologyFields
                                      unit={unit}
                                      globalIndex={globalIndex}
                                      updateUnit={updateUnit}
                                      departmentId={deptId}
                                      colors={colors}
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
                                      />
                                    )}
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
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate("/all-samples")}
              className="px-8 py-3.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 font-semibold transition-all duration-200 shadow-sm hover:shadow"
            >
              Cancel
            </button>
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
                <div className="space-y-3">
                  {editHistoryDialog.history.map((edit: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4 border-l-4 border-amber-400">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-800 capitalize">
                            {edit.field_name.replace(/_/g, ' ')}
                          </span>
                          {edit.unit_code && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {edit.unit_code}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(edit.edited_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-red-50 rounded p-3">
                          <p className="text-xs text-red-600 font-medium mb-1">Before</p>
                          <p className="text-red-800 break-words">{edit.old_value || '-'}</p>
                        </div>
                        <div className="bg-green-50 rounded p-3">
                          <p className="text-xs text-green-600 font-medium mb-1">After</p>
                          <p className="text-green-800 break-words">{edit.new_value || '-'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Edited by: <span className="font-medium">{edit.edited_by}</span>
                      </p>
                    </div>
                  ))}
                </div>
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
