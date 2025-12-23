/**
 * Utility functions for Technical Data Sheets
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 */
export const escapeHtml = (text: string | number | null | undefined): string => {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Adds serial numbers to rows based on MIC Code grouping
 */
export const addSerialNumbers = <T extends { micCode: string }>(rows: T[]): (T & { serialNo: number })[] => {
    let currentMic = '';
    let counter = 0;

    return rows.map(row => {
        if (row.micCode !== currentMic) {
            currentMic = row.micCode;
            counter = 1;
        } else {
            counter++;
        }
        return { ...row, serialNo: counter };
    });
};

/**
 * Filters samples by date range
 */
export const filterByDateRange = (
    sampleDate: Date | string | null | undefined,
    startDate: string | null,
    endDate: string | null
): boolean => {
    if (!sampleDate) return false;

    const date = typeof sampleDate === 'string' ? new Date(sampleDate) : sampleDate;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && date < start) return false;
    if (end) {
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
    }

    return true;
};

/**
 * Sorts rows by MIC Code
 */
export const sortByMicCode = <T extends { micCode: string }>(rows: T[]): T[] => {
    return [...rows].sort((a, b) => a.micCode.localeCompare(b.micCode, undefined, { numeric: true }));
};

/**
 * Calculates alternating row colors based on MIC Code grouping
 */
export const calculateRowColors = <T extends { micCode: string }>(rows: T[]): string[] => {
    let lastMic = '';
    let isGrayGroup = false;

    return rows.map((row, i) => {
        if (!row.micCode) return 'bg-white';

        if (i === 0 || row.micCode !== lastMic) {
            lastMic = row.micCode;
            isGrayGroup = !isGrayGroup;
        }

        return isGrayGroup ? 'bg-gray-200' : 'bg-white';
    });
};

/**
 * Ensures a minimum number of rows for consistent display
 */
export const ensureMinimumRows = <T>(rows: T[], minRows: number, emptyRow: T): T[] => {
    const result = [...rows];
    while (result.length < minRows) {
        result.push(emptyRow);
    }
    return result;
};

/**
 * Validates that start date is before or equal to end date
 */
export const validateDateRange = (startDate: string, endDate: string): { valid: boolean; error?: string } => {
    if (!startDate || !endDate) {
        return { valid: false, error: 'Both dates are required' };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, error: 'Invalid date format' };
    }

    if (start > end) {
        return { valid: false, error: 'Start date must be before or equal to end date' };
    }

    return { valid: true };
};
