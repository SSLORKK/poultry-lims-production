import React, { useState, useRef, useEffect } from 'react';

interface DiseaseKitItem {
  disease: string;
  kit_type: string;
  test_count?: number;
}

interface DiseaseKitSelectorProps {
  availableDiseases: { id: number; name: string }[];
  availableKitTypes: { id: number; name: string }[];
  selectedDiseases: DiseaseKitItem[];
  onChange: (diseases: DiseaseKitItem[]) => void;
  departmentName: string;
  defaultKitTypes?: Record<string, string>; // disease name -> default kit type
}

export const DiseaseKitSelector: React.FC<DiseaseKitSelectorProps> = ({
  availableDiseases,
  availableKitTypes,
  selectedDiseases,
  onChange,
  departmentName,
  defaultKitTypes = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 384; // max-h-96 = 24rem = 384px

      // If not enough space below but more space above, show dropdown above
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setDropdownPosition('top');
      } else {
        setDropdownPosition('bottom');
      }
    }
  }, [isOpen]);

  const isDiseaseSelected = (diseaseName: string) => {
    return selectedDiseases.some(d => d.disease === diseaseName);
  };

  const getKitTypeForDisease = (diseaseName: string) => {
    const found = selectedDiseases.find(d => d.disease === diseaseName);
    return found?.kit_type || '';
  };

  const handleDiseaseToggle = (diseaseName: string) => {
    if (isDiseaseSelected(diseaseName)) {
      onChange(selectedDiseases.filter(d => d.disease !== diseaseName));
    } else {
      // Apply default kit type if available
      const defaultKit = defaultKitTypes[diseaseName] || '';
      onChange([...selectedDiseases, { disease: diseaseName, kit_type: defaultKit, test_count: 1 }]);
    }
  };

  const handleTestCountChange = (diseaseName: string, delta: number) => {
    onChange(
      selectedDiseases.map(d => {
        if (d.disease === diseaseName) {
          const currentCount = d.test_count || 1;
          const newCount = Math.max(1, currentCount + delta);
          return { ...d, test_count: newCount };
        }
        return d;
      })
    );
  };

  const handleKitTypeChange = (diseaseName: string, kitType: string) => {
    onChange(
      selectedDiseases.map(d =>
        d.disease === diseaseName ? { ...d, kit_type: kitType } : d
      )
    );
  };

  const handleRemoveDisease = (diseaseName: string) => {
    onChange(selectedDiseases.filter(d => d.disease !== diseaseName));
  };

  const borderColor = {
    PCR: 'border-blue-300',
    Serology: 'border-green-300',
    Microbiology: 'border-purple-300',
  }[departmentName] || 'border-gray-300';

  const bgColor = {
    PCR: 'bg-blue-50',
    Serology: 'bg-green-50',
    Microbiology: 'bg-purple-50',
  }[departmentName] || 'bg-gray-50';

  const chipBgColor = {
    PCR: 'bg-blue-100 text-blue-800',
    Serology: 'bg-green-100 text-green-800',
    Microbiology: 'bg-purple-100 text-purple-800',
  }[departmentName] || 'bg-gray-100 text-gray-800';

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        Diseases & Kit Types <span className="text-red-500">*</span>
      </label>

      {/* Selected Diseases Chips */}
      {selectedDiseases.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
          {selectedDiseases.map((item) => (
            <div
              key={item.disease}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm ${chipBgColor} border border-current border-opacity-20`}
            >
              <span>{item.disease}</span>
              {item.kit_type && (
                <span className="text-xs opacity-75 font-normal">• {item.kit_type}</span>
              )}
              <button
                type="button"
                onClick={() => handleRemoveDisease(item.disease)}
                className="ml-1 hover:scale-110 transition-transform font-bold"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full border-2 rounded-xl px-4 py-3 bg-gray-50 hover:bg-white text-left flex justify-between items-center transition-all focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 ${borderColor}`}
        >
          <span className="text-gray-700 font-medium">
            {selectedDiseases.length > 0
              ? `${selectedDiseases.length} disease(s) selected`
              : 'Select diseases and kit types'}
          </span>
          <svg className={`w-5 h-5 text-gray-600 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className={`absolute z-[9999] w-full ${dropdownPosition === 'top' ? 'bottom-full mb-2' : 'mt-2'} border-2 rounded-xl shadow-2xl bg-white ${borderColor}`}>
            <div className="max-h-96 overflow-y-auto">
              {availableDiseases.length === 0 ? (
                <div className="px-4 py-6 text-gray-500 text-sm text-center">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="font-medium">No diseases available</p>
                  <p className="text-xs mt-1">Add them in Controls first</p>
                </div>
              ) : (
                availableDiseases.map((disease) => (
                  <div
                    key={disease.id}
                    className={`px-4 py-3 border-b last:border-b-0 transition-colors hover:${bgColor}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isDiseaseSelected(disease.name)}
                        onChange={() => handleDiseaseToggle(disease.name)}
                        className="h-5 w-5 text-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />

                      {/* Disease Name */}
                      <label className="text-sm font-semibold text-gray-800 cursor-pointer hover:text-gray-900 min-w-[120px]">
                        {disease.name}
                      </label>

                      {/* Kit Type Dropdown - Always visible but only enabled when selected */}
                      <select
                        value={getKitTypeForDisease(disease.name)}
                        onChange={(e) => {
                          if (!isDiseaseSelected(disease.name)) {
                            handleDiseaseToggle(disease.name);
                          }
                          handleKitTypeChange(disease.name, e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!isDiseaseSelected(disease.name)}
                        className={`flex-1 text-sm border-2 rounded-lg px-2 py-1.5 transition-all ${
                          isDiseaseSelected(disease.name) 
                            ? 'border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                            : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <option value="">Kit type...</option>
                        {availableKitTypes.map((kit) => (
                          <option key={kit.id} value={kit.name}>
                            {kit.name}
                          </option>
                        ))}
                      </select>

                      {/* Test Counter - Always visible but only enabled when selected */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleTestCountChange(disease.name, -1); }}
                          disabled={!isDiseaseSelected(disease.name)}
                          className={`w-7 h-7 flex items-center justify-center rounded-full font-bold text-sm transition-colors ${
                            isDiseaseSelected(disease.name)
                              ? 'bg-red-100 text-red-600 hover:bg-red-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          -
                        </button>
                        <div className={`w-10 py-1 text-center font-bold text-sm rounded-lg border-2 ${
                          isDiseaseSelected(disease.name)
                            ? 'bg-gray-50 border-gray-200 text-gray-800'
                            : 'bg-gray-100 border-gray-200 text-gray-400'
                        }`}>
                          {selectedDiseases.find(d => d.disease === disease.name)?.test_count || 1}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleTestCountChange(disease.name, 1); }}
                          disabled={!isDiseaseSelected(disease.name)}
                          className={`w-7 h-7 flex items-center justify-center rounded-full font-bold text-sm transition-colors ${
                            isDiseaseSelected(disease.name)
                              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selectedDiseases.some(d => !d.kit_type) && (
        <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
          <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-orange-700 font-medium">
            Please select kit type for all diseases
          </p>
        </div>
      )}
    </div>
  );
};
