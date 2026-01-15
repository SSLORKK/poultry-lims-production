// Constants for samples components (Issue #12 fix)

// Export limits
export const EXPORT_LIMIT = 10000; // Maximum records to export

// Pagination and display limits
export const PAGE_SIZE = 100;
export const MAX_DISPLAY_LIMIT = 1000;

// Auto-refresh intervals (in milliseconds)
export const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

// Department IDs
export const DEPARTMENT_IDS = {
  PCR: 1,
  Serology: 2,
  Microbiology: 3
} as const;

// COA thresholds for microbiology
export const TOTAL_COUNT_LIMITS = {
  FEED_SAMPLE: 100000, // 10^5 for FEED samples
  OTHER_SAMPLE: 1000   // 10^3 for other samples
} as const;

// Timeout durations (in milliseconds)
export const PRINT_CLEANUP_TIMEOUT = 1000;
export const DIALOG_CLOSE_DELAY = 100;

// Items per page for pagination
export const ITEMS_PER_PAGE = 100;
