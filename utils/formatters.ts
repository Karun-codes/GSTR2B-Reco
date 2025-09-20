import { UnifiedInvoice } from '../types';

/**
 * Formats a number into the Indian numbering system (lakhs, crores).
 * e.g., 100000 -> "1,00,000.00"
 * @param num The number to format.
 * @returns A formatted string.
 */
export const formatIndianCurrency = (num: number | undefined | null): string => {
    if (num === null || num === undefined) {
        return '0.00';
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

/**
 * Formats an integer into the Indian numbering system.
 * e.g., 100000 -> "1,00,000"
 * @param num The number to format.
 * @returns A formatted string without decimals.
 */
export const formatIndianInteger = (num: number | undefined | null): string => {
    if (num === null || num === undefined) {
        return '0';
    }
    return new Intl.NumberFormat('en-IN').format(num);
};


/**
 * Extracts the abbreviated month name from a date string (e.g., "DD-MM-YYYY").
 * @param dateStr The date string.
 * @returns A three-letter month abbreviation (e.g., "Apr").
 */
export const getInvoiceMonth = (dateStr: string | undefined | null): string => {
    if (!dateStr) return 'N/A';
    try {
        // Handle various date separators and formats robustly
        const parts = dateStr.split(/[-/]/);
        if (parts.length !== 3) return 'N/A';
        
        let day, month, year;
        
        // Assuming DD-MM-YYYY or MM-DD-YYYY. Check if middle part is a valid month.
        const part1 = parseInt(parts[0], 10);
        const part2 = parseInt(parts[1], 10);

        if (part2 > 0 && part2 <= 12) { // DD-MM-YYYY
            day = part1;
            month = part2;
            year = parseInt(parts[2], 10);
        } else if (part1 > 0 && part1 <= 12) { // MM-DD-YYYY
            month = part1;
            day = part2;
            year = parseInt(parts[2], 10);
        } else {
            return 'N/A';
        }

        // Create a date object (month is 0-indexed in JS)
        const date = new Date(year, month - 1, day);
        return date.toLocaleString('default', { month: 'short' });

    } catch (e) {
        return 'N/A';
    }
};

/**
 * Calculates the tax rate for a given invoice.
 * @param inv The invoice object.
 * @returns The calculated tax rate as a formatted string (e.g., "18.00%").
 */
export const calculateTaxRate = (inv: UnifiedInvoice): string => {
    if (!inv.taxableValue || inv.taxableValue === 0) {
        return '0.00%';
    }
    const rate = (inv.totalTax / inv.taxableValue) * 100;
    return `${rate.toFixed(2)}%`;
};