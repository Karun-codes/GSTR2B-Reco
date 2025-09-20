

import { UnifiedInvoice, ReconciliationResult, InvoiceData, MatchStatus, MatchBasis, CustomMatchConfig, ProbableSupplierMatch } from '../types';
import { normalizeDocNo, normalizeGstin, normalizeName, levenshtein } from '../utils/parsers';

const DEFAULT_TOLERANCES = { taxableValue: 10.00, totalTax: 10.00 };

const getInvoiceKey = (inv: InvoiceData, by: 'GSTIN' | 'Name'): string | null => {
    const docNo = normalizeDocNo(inv.docNo);
    if (!docNo) return null;

    if (by === 'GSTIN') {
        const gstin = normalizeGstin(inv.supplierGstin);
        return gstin ? `${gstin}-${docNo}` : null;
    } else { // by 'Name'
        const name = normalizeName(inv.supplierName);
        return name ? `${name}-${docNo}` : null;
    }
};

export const calculateSummary = (
    allInvoices: UnifiedInvoice[],
    initialCounts: { totalGstr2b: number; totalBooks: number; },
    gstr2bData: InvoiceData[],
    booksData: InvoiceData[],
    includeRcmInItc: boolean
): ReconciliationResult['summary'] => {

    const calculateTotalTax = (data: InvoiceData[]) => {
        return data.reduce((acc, inv) => {
            acc.igst += inv.igst;
            acc.cgst += inv.cgst;
            acc.sgst += inv.sgst;
            acc.cess += inv.cess;
            acc.total += inv.totalTax;
            return acc;
        }, { igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 });
    };

    const itcAsPerGstr2b = calculateTotalTax(gstr2bData);
    const itcAsPerBooks = calculateTotalTax(booksData);

    let exactMatchAmount = 0;
    let partialProbableMatchAmount = 0;
    let unmatchedAmount = 0;
    let ineligibleAmount = 0;
    let carriedForwardAmount = 0;
    let itcNotInBooksAmount = 0;
    let itcFromBooksOnlyAmount = 0;
    const eligibleItc = { igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 };

    allInvoices.forEach(inv => {
        const taxSource = inv.gstr2bData || inv.booksData || inv;

        switch (inv.matchStatus) {
            case 'Exact Match':
                exactMatchAmount += taxSource.totalTax;
                break;
            case 'Partial Match':
            case 'Probable Match':
                partialProbableMatchAmount += taxSource.totalTax;
                break;
            case 'Ineligible ITC':
                ineligibleAmount += taxSource.totalTax;
                break;
            case 'Carried Forward':
                carriedForwardAmount += taxSource.totalTax;
                break;
            case 'Only in GSTR-2B':
                itcNotInBooksAmount += taxSource.totalTax;
                unmatchedAmount += taxSource.totalTax;
                break;
            case 'Only in Books':
                itcFromBooksOnlyAmount += taxSource.totalTax;
                unmatchedAmount += taxSource.totalTax;
                break;
            default: // Unmatched
                unmatchedAmount += taxSource.totalTax;
                break;
        }

        const isMatched = inv.matchStatus === 'Exact Match' || inv.matchStatus === 'Partial Match' || inv.matchStatus === 'Probable Match';
        const canClaim = includeRcmInItc || inv.rcm !== 'Y';

        if (inv.inGstr2b && isMatched && canClaim) {
            const itcSource = inv.gstr2bData!;
            eligibleItc.igst += itcSource.igst;
            eligibleItc.cgst += itcSource.cgst;
            eligibleItc.sgst += itcSource.sgst;
            eligibleItc.cess += itcSource.cess;
        }
    });
    eligibleItc.total = eligibleItc.igst + eligibleItc.cgst + eligibleItc.sgst + eligibleItc.cess;

    const finalEligibleItc = itcAsPerGstr2b.total - itcNotInBooksAmount - ineligibleAmount;

    const isStatusCountableForUnmatched = (status: MatchStatus | null): boolean => 
        status !== 'Exact Match' && 
        status !== 'Partial Match' && 
        status !== 'Probable Match' && 
        status !== 'Ineligible ITC' && 
        status !== 'Carried Forward';

    return {
        ...initialCounts,
        exactMatches: allInvoices.filter(inv => inv.matchStatus === 'Exact Match').length,
        partialProbableMatches: allInvoices.filter(inv => inv.matchStatus === 'Partial Match' || inv.matchStatus === 'Probable Match').length,
        unmatched: allInvoices.filter(inv => isStatusCountableForUnmatched(inv.matchStatus)).length,
        ineligible: allInvoices.filter(inv => inv.matchStatus === 'Ineligible ITC').length,
        carriedForward: allInvoices.filter(inv => inv.matchStatus === 'Carried Forward').length,
        exactMatchAmount,
        partialProbableMatchAmount,
        unmatchedAmount,
        ineligibleAmount,
        carriedForwardAmount,
        itcAsPerGstr2bTotal: itcAsPerGstr2b.total,
        itcNotInBooksAmount,
        itcFromBooksOnlyAmount,
        netItcAsPerBooks: itcAsPerBooks.total,
        finalEligibleItc: finalEligibleItc > 0 ? finalEligibleItc : 0,
        itcAsPerGstr2b,
        itcAsPerBooks,
        eligibleItc
    };
};

