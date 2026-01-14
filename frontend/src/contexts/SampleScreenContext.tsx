import { createContext, useContext, useState, ReactNode } from 'react';

export interface SampleScreenControls {
  // Search
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  
  // Year filter
  selectedYear: number;
  onYearChange: (year: number) => void;
  availableYears: number[];
  
  // Export
  onExportExcel: () => void;
  onExportCSV: () => void;
  exportDisabled: boolean;
  isExporting: boolean;
  recordCount: number;
  
  // Filter panel
  onFilterClick: () => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  
  // Loading state
  loading: boolean;
  
  // Theme color for the department
  themeColor: 'blue' | 'green' | 'amber' | 'purple';
}

interface SampleScreenContextType {
  controls: SampleScreenControls | null;
  setControls: (controls: SampleScreenControls | null) => void;
}

const SampleScreenContext = createContext<SampleScreenContextType | undefined>(undefined);

export const SampleScreenProvider = ({ children }: { children: ReactNode }) => {
  const [controls, setControls] = useState<SampleScreenControls | null>(null);

  return (
    <SampleScreenContext.Provider value={{ controls, setControls }}>
      {children}
    </SampleScreenContext.Provider>
  );
};

export const useSampleScreenControls = () => {
  const context = useContext(SampleScreenContext);
  if (context === undefined) {
    throw new Error('useSampleScreenControls must be used within a SampleScreenProvider');
  }
  return context;
};
