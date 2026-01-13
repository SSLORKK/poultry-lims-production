// Shared types for Database components

export interface Sample {
  id: number;
  sample_code: string;
  date_received: string;
  company: string;
  farm: string;
  flock: string;
  cycle: string;
  status: string;
  units: Unit[];
}

export interface Unit {
  id: number;
  unit_code: string;
  department_id: number;
  house: string[];
  age: string | null;
  source: string | string[];
  sample_type: string[];
  samples_number: number | null;
  notes: string;
  coa_status: string | null;
  pcr_data?: {
    diseases_list: Array<{ disease: string; kit_type: string }>;
    technician_name: string;
    extraction_method: string;
  };
  serology_data?: {
    diseases_list: Array<{ 
      disease: string; 
      kit_type: string; 
      mean?: number | null;
      cv?: number | null;
      min?: number | null;
      max?: number | null;
      coa_file_id?: number | null;
    }>;
    kit_type: string;
    number_of_wells: number;
  };
  microbiology_data?: {
    diseases_list: string[];
    batch_no: string;
    fumigation: string;
    index_list: string[];
  };
}

export interface PCRCOAData {
  id?: number;
  unit_id: number;
  test_results: { [disease: string]: { [sampleType: string]: string } };
  sample_types?: string[];
  date_tested: string | null;
}

export interface MicrobiologyCOAData {
  id?: number;
  unit_id: number;
  test_results: { [disease: string]: { [sampleType: string]: string } };
  date_tested: string | null;
  status: string;
}

export type Department = 'PCR' | 'Serology' | 'Microbiology';

export const DEPARTMENT_IDS: Record<Department, number> = {
  PCR: 1,
  Serology: 2,
  Microbiology: 3,
};

export interface DatabaseFilters {
  resultsFilter: string;
  diseases: string[];
  ages: string[];
  dateFrom: string;
  dateTo: string;
  companies: string[];
  farms: string[];
  flocks: string[];
  sampleTypes: string[];
  cycles: string[];
  sources: string[];
  serologyDiseases: string[];
  serologyKitTypes: string[];
  microbiologyDiseases: string[];
  microbiologyResults: string[];
  pcrDiseases: string[];
  pcrResults: string[];
}

// Common props for all database table components
export interface BaseDatabaseTableProps {
  units: Array<Unit & { sample: Sample }>;
  totalUnits: number;
  totalCount: number;
  visibleColumns: Record<string, boolean>;
  page: number;
  onPageChange: (page: number) => void;
  filters: DatabaseFilters;
}

export interface PCRTableProps extends BaseDatabaseTableProps {
  diseases: string[];
  renderCTCell: (value: string | undefined) => React.ReactElement;
  selectedSampleTypes: string[];
  resultsFilter: string;
}

export interface MicrobiologyTableProps extends BaseDatabaseTableProps {
  selectedMicrobiologyResults: string[];
}

export interface SerologyTableProps extends BaseDatabaseTableProps {}
