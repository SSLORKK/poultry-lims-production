/**
 * Validation utilities for data integrity and type safety
 */

interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  error?: string;
}

/**
 * Safely parses JSON with proper error handling and validation
 */
export function safeJSONParse<T>(
  jsonString: string,
  validator?: (data: unknown) => data is T
): ValidationResult<T> {
  try {
    const parsed = JSON.parse(jsonString);
    
    if (validator && !validator(parsed)) {
      return {
        isValid: false,
        error: 'Data failed validation check'
      };
    }
    
    return {
      isValid: true,
      data: parsed as T
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON'
    };
  }
}

/**
 * Type guard for draft data structure
 */
export function isDraftData(data: unknown): data is {
  dateReceived?: string;
  company?: string;
  farm?: string[];
  cycle?: string;
  flock?: string;
  status?: string;
  units?: any[];
} {
  if (!data || typeof data !== 'object') return false;
  
  const draft = data as any;
  
  return (
    (draft.dateReceived === undefined || typeof draft.dateReceived === 'string') &&
    (draft.company === undefined || typeof draft.company === 'string') &&
    (draft.farm === undefined || Array.isArray(draft.farm)) &&
    (draft.cycle === undefined || typeof draft.cycle === 'string') &&
    (draft.flock === undefined || typeof draft.flock === 'string') &&
    (draft.status === undefined || typeof draft.status === 'string') &&
    (draft.units === undefined || Array.isArray(draft.units))
  );
}

/**
 * Validates UnitData structure
 */
export function isValidUnitData(data: unknown): data is {
  id?: number;
  unit_code?: string;
  department_id: number;
  house: string[];
  age: string;
  source: string[];
  sample_type: string[];
  samples_number: number | null;
  notes: string | null;
  pcr_data?: any;
  serology_data?: any;
  microbiology_data?: any;
} {
  if (!data || typeof data !== 'object') return false;
  
  const unit = data as any;
  
  return (
    typeof unit.department_id === 'number' &&
    Array.isArray(unit.house) &&
    typeof unit.age === 'string' &&
    Array.isArray(unit.source) &&
    Array.isArray(unit.sample_type) &&
    (unit.samples_number === null || typeof unit.samples_number === 'number') &&
    (unit.notes === null || typeof unit.notes === 'string')
  );
}

/**
 * Sanitizes string input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Deep validation for nested objects with error collection
 */
export class ValidationError extends Error {
  public readonly field: string;
  
  constructor(field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export function collectValidationErrors(validations: (() => void)[]): ValidationError[] {
  const errors: ValidationError[] = [];
  
  validations.forEach(validation => {
    try {
      validation();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error);
      }
    }
  });
  
  return errors;
}
