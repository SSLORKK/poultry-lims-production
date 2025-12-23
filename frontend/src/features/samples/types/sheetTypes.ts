/**
 * Type definitions for Technical Data Sheets
 */

/**
 * Common sheet row structure
 */
export interface BaseSheetRow {
    labCode: string;
    micCode: string;
    sampleType: string;
    sampleIndex: string;
    serialNo: number | string;
}

/**
 * Water sheet specific row with additional fields
 */
export interface WaterSheetRow extends BaseSheetRow {
    dilutionFactor: string;
    waterVolume: string;
}

/**
 * Microbiology data structure
 */
export interface MicrobiologyData {
    diseases_list?: string[];
    index_list?: string[];
}

/**
 * Sample unit structure
 */
export interface SampleUnit {
    unit_code: string;
    department_id: number;
    sample_type: string | string[];
    microbiology_data?: MicrobiologyData;
}

/**
 * Sample structure from API
 */
export interface Sample {
    sample_code: string;
    date_received?: string;
    units?: SampleUnit[];
}

/**
 * API response structure for samples
 */
export interface SamplesResponse {
    data: Sample[];
}

/**
 * Sheet reference for exports
 */
export interface SheetRef {
    exportToExcel: () => void;
    exportToPDF: () => void;
}

/**
 * Common sheet props
 */
export interface SheetProps {
    startDate: string;
    endDate: string;
}