export const scoreAndFinalizeMatch = (invoice: UnifiedInvoice, customConfig: CustomMatchConfig): UnifiedInvoice => {
    const { gstr2bData, booksData } = invoice;
    const { criteria, tolerances } = customConfig;

    if (!gstr2bData || !booksData) {
        // This case should ideally not be passed to this function
        invoice.matchStatus = invoice.inGstr2b ? 'Only in GSTR-2B' : 'Only in Books';
        return invoice;
    }

    let score = 0;
    const mismatchReasons: string[] = [];

    if (criteria.has('supplierGstin')) score++;
    if (criteria.has('docType') && gstr2bData.docType.toUpperCase().startsWith(booksData.docType.toUpperCase())) score++; else if(criteria.has('docType')) mismatchReasons.push("Doc Type Mismatch");
    if (criteria.has('docNo')) score++;
    if (criteria.has('docDate') && gstr2bData.docDate === booksData.docDate) score++; else if(criteria.has('docDate')) mismatchReasons.push("Date Mismatch");
    if (criteria.has('taxableValue') && Math.abs(gstr2bData.taxableValue - booksData.taxableValue) <= tolerances.taxableValue) score++; else if(criteria.has('taxableValue')) mismatchReasons.push(`Taxable Val Mismatch (Diff: ${Math.abs(gstr2bData.taxableValue - booksData.taxableValue).toFixed(2)})`);
    if (criteria.has('totalTax') && Math.abs(gstr2bData.totalTax - booksData.totalTax) <= tolerances.totalTax) score++; else if(criteria.has('totalTax')) mismatchReasons.push(`Total Tax Mismatch (Diff: ${Math.abs(gstr2bData.totalTax - booksData.totalTax).toFixed(2)})`);
    if (criteria.has('taxHeads')) {
        const taxMatch = Math.abs(gstr2bData.igst - booksData.igst) <= tolerances.totalTax && Math.abs(gstr2bData.cgst - booksData.cgst) <= tolerances.totalTax && Math.abs(gstr2bData.sgst - booksData.sgst) <= tolerances.totalTax;
        if (taxMatch) score++; else mismatchReasons.push("Tax Head Mismatch");
    }
    
    invoice.mismatchReasons = mismatchReasons;
    if (criteria.size > 0) {
        if (score === criteria.size) invoice.matchStatus = 'Exact Match';
        else if (score >= criteria.size - 2) invoice.matchStatus = 'Partial Match';
        else invoice.matchStatus = 'Unmatched';
    } else {
         invoice.matchStatus = 'Unmatched';
    }
    return invoice;
};


