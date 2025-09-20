import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ReconciliationResult, UnifiedInvoice, SortConfig, FilterState, MatchStatus, ProbableSupplierMatch } from '../types';
import SummaryPanel from './SummarySidebar';
import InvoiceTable from './InvoiceTable';
import SupplierLinker from './SupplierLinker';

interface ResultsDashboardProps {
    result: ReconciliationResult;
    probableSupplierMatches: ProbableSupplierMatch[];
    onSupplierLinkConfirm: (match: ProbableSupplierMatch) => void;
    onSupplierLinkReject: (match: ProbableSupplierMatch) => void;
    onManualOverride: (invoiceId: string, newStatus: MatchStatus, newRemark: string) => void;
    onBulkOverride: (invoiceIds: Set<string>, newStatus: MatchStatus, newRemark: string) => void;
    onFindMatch: (invoice: UnifiedInvoice) => void;
    includeRcmInItc: boolean;
    setIncludeRcmInItc: (value: boolean) => void;
    onFilteredInvoicesChange: (invoices: UnifiedInvoice[]) => void;
}

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ result, probableSupplierMatches, onSupplierLinkConfirm, onSupplierLinkReject, onManualOverride, onBulkOverride, onFindMatch, includeRcmInItc, setIncludeRcmInItc, onFilteredInvoicesChange }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [bulkRemark, setBulkRemark] = useState<string>('');
    const [headerHeight, setHeaderHeight] = useState(0);
    const stickyHeaderRef = useRef<HTMLDivElement>(null);

    const [filters, setFilters] = useState<FilterState>({
        matchStatus: new Set(),
        supplyType: new Set(), // Retained for future use, not currently interactive
        sourcePresence: new Set(),
    });

    useEffect(() => {
        const headerElement = stickyHeaderRef.current;
        if (!headerElement) return;

        const resizeObserver = new ResizeObserver(() => {
            setHeaderHeight(headerElement.offsetHeight);
        });

        resizeObserver.observe(headerElement);
        setHeaderHeight(headerElement.offsetHeight); // Set initial height

        return () => resizeObserver.disconnect();
    }, [selectedInvoiceIds.size]); // Re-observe if bulk actions bar appears/disappears


    type FilterCategory = 'matchStatus' | 'sourcePresence';

    const handleFilterToggle = (category: FilterCategory, value: MatchStatus | 'inGstr2b' | 'inBooks') => {
        setFilters(prevFilters => {
            const newFilters = { ...prevFilters };
            const currentFilterSet = new Set(newFilters[category]);
    
            const UNMATCHED_GROUP: MatchStatus[] = ['Unmatched', 'Only in GSTR-2B', 'Only in Books'];
            const PARTIAL_PROBABLE_GROUP: MatchStatus[] = ['Partial Match', 'Probable Match'];
    
            const toggleGroup = (group: MatchStatus[]) => {
                const isGroupActive = group.some(s => currentFilterSet.has(s as never));
                if (isGroupActive) {
                    group.forEach(s => currentFilterSet.delete(s as never));
                } else {
                    group.forEach(s => currentFilterSet.add(s as never));
                }
            };
    
            if (category === 'matchStatus') {
                if (value === 'Unmatched') {
                    toggleGroup(UNMATCHED_GROUP);
                } else if (value === 'Partial Match') {
                    toggleGroup(PARTIAL_PROBABLE_GROUP);
                } else {
                    if (currentFilterSet.has(value as never)) {
                        currentFilterSet.delete(value as never);
                    } else {
                        currentFilterSet.add(value as never);
                    }
                }
            } else { // For sourcePresence
                if (currentFilterSet.has(value as never)) {
                    currentFilterSet.delete(value as never);
                } else {
                    currentFilterSet.add(value as never);
                }
            }
            
            newFilters[category] = currentFilterSet as any;
            return newFilters;
        });
    };

    const filteredAndSortedInvoices = useMemo(() => {
        let invoices: UnifiedInvoice[] = result.allInvoices;
        
        const lowerCaseQuery = searchQuery.toLowerCase().trim();

        const applyFilters = (inv: UnifiedInvoice) => {
            // Search filter
            if (lowerCaseQuery && 
                !inv.supplierName.toLowerCase().includes(lowerCaseQuery) &&
                !inv.supplierGstin.toLowerCase().includes(lowerCaseQuery)) {
                return false;
            }

            // Existing status/source filters
            const statusMatch = filters.matchStatus.size === 0 || (inv.matchStatus && filters.matchStatus.has(inv.matchStatus));
            const sourceMatch = filters.sourcePresence.size === 0 || Array.from(filters.sourcePresence).every(key => inv[key]);
            return statusMatch && sourceMatch;
        };

        const filtered = invoices.filter(applyFilters);

        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
                }
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'ascending' 
                        ? aValue.localeCompare(bValue) 
                        : bValue.localeCompare(aValue);
                }
                return 0;
            });
        }
        return filtered;
    }, [result.allInvoices, sortConfig, filters, searchQuery]);
    
    // Clear selection when filters/search changes to avoid acting on hidden invoices
    useEffect(() => {
        setSelectedInvoiceIds(new Set());
    }, [filteredAndSortedInvoices]);
    
    useEffect(() => {
        onFilteredInvoicesChange(filteredAndSortedInvoices);
    }, [filteredAndSortedInvoices, onFilteredInvoicesChange]);

     const handleSort = (key: keyof UnifiedInvoice) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectionChange = (invoiceId: string, isSelected: boolean) => {
        setSelectedInvoiceIds(prev => {
            const newSet = new Set(prev);
            if (isSelected) {
                newSet.add(invoiceId);
            } else {
                newSet.delete(invoiceId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (isSelected: boolean) => {
        if (isSelected) {
            setSelectedInvoiceIds(new Set(filteredAndSortedInvoices.map(inv => inv.id)));
        } else {
            setSelectedInvoiceIds(new Set());
        }
    };
    
    const handleBulkAction = (newStatus: MatchStatus) => {
        if (selectedInvoiceIds.size === 0) return;
        onBulkOverride(selectedInvoiceIds, newStatus, bulkRemark || `Bulk update to ${newStatus}`);
        setSelectedInvoiceIds(new Set()); // Clear selection after action
        setBulkRemark('');
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col flex-grow">
            {probableSupplierMatches.length > 0 && (
                 <SupplierLinker
                    matches={probableSupplierMatches}
                    onConfirm={onSupplierLinkConfirm}
                    onReject={onSupplierLinkReject}
                />
            )}
           
            <SummaryPanel 
                result={result} 
                filters={filters}
                onFilterToggle={handleFilterToggle}
                allInvoices={result.allInvoices}
                includeRcmInItc={includeRcmInItc}
                setIncludeRcmInItc={setIncludeRcmInItc}
            />

            <div className="mt-4 flex-grow flex flex-col min-h-0">
                <div className="flex-grow overflow-auto border border-slate-200 rounded-md">
                     <div ref={stickyHeaderRef} className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-200">
                        <div className="p-2">
                             <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by Supplier Name or GSTIN..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    aria-label="Search invoices"
                                />
                            </div>
                        </div>
                        
                        {selectedInvoiceIds.size > 0 && (
                            <div className="p-3 bg-blue-50 border-t border-blue-200 flex items-center justify-between gap-4">
                                <span className="font-semibold text-slate-700 text-sm">{selectedInvoiceIds.size} invoice(s) selected</span>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text"
                                        placeholder="Add bulk remark (optional)"
                                        value={bulkRemark}
                                        onChange={(e) => setBulkRemark(e.target.value)}
                                        className="p-1 border rounded-md text-sm w-48"
                                    />
                                    <button onClick={() => handleBulkAction('Exact Match')} className="px-3 py-1 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">
                                        Match
                                    </button>
                                    <button onClick={() => handleBulkAction('Unmatched')} className="px-3 py-1 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
                                        Unmatch
                                    </button>
                                     <button onClick={() => handleBulkAction('Ineligible ITC')} className="px-3 py-1 text-sm font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">
                                        Ineligible
                                    </button>
                                    <button onClick={() => handleBulkAction('Carried Forward')} className="px-3 py-1 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700">
                                        Carry Forward
                                    </button>
                                </div>
                                <button onClick={() => setSelectedInvoiceIds(new Set())} className="text-sm text-slate-500 hover:underline">
                                    Clear Selection
                                </button>
                            </div>
                        )}
                    </div>
                    {filteredAndSortedInvoices.length > 0 ? (
                        <InvoiceTable
                            invoices={filteredAndSortedInvoices}
                            type='reco'
                            sortConfig={sortConfig}
                            onSort={handleSort}
                            onManualOverride={onManualOverride}
                            onFindMatch={onFindMatch}
                            selectedInvoiceIds={selectedInvoiceIds}
                            onSelectionChange={handleSelectionChange}
                            onSelectAll={handleSelectAll}
                            headerTopOffset={headerHeight}
                        />
                    ) : (
                        <div className="text-center py-12 px-4"><p className="text-slate-500">No data to display. Try adjusting your search or filters.</p></div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResultsDashboard;
