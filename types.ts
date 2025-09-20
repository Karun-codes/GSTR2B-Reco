





export type Source = 'GSTR2B' | 'Books';

export type WorkflowStep = 'IMPORT_GOV' | 'PREVIEW_GOV' | 'IMPORT_BOOKS' | 'PREVIEW_BOOKS' | 'RESULTS';

export type PreviewTab = 'gstr2b' | 'books';

export type MatchStatus =
    | 'Exact Match'
    | 'Partial Match'
    | 'Probable Match'
    | 'Unmatched'
    | 'Only in GSTR-2B'
    | 'Only in Books'
    | 'Ineligible ITC'
    | 'Carried Forward';

export type MatchBasis = 'GSTIN' | 'Name' | 'N/A';

export type SortConfig = { key: keyof UnifiedInvoice; direction: 'ascending' | 'descending' } | null;

export type CustomMatchKeys = 'supplierGstin' | 'docNo' | 'docDate' | 'taxableValue' | 'totalTax' | 'docType' | 'taxHeads';

export type CustomMatchConfig = {
    criteria: Set<CustomMatchKeys>;
    tolerances: {
        taxableValue: number;
        totalTax: number;
    };
};

export interface FilterState {
    matchStatus: Set<MatchStatus>;
    supplyType: Set<string>;
    sourcePresence: Set<'inGstr2b' | 'inBooks'>;
}

export interface ProbableSupplierMatch {
    booksSupplierName: string; // This will be the normalized name
    gstr2bSupplier: {
        name: string; // Original name for display
        gstin: string;
    };
    distance: number;
}

export interface Period {
    month: number; // 1-12
    year: number;
}


export interface UnifiedInvoice {
    // Core Fields from source files
    id: string; // Unique key, e.g., GSTIN-DocNo or Name-DocNo
    supplierName: string;
    supplierGstin: string;
    docType: string;
    docNo: string;
    docDate: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    totalTax: number;
    supplyType: string;
    rcm: 'Y' | 'N';

    // Source data references
    // Fix: Changed Partial<InvoiceData> to InvoiceData to reflect that if gstr2bData or booksData exist, they are complete objects.
    gstr2bData?: InvoiceData;
    booksData?: InvoiceData;

    // Source Flags
    inGstr2b: boolean;
    inBooks: boolean;

    // Reco Fields
    matchStatus: MatchStatus | null;
    matchBasis: MatchBasis;
    mismatchReasons: string[];
    remarks: string;
    isManualMatch?: boolean;
    carriedForwardFromPeriod?: string;


    // Tracking Fields
    returnPeriod: string; // YYYYMM format
    carriedForwardAge: number; // in months
}

// Represents the raw data from a single source for a unified invoice
export interface InvoiceData {
    supplierName: string;
    supplierGstin: string;
    docType: string;
    docNo: string;
    docDate: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
    totalTax: number;
    supplyType: string;
    rcm?: 'Y' | 'N';
    carriedForwardFromPeriod?: string;
}


export interface ReconciliationResult {
    summary: {
        totalGstr2b: number;
        totalBooks: number;
        exactMatches: number;
        partialProbableMatches: number;
        unmatched: number;
        ineligible: number;
        carriedForward: number;
        
        exactMatchAmount: number;
        partialProbableMatchAmount: number;
        unmatchedAmount: number;
        ineligibleAmount: number;
        carriedForwardAmount: number;
        
        // Detailed ITC Breakdown
        itcAsPerGstr2bTotal: number;
        itcNotInBooksAmount: number; // Deduction
        itcFromBooksOnlyAmount: number; // Addition/Reconciling item
        netItcAsPerBooks: number;
        finalEligibleItc: number;

        itcAsPerGstr2b: {
            igst: number;
            cgst: number;
            sgst: number;
            cess: number;
            total: number;
        };
        itcAsPerBooks: {
            igst: number;
            cgst: number;
            sgst: number;
            cess: number;
            total: number;
        };
        eligibleItc: {
            igst: number;
            cgst: number;
            sgst: number;
            cess: number;
            total: number;
        };
    };
    allInvoices: UnifiedInvoice[];
    dataBySource: {
        gstr2b: UnifiedInvoice[];
        books: UnifiedInvoice[];
    };
    probableSupplierMatches: ProbableSupplierMatch[];
}

// Kept for legacy file parsing signatures, but will be mapped to UnifiedInvoice.
export interface Invoice {
    id: string;
    supplierGstin: string;
    invoiceNumber: string;
    invoiceDate: string;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    totalTax: number;
    source: 'GSTR2B' | 'Tally';
}
