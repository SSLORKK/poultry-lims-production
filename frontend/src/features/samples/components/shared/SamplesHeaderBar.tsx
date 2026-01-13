import { useRef, useEffect } from 'react';

interface SamplesHeaderBarProps {
  title: string;
  themeColor: 'purple' | 'green' | 'blue' | 'orange';
  globalSearch: string;
  setGlobalSearch: (value: string) => void;
  loading: boolean;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  availableYears: number[];
  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;
  activeFilterCount: number;
  clearFilters: () => void;
  exportDropdownOpen: boolean;
  setExportDropdownOpen: (open: boolean) => void;
  isExporting: boolean;
  exportToExcel: () => void;
  exportToCSV: () => void;
  filteredRowsCount: number;
}

const themeColors = {
  purple: {
    title: 'text-purple-700',
    filterBtn: 'bg-purple-100 hover:bg-purple-200 text-purple-600',
    ring: 'focus:ring-purple-500 focus:border-purple-500',
    badge: 'bg-purple-100 text-purple-700',
  },
  green: {
    title: 'text-green-700',
    filterBtn: 'bg-green-100 hover:bg-green-200 text-green-600',
    ring: 'focus:ring-green-500 focus:border-green-500',
    badge: 'bg-green-100 text-green-700',
  },
  blue: {
    title: 'text-blue-700',
    filterBtn: 'bg-blue-100 hover:bg-blue-200 text-blue-600',
    ring: 'focus:ring-blue-500 focus:border-blue-500',
    badge: 'bg-blue-100 text-blue-700',
  },
  orange: {
    title: 'text-orange-700',
    filterBtn: 'bg-orange-100 hover:bg-orange-200 text-orange-600',
    ring: 'focus:ring-orange-500 focus:border-orange-500',
    badge: 'bg-orange-100 text-orange-700',
  },
};

export const SamplesHeaderBar = ({
  title,
  themeColor,
  globalSearch,
  setGlobalSearch,
  loading,
  selectedYear,
  setSelectedYear,
  availableYears,
  filterPanelOpen,
  setFilterPanelOpen,
  activeFilterCount,
  clearFilters,
  exportDropdownOpen,
  setExportDropdownOpen,
  isExporting,
  exportToExcel,
  exportToCSV,
  filteredRowsCount,
}: SamplesHeaderBarProps) => {
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const colors = themeColors[themeColor];

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setExportDropdownOpen]);

  return (
    <div className="mb-4 lg:mb-6 border-b border-gray-200 pb-4">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3 lg:mb-0">
        <h2 className={`text-xl sm:text-2xl font-bold ${colors.title}`}>{title}</h2>
        {/* Mobile: Show filter button here */}
        <button
          onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          className={`lg:hidden p-2 rounded-lg ${colors.filterBtn}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>
      
      {/* Search and controls row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search and Year */}
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="🔍 Search..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className={`w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 ${colors.ring}`}
            />
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={`px-2 sm:px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 ${colors.ring} min-w-[80px]`}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={isExporting || filteredRowsCount === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
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
                  <span className="text-sm font-medium hidden sm:inline">Export</span>
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
                  {filteredRowsCount} records to export
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-sm font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <span className={`px-2 py-0.5 text-xs font-semibold ${colors.badge} rounded-full`}>
                {activeFilterCount}
              </span>
            )}
            <svg className={`w-4 h-4 transition-transform ${filterPanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-800 underline hidden sm:inline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
