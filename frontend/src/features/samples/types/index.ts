// Shared types for sample screens

export interface BaseSampleRow {
  sampleId: number;
  sampleCode: string;
  unitId: number;
  unitCode: string;
  dateReceived: string;
  company: string;
  farm: string;
  flock: string;
  cycle: string;
  house: string;
  age: string | null;
  source: string;
  notes: string;
  sampleType: string;
  status: string;
  coaStatus: string | null;
}

export interface PCRSampleRow extends BaseSampleRow {
  technician: string;
  samplesNumber: number | null;
  extraction: number | null;
  detection: number | null;
  diseases: string;
  kitType: string;
  technicianName: string;
  extractionMethod: string;
}

export interface SerologySampleRow extends BaseSampleRow {
  technician: string;
  samplesNumber: number | null;
  numberOfWells: number | null;
  testsCount: number | null;
  diseases: string;
  diseasesWithWells: { disease: string; wells: number | null }[];
}

export interface MicrobiologySampleRow extends BaseSampleRow {
  technician: string;
  samplesNumber: number | null;
  diseases: string[];
  testMethod: string;
  incubationTemp: string;
  incubationTime: string;
}

export type SampleRow = PCRSampleRow | SerologySampleRow | MicrobiologySampleRow;

export type SampleStatus = 
  | 'completed' 
  | 'complete' 
  | 'in_progress' 
  | 'in progress'
  | 'need_approval' 
  | 'need approval' 
  | 'pending approval'
  | 'postponed' 
  | 'hold'
  | 'rejected';

export interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export interface FilterOptions {
  companies: string[];
  farms: string[];
  flocks: string[];
  cycles: string[];
  statuses: string[];
  ages: string[];
  sample_types: string[];
  sources: string[];
  houses: string[];
}

export interface NoteDialogState {
  open: boolean;
  note: string;
}

export interface EditHistoryDialogState {
  open: boolean;
  code: string;
  history: EditHistoryItem[];
}

export interface EditHistoryItem {
  id: number;
  field_name: string;
  old_value: string;
  new_value: string;
  edited_by: string;
  edited_at: string;
}

export type DepartmentType = 'pcr' | 'serology' | 'microbiology';

export const DEPARTMENT_IDS: Record<DepartmentType, number> = {
  pcr: 1,
  serology: 2,
  microbiology: 3,
};

export const DEPARTMENT_COLORS: Record<DepartmentType, { primary: string; light: string; bg: string }> = {
  pcr: { primary: 'blue', light: 'blue-100', bg: 'blue-600' },
  serology: { primary: 'green', light: 'green-100', bg: 'green-600' },
  microbiology: { primary: 'purple', light: 'purple-100', bg: 'purple-600' },
};
