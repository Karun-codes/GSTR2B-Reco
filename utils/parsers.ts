import { InvoiceData } from '../types';

/**
 * Normalizes a GSTIN to a standard format for reliable matching.
 * This function performs the following steps:
 * 1. Handles null, undefined, or empty inputs by returning an empty string.
 * 2. Trims leading and trailing whitespace.
 * 3. Converts the entire string to uppercase.
 * 4. Removes all non-alphanumeric characters (e.g., spaces, hyphens, slashes).
 * This ensures that variations like ' 29aabcu9567l1z1 ', '29-AABCU-9567-L1Z1',
 * or '29AABCU 9567L1Z1' are all converted to the canonical '29AABCU9567L1Z1'.
 */
export const normalizeGstin = (gstin: string | undefined | null): string => {
    if (!gstin) return '';
    return gstin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

/**
 * Normalizes a supplier name for better matching.
 */
export const normalizeName = (name: string | undefined | null): string => {
    if (!name) return '';
    return name.trim().toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
        .replace(/\s*PVT\s*LTD\.?/, ' PRIVATE LIMITED')
        .replace(/\s*LTD\.?/, ' LIMITED')
        .trim();
};

/**
 * Normalizes a document/invoice number.
 */
export const normalizeDocNo = (docNo: string | undefined | null): string => {
    if (!docNo) return '';
    return docNo.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

/**
 * Calculates the Levenshtein distance between two strings.
 * A measure of the difference between two sequences.
 */
export const levenshtein = (s1: string, s2: string): number => {
    if (!s1 || !s2) return 999;
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) {
       track[0][i] = i;
    }
    for (let j = 0; j <= s2.length; j += 1) {
       track[j][0] = j;
    }
    for (let j = 1; j <= s2.length; j += 1) {
       for (let i = 1; i <= s1.length; i += 1) {
          const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
          track[j][i] = Math.min(
             track[j][i - 1] + 1, // deletion
             track[j - 1][i] + 1, // insertion
             track[j - 1][i - 1] + indicator, // substitution
          );
       }
    }
    return track[s2.length][s1.length];
};

/**
 * Parses a date string in DD-MM-YYYY format into a Date object.
 * @param dateStr The date string to parse.
 * @returns A Date object or null if parsing fails.
 */
export const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    // Handles DD-MM-YYYY, DD/MM/YYYY
    const parts = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!parts) return null;
    // parts[1] is day, parts[2] is month, parts[3] is year
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // JS months are 0-indexed
    const year = parseInt(parts[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    // Basic validation: check if the date object reflects the input
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
        return date;
    }
    return null;
};


/**
 * A simple CSV parser that handles potential quotes and removes them.
 */
const simpleCsvParse = (text: string): string[][] => {
    return text
        .split('\n')
        .filter(row => row.trim() !== '')
        .map(row => row.split(',').map(field => field.trim().replace(/^"|"$/g, '')));
};

/**
 * A flexible CSV parser that intelligently maps columns and extracts invoice data.
 */
