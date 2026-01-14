import { useRef, useState, useEffect } from 'react';
import { useSampleScreenControls } from '../contexts/SampleScreenContext';

const themeColors = {
  blue: {
    bg: 'bg-blue-600',
    hover: 'hover:bg-blue-700',
    ring: 'focus:ring-blue-500',
    text: 'text-blue-600',
    lightBg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  green: {
    bg: 'bg-green-600',
    hover: 'hover:bg-green-700',
    ring: 'focus:ring-green-500',
    text: 'text-green-600',
    lightBg: 'bg-green-50',
    border: 'border-green-200',
  },
  amber: {
    bg: 'bg-amber-600',
    hover: 'hover:bg-amber-700',
    ring: 'focus:ring-amber-500',
    text: 'text-amber-600',
    lightBg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  purple: {
    bg: 'bg-purple-600',
    hover: 'hover:bg-purple-700',
    ring: 'focus:ring-purple-500',
    text: 'text-purple-600',
    lightBg: 'bg-purple-50',
    border: 'border-purple-200',
  },
};

export const SampleScreenTopBar = () => {
  const { controls } = useSampleScreenControls();
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

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

  if (!controls) return null;

  const theme = themeColors[controls.themeColor];

  return (
    <div className="flex items-center gap-2 lg:gap-3 flex-1 justify-end">
      {/* Search Input */}
      <div className="relative flex-1 max-w-xs lg:max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder={controls.searchPlaceholder || "Search..."}
          value={controls.searchValue}
          onChange={(e) => controls.onSearchChange(e.target.value)}
          className={`w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 ${theme.ring} focus:border-transparent bg-white`}
        />
        {controls.loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      {/* Year Select */}
      <select
        value={controls.selectedYear}
        onChange={(e) => controls.onYearChange(Number(e.target.value))}
        className={`px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 ${theme.ring} focus:border-transparent bg-white min-w-[70px]`}
      >
        {controls.availableYears.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>

      {/* Filter Button */}
      <button
        onClick={controls.onFilterClick}
        className={`relative p-2 rounded-lg border ${controls.activeFilterCount > 0 ? `${theme.lightBg} ${theme.border}` : 'border-gray-300 bg-white'} hover:bg-gray-50 transition-colors`}
        title="Filters"
      >
        <svg className={`w-4 h-4 ${controls.activeFilterCount > 0 ? theme.text : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        {controls.activeFilterCount > 0 && (
          <span className={`absolute -top-1 -right-1 w-4 h-4 ${theme.bg} text-white text-xs rounded-full flex items-center justify-center font-medium`}>
            {controls.activeFilterCount}
          </span>
        )}
      </button>

      {/* Clear Filters (only show when there are active filters) */}
      {controls.activeFilterCount > 0 && (
        <button
          onClick={controls.onClearFilters}
          className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-red-50 hover:border-red-200 transition-colors"
          title="Clear all filters"
        >
          <svg className="w-4 h-4 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Export Dropdown */}
      <div className="relative" ref={exportDropdownRef}>
        <button
          onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
          disabled={controls.isExporting || controls.exportDisabled}
          className={`px-3 py-1.5 ${theme.bg} text-white rounded-lg ${theme.hover} flex items-center gap-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium`}
        >
          {controls.isExporting ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="hidden sm:inline">Exporting...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Export</span>
              <svg className={`w-3 h-3 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {exportDropdownOpen && (
          <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
            <div className="py-1">
              <button
                onClick={() => {
                  controls.onExportExcel();
                  setExportDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => {
                  controls.onExportCSV();
                  setExportDropdownOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">CSV (.csv)</span>
              </button>
            </div>
            <div className="border-t border-gray-200 px-3 py-1.5 text-xs text-gray-500">
              {controls.recordCount} records
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
