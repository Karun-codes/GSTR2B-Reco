import React, { useMemo, useState } from 'react';
import { UnifiedInvoice } from '../types';
import { formatIndianCurrency } from '../utils/formatters';
import { levenshtein, normalizeDocNo, normalizeGstin, normalizeName, parseDate } from '../utils/parsers';

interface MatchFinderProps {
    sourceInvoice: UnifiedInvoice;
    allInvoices: UnifiedInvoice[];
    onClose: () => void;
    onConfirmMatch: (source: UnifiedInvoice, target: UnifiedInvoice) => void;
}

const MatchFinder: React.FC<MatchFinderProps> = ({ sourceInvoice, allInvoices, onClose, onConfirmMatch }) => {
    const isGstr2bSource = sourceInvoice.inGstr2b;

    const potentialMatches = useMemo(() => {
        const candidates = allInvoices.filter(inv => 
            isGstr2bSource ? inv.matchStatus === 'Only in Books' : inv.matchStatus === 'Only in GSTR-2B'
        );

        // Score and sort candidates
        return candidates.map(candidate => {
            const WEIGHTS = {
                GSTIN: 100,
                SUPPLIER_NAME: 40,
                DOC_NO: 60,
                DATE: 30,
                AMOUNT: 50,
            };
            let score = 0;
            
            // 1. GSTIN Match
            const normGstin1 = normalizeGstin(sourceInvoice.supplierGstin);
            const normGstin2 = normalizeGstin(candidate.supplierGstin);
            if (normGstin1 && normGstin1 === normGstin2) {
                score += WEIGHTS.GSTIN;
            }

            // 2. Supplier Name Similarity
            const normName1 = normalizeName(sourceInvoice.supplierName);
            const normName2 = normalizeName(candidate.supplierName);
            const nameDist = levenshtein(normName1, normName2);
            const nameMaxLen = Math.max(normName1.length, normName2.length);
            if (nameMaxLen > 0) {
                const nameSimilarity = (nameMaxLen - nameDist) / nameMaxLen;
                score += nameSimilarity * WEIGHTS.SUPPLIER_NAME;
            }

            // 3. Document Number Similarity
            const normDoc1 = normalizeDocNo(sourceInvoice.docNo);
            const normDoc2 = normalizeDocNo(candidate.docNo);
            const docDist = levenshtein(normDoc1, normDoc2);
            const docMaxLen = Math.max(normDoc1.length, normDoc2.length);
            const docNoSimilarity = (docMaxLen > 0) ? (docMaxLen - docDist) / docMaxLen : 0;
            score += docNoSimilarity * WEIGHTS.DOC_NO;

            // 4. Date Proximity
            const date1 = parseDate(sourceInvoice.docDate);
            const date2 = parseDate(candidate.docDate);
            let dateDiffDays: number | null = null;
            if (date1 && date2) {
                dateDiffDays = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 3600 * 24);
                if (dateDiffDays <= 3) score += WEIGHTS.DATE;
                else if (dateDiffDays <= 15) score += WEIGHTS.DATE * 0.5;
                // Penalize for large date differences, capped at 90 days
                score -= Math.min(dateDiffDays / 3, 30);
            }

            // 5. Amount Proximity
            const amountDiff = Math.abs(sourceInvoice.totalTax - candidate.totalTax);
            const baseAmount = Math.max(sourceInvoice.totalTax, 1); // Avoid division by zero
            const amountProximity = Math.max(0, 1 - (amountDiff / baseAmount)); // 1 for perfect match, 0 for 100% diff or more
            score += amountProximity * WEIGHTS.AMOUNT;

            return { ...candidate, score, amountDiff, docNoSimilarity, dateDiffDays };
        }).sort((a, b) => b.score - a.score);

    }, [sourceInvoice, allInvoices, isGstr2bSource]);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">Match Finder Assistant</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
                </header>
                
                <div className="p-4 bg-slate-50 border-b">
                    <h3 className="font-semibold text-slate-700 mb-2">Invoice to Match:</h3>
                    <div className="grid grid-cols-5 gap-4 text-sm">
                        <div><strong>Supplier:</strong> {sourceInvoice.supplierName}</div>
                        <div><strong>GSTIN:</strong> {sourceInvoice.supplierGstin || 'N/A'}</div>
                        <div><strong>Doc No:</strong> {sourceInvoice.docNo}</div>
                        <div><strong>Date:</strong> {sourceInvoice.docDate}</div>
                        <div className="text-right"><strong>Total Tax:</strong> {formatIndianCurrency(sourceInvoice.totalTax)}</div>
                    </div>
                </div>

                <div className="flex-grow p-4 overflow-auto">
                    <h3 className="font-semibold text-slate-700 mb-2">Potential Matches ({potentialMatches.length} found):</h3>
                    {potentialMatches.length > 0 ? (
                        <ul className="space-y-2">
                            {potentialMatches.map(match => (
                                <li key={match.id} className="p-3 border rounded-md grid grid-cols-6 gap-4 items-center hover:bg-blue-50 transition-colors duration-150">
                                    <div className="col-span-2">
                                        <p className="font-semibold text-slate-800">{match.supplierName}</p>
                                        <p className="text-xs text-slate-500">{match.supplierGstin || 'No GSTIN'}</p>
                                    </div>
                                    <div>
                                        <p>{match.docNo}</p>
                                        {typeof match.docNoSimilarity === 'number' &&
                                            <p className={`text-xs font-medium ${match.docNoSimilarity > 0.8 ? 'text-green-600' : 'text-blue-600'}`}>
                                                Match: {(match.docNoSimilarity * 100).toFixed(0)}%
                                            </p>
                                        }
                                    </div>
                                    <div>
                                        <p>{match.docDate}</p>
                                        {match.dateDiffDays !== null && (
                                            <p className={`text-xs font-medium ${match.dateDiffDays <= 7 ? 'text-green-600' : 'text-orange-500'}`}>
                                                {match.dateDiffDays} day diff
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{formatIndianCurrency(match.totalTax)}</p>
                                        <p className={`text-xs font-medium ${match.amountDiff <= 10 ? 'text-green-600' : 'text-orange-500'}`}>
                                            Diff: {formatIndianCurrency(match.amountDiff)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <button 
                                            onClick={() => onConfirmMatch(sourceInvoice, match)}
                                            className="px-3 py-1 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
                                        >
                                            Link
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-10 text-slate-500">
                            No potential matches found in the other source.
                        </div>
                    )}
                </div>

                <footer className="p-4 border-t text-right bg-slate-50">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300"
                    >
                        Cancel
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default MatchFinder;