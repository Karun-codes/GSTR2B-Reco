import { InvoiceData } from '../types';

const CARRY_FORWARD_STORAGE_KEY = 'gstrRecoCarryForwardData';

type CarryForwardData = {
    [period: string]: { // period is YYYY-MM
        gstr2b: InvoiceData[];
        books: InvoiceData[];
    }
};

/**
 * Retrieves all carried forward data from localStorage.
 */
const getFullCarryForwardData = (): CarryForwardData => {
    try {
        const data = localStorage.getItem(CARRY_FORWARD_STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error("Failed to parse carry forward data from localStorage", error);
        return {};
    }
};

/**
 * Saves the entire carry forward data object back to localStorage.
 */
const saveFullCarryForwardData = (data: CarryForwardData) => {
    try {
        localStorage.setItem(CARRY_FORWARD_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Failed to save carry forward data to localStorage", error);
    }
};


/**
 * Retrieves invoices carried forward TO a specific period.
 * @param period - The target period in 'YYYY-MM' format.
 * @returns An object with gstr2b and books invoices, or empty arrays if none.
 */
export const getCarriedForwardInvoices = (period: string): { gstr2b: InvoiceData[], books: InvoiceData[] } => {
    const allData = getFullCarryForwardData();
    return allData[period] || { gstr2b: [], books: [] };
};

/**
 * Saves invoices to be carried forward to the next period.
 * This function appends to existing data for that period.
 * @param period - The target period in 'YYYY-MM' format to save TO.
 * @param invoices - The invoices to save.
 */
export const saveCarriedForwardInvoices = (
    period: string, 
    invoices: { gstr2b: InvoiceData[], books: InvoiceData[] }
) => {
    const allData = getFullCarryForwardData();
    const existingData = allData[period] || { gstr2b: [], books: [] };
    
    // Simple append, assuming we don't need to de-duplicate here
    existingData.gstr2b.push(...invoices.gstr2b);
    existingData.books.push(...invoices.books);

    allData[period] = existingData;
    saveFullCarryForwardData(allData);
};