export const reconcileInvoices = (
    gstr2bData: InvoiceData[],
    booksData: InvoiceData[],
    customConfig?: CustomMatchConfig
): ReconciliationResult => {
    const FUZZY_MATCH_THRESHOLD = 3;
    const masterMap = new Map<string, UnifiedInvoice>();

    // Pass 1: Exact matching on GSTIN + DocNo
    const gstr2bMapByGstin = new Map<string, InvoiceData>();
    gstr2bData.forEach(inv => {
        const key = getInvoiceKey(inv, 'GSTIN');
        if (key) gstr2bMapByGstin.set(key, inv);
    });

    const booksUnmatched: InvoiceData[] = [];
    booksData.forEach(bookInv => {
        const key = getInvoiceKey(bookInv, 'GSTIN');
        const gstr2bInv = key ? gstr2bMapByGstin.get(key) : undefined;
        if (gstr2bInv) {
            masterMap.set(key!, {
                id: key!,
                supplierName: gstr2bInv.supplierName, supplierGstin: gstr2bInv.supplierGstin,
                docType: gstr2bInv.docType, docNo: gstr2bInv.docNo, docDate: gstr2bInv.docDate,
                taxableValue: gstr2bInv.taxableValue, igst: gstr2bInv.igst, cgst: gstr2bInv.cgst, sgst: gstr2bInv.sgst, cess: gstr2bInv.cess, totalTax: gstr2bInv.totalTax,
                supplyType: gstr2bInv.supplyType, rcm: gstr2bInv.rcm || 'N',
                inGstr2b: true, inBooks: true, gstr2bData: gstr2bInv, booksData: bookInv,
                matchStatus: null, matchBasis: 'GSTIN', mismatchReasons: [], 
                remarks: gstr2bInv.carriedForwardFromPeriod ? `Carried forward from ${gstr2bInv.carriedForwardFromPeriod}` : '',
                carriedForwardFromPeriod: gstr2bInv.carriedForwardFromPeriod,
                returnPeriod: '', carriedForwardAge: 0,
            });
            gstr2bMapByGstin.delete(key!);
        } else {
            booksUnmatched.push(bookInv);
        }
    });

    const gstr2bUnmatched = Array.from(gstr2bMapByGstin.values());

    // Pass 2: Probable Supplier Matching (New) - does not match, only suggests
    const probableSupplierMatches: ProbableSupplierMatch[] = [];
    const uniqueGstr2bSuppliers = new Map<string, { name: string; gstin: string }>();
    gstr2bUnmatched.forEach(inv => {
        const normName = normalizeName(inv.supplierName);
        if (normName && inv.supplierGstin && !uniqueGstr2bSuppliers.has(normName)) {
            uniqueGstr2bSuppliers.set(normName, { name: inv.supplierName, gstin: inv.supplierGstin });
        }
    });

    const uniqueBooksSuppliers = new Map<string, string>(); // Map normalized name to original name
    booksUnmatched.forEach(inv => {
        if (!inv.supplierGstin) { // Only look for matches for book entries without a GSTIN
            const normName = normalizeName(inv.supplierName);
            if (normName && !uniqueBooksSuppliers.has(normName)) {
                uniqueBooksSuppliers.set(normName, inv.supplierName);
            }
        }
    });

    uniqueBooksSuppliers.forEach((originalBookName, bookNormName) => {
        let bestMatch: { name: string; gstin: string } | null = null;
        let minDistance = Infinity;

        uniqueGstr2bSuppliers.forEach((gstrSupplier, gstrNormName) => {
            const distance = levenshtein(bookNormName, gstrNormName);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = gstrSupplier;
            }
        });

        if (bestMatch && minDistance <= FUZZY_MATCH_THRESHOLD) {
            probableSupplierMatches.push({
                booksSupplierName: bookNormName,
                gstr2bSupplier: bestMatch,
                distance: minDistance,
            });
        }
    });
    
    // Pass 3: Create 'Only in...' entries for all remaining unmatched invoices
    booksUnmatched.forEach(bookInv => {
        const bookDocNo = normalizeDocNo(bookInv.docNo);
        const key = getInvoiceKey(bookInv, 'Name') || `${normalizeName(bookInv.supplierName)}-${bookDocNo}-books`;
        if(!masterMap.has(key)) {
             masterMap.set(key, { ...bookInv, id: key, inGstr2b: false, inBooks: true, booksData: bookInv, matchStatus: 'Only in Books', matchBasis: 'N/A', mismatchReasons: [], remarks: bookInv.carriedForwardFromPeriod ? `Carried forward from ${bookInv.carriedForwardFromPeriod}` : '', returnPeriod: '', carriedForwardAge: 0, rcm: bookInv.rcm ?? 'N', carriedForwardFromPeriod: bookInv.carriedForwardFromPeriod });
        }
    });

    gstr2bUnmatched.forEach(gstrInv => {
        const key = getInvoiceKey(gstrInv, 'GSTIN')!;
         if(!masterMap.has(key)) {
            masterMap.set(key, { ...gstrInv, id: key, inGstr2b: true, inBooks: false, gstr2bData: gstrInv, matchStatus: 'Only in GSTR-2B', matchBasis: 'N/A', mismatchReasons: [], remarks: gstrInv.carriedForwardFromPeriod ? `Carried forward from ${gstrInv.carriedForwardFromPeriod}` : '', returnPeriod: '', carriedForwardAge: 0, rcm: gstrInv.rcm ?? 'N', carriedForwardFromPeriod: gstrInv.carriedForwardFromPeriod });
        }
    });

    // Pass 4: Detailed scoring for GSTIN-matched invoices
    const effectiveCustomConfig: CustomMatchConfig = {
        criteria: customConfig?.criteria ?? new Set(['supplierGstin', 'docType', 'docNo', 'docDate', 'taxableValue', 'totalTax', 'taxHeads']),
        tolerances: customConfig?.tolerances ?? DEFAULT_TOLERANCES
    };
    masterMap.forEach(invoice => {
        if (invoice.matchBasis === 'GSTIN' && invoice.matchStatus === null) {
            scoreAndFinalizeMatch(invoice, effectiveCustomConfig);
        }
    });

    const allInvoices = Array.from(masterMap.values());
    const summary = calculateSummary(allInvoices, { totalGstr2b: gstr2bData.length, totalBooks: booksData.length }, gstr2bData, booksData, true);
    
    return {
        summary, allInvoices,
        dataBySource: { gstr2b: allInvoices.filter(i => i.inGstr2b), books: allInvoices.filter(i => i.inBooks) },
        probableSupplierMatches
    };
};