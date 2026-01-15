/**
 * Safe deep cloning utility to replace unsafe JSON.parse(JSON.stringify())
 * Handles circular references, functions, and complex objects properly
 */

/**
 * Deep clones an object safely without losing functions or failing on circular references
 * @param obj - Object to clone
 * @param seen - WeakMap to track circular references
 * @returns Deep cloned object
 */
export function deepClone<T>(obj: T, seen = new WeakMap()): T {
  // Handle primitives and null
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item, seen)) as unknown as T;
  }

  // Handle circular references
  if (seen.has(obj as object)) {
    return seen.get(obj as object);
  }

  // Handle regular objects
  const cloned = {} as T;
  seen.set(obj as object, cloned);

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (cloned as any)[key] = deepClone((obj as any)[key], seen);
    }
  }

  return cloned;
}

/**
 * Creates a deep clone specifically for unit data with validation
 */
export function cloneUnitData(unit: any): any {
  try {
    const cloned = deepClone(unit);
    
    // Ensure required fields exist and have proper types
    return {
      ...cloned,
      id: cloned.id || undefined,
      unit_code: cloned.unit_code || undefined,
      department_id: Number(cloned.department_id) || 0,
      house: Array.isArray(cloned.house) ? [...cloned.house] : [],
      age: String(cloned.age || ''),
      source: Array.isArray(cloned.source) ? [...cloned.source] : [],
      sample_type: Array.isArray(cloned.sample_type) ? [...cloned.sample_type] : [],
      samples_number: cloned.samples_number ?? null,
      notes: cloned.notes ?? null,
      pcr_data: cloned.pcr_data ? deepClone(cloned.pcr_data) : null,
      serology_data: cloned.serology_data ? deepClone(cloned.serology_data) : null,
      microbiology_data: cloned.microbiology_data ? deepClone(cloned.microbiology_data) : null
    };
  } catch (error) {
    console.error('Failed to clone unit data:', error);
    throw new Error('Unit cloning failed - data may be corrupted');
  }
}