const parseSimpleCsvAsInvoices = (rows: string[][]): InvoiceData[] => {
    if (rows.length < 1) return [];

    const headers = rows.shift()!.map(h => h.trim().toLowerCase());
    
    const findHeaderIndex = (possibleNames: string[]): number => {
        for (const name of possibleNames) {
            const index = headers.findIndex(h => h.includes(name));
            if (index !== -1) return index;
        }
        return -1;
    };
    
    const nameIdx = findHeaderIndex(['supplier name', 'particulars', 'trade/legal name']);
    const gstinIdx = findHeaderIndex(['gstin']);
    const docNoIdx = findHeaderIndex(['doc no', 'invoice number', 'supplier invoice no']);
    const dateIdx = findHeaderIndex(['date', 'invoice date', 'supplier invoice date']);
    const docTypeIdx = findHeaderIndex(['doc type', 'invoice type', 'voucher type']);
    const supplyTypeIdx = findHeaderIndex(['supply type']);
    const rcmIdx = findHeaderIndex(['reverse charge', 'rcm']);
    
    if (nameIdx === -1 || docNoIdx === -1 || dateIdx === -1) {
        throw new Error('CSV file must contain columns for Supplier Name/Particulars, Invoice Number, and Date.');
    }
    
    // Auto-detect tax and taxable columns
    const taxableCols = headers.map((h, i) => (h.includes('taxable') || h.includes('purchase')) ? i : -1).filter(i => i !== -1);
    const igstCols = headers.map((h, i) => h.includes('igst') ? i : -1).filter(i => i !== -1);
    const cgstCols = headers.map((h, i) => h.includes('cgst') ? i : -1).filter(i => i !== -1);
    const sgstCols = headers.map((h, i) => h.includes('sgst') ? i : -1).filter(i => i !== -1);
    const cessCols = headers.map((h, i) => h.includes('cess') ? i : -1).filter(i => i !== -1);
    
    const parseAndSum = (row: string[], indices: number[]): number => {
        return indices.reduce((sum, idx) => {
            if (idx >= row.length) return sum;
            const val = parseFloat(row[idx]?.replace(/[^\d.-]/g, '')) || 0;
            return sum + val;
        }, 0);
    };
    
    return rows.map((row): InvoiceData | null => {
        if (row.length === 0 || row.every(field => field === '')) return null;
        
        const taxableValue = parseAndSum(row, taxableCols);
        const igst = parseAndSum(row, igstCols);
        const cgst = parseAndSum(row, cgstCols);
        const sgst = parseAndSum(row, sgstCols);
        const cess = parseAndSum(row, cessCols);
        const docNo = row[docNoIdx] || '';
        const rcmFlag = rcmIdx > -1 ? (row[rcmIdx]?.trim().toUpperCase() === 'Y' || row[rcmIdx]?.trim().toUpperCase() === 'YES') : false;

        
        // Skip footer/summary rows which might have totals but no doc number
        if (!docNo) {
            return null;
        }

        return {
            supplierName: row[nameIdx] || '',
            supplierGstin: gstinIdx !== -1 ? row[gstinIdx] : '',
            docType: docTypeIdx !== -1 ? row[docTypeIdx] : 'INV',
            docNo: docNo,
            docDate: row[dateIdx] || '',
            supplyType: supplyTypeIdx !== -1 ? row[supplyTypeIdx] : 'B2B',
            taxableValue,
            igst,
            cgst,
            sgst,
            cess,
            totalTax: igst + cgst + sgst + cess,
            rcm: rcmFlag ? 'Y' : 'N',
        };
    }).filter((inv): inv is InvoiceData => inv !== null);
};

export const parseBooksFile = async (file: File): Promise<InvoiceData[]> => {
    const text = await file.text();
    const rows = simpleCsvParse(text);
    return parseSimpleCsvAsInvoices(rows);
};

export const parseGstr2bCsvFile = async (file: File): Promise<InvoiceData[]> => {
    const text = await file.text();
    const rows = simpleCsvParse(text);
    return parseSimpleCsvAsInvoices(rows);
};

export const parseGstr2bJson = async (file: File): Promise<InvoiceData[]> => {
    const text = await file.text();
    const jsonData = JSON.parse(text);
    const invoices: InvoiceData[] = [];

    const data = jsonData.data || jsonData;
    const docData = data.docdata || data;

    const processInvoices = (supplierList: any[], section: string) => {
        if (!supplierList) return;

        supplierList.forEach((supplier: any) => {
            const records = section.toLowerCase().startsWith('b2b') ? supplier?.inv : supplier?.nt;
            if (!records) return;

            records.forEach((inv: any) => {
                const taxableValue = inv.txval ?? 0;
                const igst = inv.igst ?? 0;
                const cgst = inv.cgst ?? 0;
                const sgst = inv.sgst ?? 0;
                const cess = inv.cess ?? 0;
                
                const docNo = inv.inum || inv.ntnum;
                const docDate = inv.dt;
                
                if (docNo && docDate) {
                    const rcmFlag = inv.rev === 'Y';
                    let docType = 'INV'; // Default for B2B/B2BA
                    
                    if (section.toUpperCase().includes('CDN')) {
                        docType = inv.typ === 'C' ? 'CRN' : 'DBN';
                    }

                    // Create a more descriptive docType
                    let derivedDocType = `${docType}-${section.toUpperCase()}`;
                    if (rcmFlag && !section.toUpperCase().includes('CDN')) {
                        derivedDocType = 'INV-RCM';
                    }

                    invoices.push({
                        supplierName: supplier.trdnm || supplier.ctin || '',
                        supplierGstin: supplier.ctin || '',
                        docType: derivedDocType, 
                        docNo,
                        docDate,
                        taxableValue, igst, cgst, sgst, cess,
                        totalTax: igst + cgst + sgst + cess,
                        supplyType: section.toUpperCase(), // Keep original section for potential future filtering
                        rcm: rcmFlag ? 'Y' : 'N',
                    });
                }
            });
        });
    };

    processInvoices(docData?.b2b, 'B2B');
    processInvoices(docData?.b2ba, 'B2BA');
    processInvoices(docData?.cdnr, 'CDNR');
    processInvoices(docData?.cdnra, 'CDNRA');

    return invoices;
};