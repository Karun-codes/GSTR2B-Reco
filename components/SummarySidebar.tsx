import React, { useMemo } from 'react';
import { ReconciliationResult, FilterState, MatchStatus, UnifiedInvoice } from '../types';
import { formatIndianInteger, formatIndianCurrency } from '../utils/formatters';
import SummaryCard from './SummaryCard';
import ItcSummaryTable from './ItcSummaryTable';

type FilterCategory = 'matchStatus' | 'sourcePresence';

interface SummaryPanelProps {
    result: ReconciliationResult;
    filters: FilterState;
    onFilterToggle: (category: FilterCategory, value: MatchStatus | 'inGstr2b' | 'inBooks') => void;
    allInvoices: UnifiedInvoice[];
    includeRcmInItc: boolean;
    setIncludeRcmInItc: (value: boolean) => void;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ result, filters, onFilterToggle, allInvoices, includeRcmInItc, setIncludeRcmInItc }) => {
    const { summary } = result;

    const dynamicCounts = useMemo(() => {
        const counts = {
            exactMatches: 0,
            partialProbableMatches: 0,
            unmatched: 0,
            ineligible: 0,
            carriedForward: 0,
            totalGstr2b: 0,
            totalBooks: 0,
        };

        const filterAndCount = (invoices: UnifiedInvoice[], categoryToIgnore: FilterCategory) => {
             const filtered = invoices.filter(inv => {
                const statusMatch = categoryToIgnore === 'matchStatus' || filters.matchStatus.size === 0 || (inv.matchStatus && filters.matchStatus.has(inv.matchStatus));
                const sourceMatch = categoryToIgnore === 'sourcePresence' || filters.sourcePresence.size === 0 || Array.from(filters.sourcePresence).every(key => inv[key]);
                return statusMatch && sourceMatch;
            });
            
             const isStatusCountableForUnmatched = (status: MatchStatus | null): boolean => 
                status !== 'Exact Match' && 
                status !== 'Partial Match' && 
                status !== 'Probable Match' && 
                status !== 'Ineligible ITC' && 
                status !== 'Carried Forward';

            return {
                exactMatches: filtered.filter(inv => inv.matchStatus === 'Exact Match').length,
                partialProbableMatches: filtered.filter(inv => inv.matchStatus === 'Partial Match' || inv.matchStatus === 'Probable Match').length,
                unmatched: filtered.filter(inv => isStatusCountableForUnmatched(inv.matchStatus)).length,
                ineligible: filtered.filter(inv => inv.matchStatus === 'Ineligible ITC').length,
                carriedForward: filtered.filter(inv => inv.matchStatus === 'Carried Forward').length,
                totalGstr2b: filtered.filter(inv => inv.inGstr2b).length,
                totalBooks: filtered.filter(inv => inv.inBooks).length,
            };
        };
        
        counts.exactMatches = filterAndCount(allInvoices, 'matchStatus').exactMatches;
        counts.partialProbableMatches = filterAndCount(allInvoices, 'matchStatus').partialProbableMatches;
        counts.unmatched = filterAndCount(allInvoices, 'matchStatus').unmatched;
        counts.ineligible = filterAndCount(allInvoices, 'matchStatus').ineligible;
        counts.carriedForward = filterAndCount(allInvoices, 'matchStatus').carriedForward;
        
        counts.totalGstr2b = filterAndCount(allInvoices, 'sourcePresence').totalGstr2b;
        counts.totalBooks = filterAndCount(allInvoices, 'sourcePresence').totalBooks;

        return counts;

    }, [allInvoices, filters]);

    const isPartialProbableActive = useMemo(() => {
        const group: MatchStatus[] = ['Partial Match', 'Probable Match'];
        return group.some(s => filters.matchStatus.has(s));
    }, [filters.matchStatus]);

    const isUnmatchedActive = useMemo(() => {
        const group: MatchStatus[] = ['Unmatched', 'Only in GSTR-2B', 'Only in Books'];
        return group.some(s => filters.matchStatus.has(s));
    }, [filters.matchStatus]);


    return (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-6">
            <div>
                 <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-slate-700">Reconciliation Dashboard</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                    <button onClick={() => onFilterToggle('matchStatus', 'Exact Match')}><SummaryCard title="Exact Match" value={formatIndianInteger(dynamicCounts.exactMatches)} subValue={`₹ ${formatIndianCurrency(summary.exactMatchAmount)}`} color="green" isActive={filters.matchStatus.has('Exact Match')} /></button>
                    <button onClick={() => onFilterToggle('matchStatus', 'Partial Match')}><SummaryCard title="Partial/Probable" value={formatIndianInteger(dynamicCounts.partialProbableMatches)} subValue={`₹ ${formatIndianCurrency(summary.partialProbableMatchAmount)}`} color="yellow" isActive={isPartialProbableActive} /></button>
                    <button onClick={() => onFilterToggle('matchStatus', 'Unmatched')}><SummaryCard title="Unmatched" value={formatIndianInteger(dynamicCounts.unmatched)} subValue={`₹ ${formatIndianCurrency(summary.unmatchedAmount)}`} color="red" isActive={isUnmatchedActive} /></button>
                    <button onClick={() => onFilterToggle('matchStatus', 'Ineligible ITC')}>
                        <SummaryCard 
                            title="Ineligible ITC" 
                            value={formatIndianInteger(dynamicCounts.ineligible)} 
                            subValue={`₹ ${formatIndianCurrency(summary.ineligibleAmount)}`} 
                            isActive={filters.matchStatus.has('Ineligible ITC')} 
                        />
                    </button>
                     <button onClick={() => onFilterToggle('matchStatus', 'Carried Forward')}>
                        <SummaryCard 
                            title="Carried Forward" 
                            value={formatIndianInteger(dynamicCounts.carriedForward)} 
                            subValue={`₹ ${formatIndianCurrency(summary.carriedForwardAmount)}`} 
                            color="purple"
                            isActive={filters.matchStatus.has('Carried Forward')} 
                        />
                    </button>
                    <button onClick={() => onFilterToggle('sourcePresence', 'inGstr2b')}><SummaryCard title="GSTR-2B Docs" value={formatIndianInteger(dynamicCounts.totalGstr2b)} color="blue" isActive={filters.sourcePresence.has('inGstr2b')}/></button>
                    <button onClick={() => onFilterToggle('sourcePresence', 'inBooks')}><SummaryCard title="Books Docs" value={formatIndianInteger(dynamicCounts.totalBooks)} isActive={filters.sourcePresence.has('inBooks')} /></button>
                </div>
            </div>
             <div>
                <div className="flex justify-between items-center mb-3">
                     <h3 className="font-semibold text-slate-700">Input Tax Credit (ITC) Summary</h3>
                      <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="rcm-toggle"
                            checked={includeRcmInItc}
                            onChange={(e) => setIncludeRcmInItc(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="rcm-toggle" className="text-sm font-medium text-slate-600">
                            Include RCM in Eligible ITC
                        </label>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <ItcSummaryTable summary={summary} />
                </div>
            </div>
        </div>
    );
};

export default SummaryPanel;