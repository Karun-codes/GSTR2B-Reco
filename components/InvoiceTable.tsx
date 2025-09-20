import React, { useState, useEffect, useRef } from 'react';
import { UnifiedInvoice, SortConfig, MatchStatus } from '../types';
import { formatIndianCurrency } from '../utils/formatters';

type InvoiceTableProps = {
    invoices: UnifiedInvoice[];
    type: 'reco' | 'source';
    sortConfig: SortConfig;
    onSort: (key: keyof UnifiedInvoice) => void;
    onManualOverride?: (invoiceId: string, newStatus: MatchStatus, newRemark: string) => void;
    onFindMatch?: (invoice: UnifiedInvoice) => void;
    selectedInvoiceIds?: Set<string>;
    onSelectionChange?: (invoiceId: string, isSelected: boolean) => void;
    onSelectAll?: (isSelected: boolean) => void;
    headerTopOffset: number;
};

const sourceHeaders: { key: keyof UnifiedInvoice; label: string; sortable: boolean }[] = [
    { key: 'supplierName', label: 'Supplier Name', sortable: true }, { key: 'supplierGstin', label: 'GSTIN', sortable: true },
    { key: 'docNo', label: 'Doc No', sortable: true }, { key: 'docType', label: 'Doc Type', sortable: true },
    { key: 'docDate', label: 'Date', sortable: true }, { key: 'taxableValue', label: 'Taxable Value', sortable: true },
    { key: 'igst', label: 'IGST', sortable: true }, { key: 'cgst', label: 'CGST', sortable: true },
    { key: 'sgst', label: 'SGST', sortable: true }, { key: 'totalTax', label: 'Total Tax', sortable: true },
];

const recoHeaders: { key: keyof UnifiedInvoice; label: string; sortable: boolean }[] = [
    { key: 'supplierName', label: 'Supplier Name', sortable: true },
    { key: 'supplierGstin', label: 'GSTIN', sortable: true },
    { key: 'docNo', label: 'Doc No', sortable: true },
    { key: 'docDate', label: 'Date', sortable: true },
    { key: 'taxableValue', label: 'Taxable Value', sortable: true },
    { key: 'igst', label: 'IGST', sortable: true },
    { key: 'cgst', label: 'CGST', sortable: true },
    { key: 'sgst', label: 'SGST', sortable: true },
    { key: 'totalTax', label: 'Total Tax', sortable: true },
];


const getStatusClass = (status: UnifiedInvoice['matchStatus']) => {
    switch (status) {
        case 'Exact Match': return 'status-exact';
        case 'Partial Match': return 'status-partial';
        case 'Probable Match': return 'status-probable';
        case 'Unmatched': return 'status-unmatched';
        case 'Only in GSTR-2B': return 'status-gstr2b-only';
        case 'Only in Books': return 'status-books-only';
        case 'Ineligible ITC': return 'status-ineligible';
        case 'Carried Forward': return 'status-carried-forward';
        default: return '';
    }
};

const HeaderCell: React.FC<{ headerKey: keyof UnifiedInvoice; label: string; sortable: boolean; sortConfig: SortConfig; onSort: (key: keyof UnifiedInvoice) => void; }> = ({ headerKey, label, sortable, sortConfig, onSort }) => {
    const isSorted = sortConfig?.key === headerKey;
    const direction = sortConfig?.direction;
    const sortIcon = sortable ? (isSorted ? (direction === 'ascending' ? '▲' : '▼') : '↕') : '';
    const headerProps = sortable ? { onClick: () => onSort(headerKey) } : {};

    return (
        <th {...headerProps}>
            {label}
            {sortable && <span className="sort-icon">{sortIcon}</span>}
        </th>
    );
};

const RemarkInput: React.FC<{
    invoice: UnifiedInvoice;
    onOverride: (invoiceId: string, newStatus: MatchStatus, newRemark: string) => void;
}> = ({ invoice, onOverride }) => {
    const initialRemark = invoice.remarks.startsWith('[Manual] ') ? invoice.remarks.substring(9) : (invoice.remarks.startsWith('[Bulk Manual] ') ? invoice.remarks.substring(14) : invoice.remarks);
    const [remark, setRemark] = useState(initialRemark);
    
    useEffect(() => {
        const newInitialRemark = invoice.remarks.startsWith('[Manual] ') ? invoice.remarks.substring(9) : (invoice.remarks.startsWith('[Bulk Manual] ') ? invoice.remarks.substring(14) : invoice.remarks);
        if (newInitialRemark !== remark) {
            setRemark(newInitialRemark);
        }
    }, [invoice.remarks]);

    const handleSave = () => {
        if (remark !== initialRemark && invoice.matchStatus !== 'Carried Forward') {
            onOverride(invoice.id, invoice.matchStatus!, remark);
        }
    };

    return (
         <div className="flex items-center">
            {invoice.isManualMatch && invoice.matchStatus !== 'Carried Forward' && <span title="Manually changed" className="font-bold text-blue-600 mr-1">*</span>}
            <input
                type="text"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                onBlur={handleSave}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-full bg-transparent p-0 m-0 border-0 focus:ring-1 focus:ring-blue-500 rounded-sm"
                placeholder="Add remark..."
                disabled={invoice.matchStatus === 'Carried Forward'}
            />
        </div>
    );
};


const InvoiceTable: React.FC<InvoiceTableProps> = ({ invoices, type, sortConfig, onSort, onManualOverride, onFindMatch, selectedInvoiceIds, onSelectionChange, onSelectAll, headerTopOffset }) => {
    const selectAllRef = useRef<HTMLInputElement>(null);
    const isReco = type === 'reco' && onManualOverride;
    
    useEffect(() => {
        if (selectAllRef.current && selectedInvoiceIds) {
            const numSelected = selectedInvoiceIds.size;
            const numVisible = invoices.length;
            selectAllRef.current.checked = numSelected === numVisible && numVisible > 0;
            selectAllRef.current.indeterminate = numSelected > 0 && numSelected < numVisible;
        }
    }, [selectedInvoiceIds, invoices]);
    
    if (invoices.length === 0) {
        return <div className="text-center py-12 px-4 bg-slate-50 rounded-lg"><p className="text-slate-500">No data to display in this view.</p></div>;
    }

    const renderSourceRow = (inv: UnifiedInvoice) => (
        <tr key={inv.id} title={inv.remarks}>
            <td>{inv.supplierName}</td>
            <td>{inv.supplierGstin}</td>
            <td>{inv.docNo}</td>
            <td>{inv.docType}</td>
            <td>{inv.docDate}</td>
            <td className="text-right">{formatIndianCurrency(inv.taxableValue)}</td>
            <td className="text-right">{formatIndianCurrency(inv.igst)}</td>
            <td className="text-right">{formatIndianCurrency(inv.cgst)}</td>
            <td className="text-right">{formatIndianCurrency(inv.sgst)}</td>
            <td className="text-right font-semibold">{formatIndianCurrency(inv.totalTax)}</td>
        </tr>
    );

    const renderStackedRow = (inv: UnifiedInvoice) => {
        const gstr2b = inv.gstr2bData;
        const books = inv.booksData;
        const isMatchedPair = !!(gstr2b && books);
        const statusClass = getStatusClass(inv.matchStatus);
        const isUnmatched = inv.matchStatus === 'Only in GSTR-2B' || inv.matchStatus === 'Only in Books';

        // Discrepancy checks for highlighting
        const isDocNoDiscrepant = isMatchedPair && gstr2b.docNo !== books.docNo;
        const isDocDateDiscrepant = isMatchedPair && gstr2b.docDate !== books.docDate;
        const isTaxableDiscrepant = isMatchedPair && Math.abs(gstr2b.taxableValue - books.taxableValue) > 0.01;
        const isIgstDiscrepant = isMatchedPair && Math.abs(gstr2b.igst - books.igst) > 0.01;
        const isCgstDiscrepant = isMatchedPair && Math.abs(gstr2b.cgst - books.cgst) > 0.01;
        const isSgstDiscrepant = isMatchedPair && Math.abs(gstr2b.sgst - books.sgst) > 0.01;
        const isTotalTaxDiscrepant = isMatchedPair && Math.abs(gstr2b.totalTax - books.totalTax) > 0.01;
        
        const rowSpan = isMatchedPair ? 2 : 1;
        const title = (inv.rcm === 'Y' ? `Reverse Charge Applicable. ${inv.mismatchReasons.join(', ')} ${inv.remarks}` : `${inv.mismatchReasons.join(', ')} ${inv.remarks}`).trim();

        const SharedCells = () => (
            <>
                <td rowSpan={rowSpan} className={statusClass}>
                    {onSelectionChange && selectedInvoiceIds && (
                        <input type="checkbox" className="h-4 w-4" checked={selectedInvoiceIds.has(inv.id)} onChange={(e) => onSelectionChange(inv.id, e.target.checked)} aria-label={`Select invoice ${inv.docNo}`} />
                    )}
                </td>
                <td rowSpan={rowSpan} className={statusClass}>
                     <select value={inv.matchStatus || ''} onChange={(e) => onManualOverride!(inv.id, e.target.value as MatchStatus, inv.remarks)} className="w-full bg-transparent p-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500" disabled={inv.matchStatus === 'Carried Forward'}>
                        {![ 'Exact Match', 'Unmatched', 'Ineligible ITC', 'Carried Forward'].includes(inv.matchStatus!) && <option value={inv.matchStatus!} disabled>{inv.matchStatus}</option>}
                        <option value="Exact Match">Match</option>
                        <option value="Unmatched">Unmatched</option>
                        <option value="Ineligible ITC">Ineligible ITC</option>
                        <option value="Carried Forward">Carry Forward</option>
                    </select>
                </td>
                <td rowSpan={rowSpan} className={`${statusClass} max-w-xs`}><RemarkInput invoice={inv} onOverride={onManualOverride!} /></td>
                <td rowSpan={rowSpan} className={statusClass}>
                    {isUnmatched && onFindMatch && (
                        <button onClick={() => onFindMatch(inv)} className="w-full px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600" title="Find a potential match for this invoice">
                            Find Match
                        </button>
                    )}
                </td>
            </>
        );

        const Gstr2bRow = gstr2b ? (
            <tr key={`${inv.id}-gstr2b`} className={`${statusClass}`} title={title}>
                <SharedCells />
                <td>GSTR-2B</td>
                <td>{gstr2b.supplierName}</td>
                <td>{gstr2b.supplierGstin}</td>
                <td>{gstr2b.docNo}</td>
                <td>{gstr2b.docDate}</td>
                <td className="text-right">{formatIndianCurrency(gstr2b.taxableValue)}</td>
                <td className="text-right">{formatIndianCurrency(gstr2b.igst)}</td>
                <td className="text-right">{formatIndianCurrency(gstr2b.cgst)}</td>
                <td className="text-right">{formatIndianCurrency(gstr2b.sgst)}</td>
                <td className="text-right font-semibold">{formatIndianCurrency(gstr2b.totalTax)}</td>
            </tr>
        ) : null;

        const BooksRow = books ? (
            <tr key={`${inv.id}-books`} className={`${statusClass} ${isMatchedPair ? 'reco-row-pair-bottom' : ''}`} title={title}>
                {!isMatchedPair && <SharedCells />}
                <td>Books</td>
                <td>{books.supplierName}</td>
                <td>{books.supplierGstin}</td>
                <td className={isDocNoDiscrepant ? 'cell-discrepancy' : ''}>{books.docNo}</td>
                <td className={isDocDateDiscrepant ? 'cell-discrepancy' : ''}>{books.docDate}</td>
                <td className={`text-right ${isTaxableDiscrepant ? 'cell-discrepancy' : ''}`}>{formatIndianCurrency(books.taxableValue)}</td>
                <td className={`text-right ${isIgstDiscrepant ? 'cell-discrepancy' : ''}`}>{formatIndianCurrency(books.igst)}</td>
                <td className={`text-right ${isCgstDiscrepant ? 'cell-discrepancy' : ''}`}>{formatIndianCurrency(books.cgst)}</td>
                <td className={`text-right ${isSgstDiscrepant ? 'cell-discrepancy' : ''}`}>{formatIndianCurrency(books.sgst)}</td>
                <td className={`text-right font-semibold ${isTotalTaxDiscrepant ? 'cell-discrepancy' : ''}`}>{formatIndianCurrency(books.totalTax)}</td>
            </tr>
        ) : null;
        
        return (
            <React.Fragment key={inv.id}>
                {Gstr2bRow}
                {BooksRow}
            </React.Fragment>
        );
    }
    
    const renderRecoHeader = () => (
        <tr>
            <th className="w-10">
                 {onSelectAll && (
                    <input type="checkbox" ref={selectAllRef} className="h-4 w-4" onChange={(e) => onSelectAll(e.target.checked)} aria-label="Select all invoices" />
                 )}
            </th>
            <th className="w-32"><HeaderCell headerKey="matchStatus" label="Status" sortable={true} sortConfig={sortConfig} onSort={onSort} /></th>
            <th className="w-48"><HeaderCell headerKey="remarks" label="Remarks" sortable={true} sortConfig={sortConfig} onSort={onSort} /></th>
            <th className="w-24">Actions</th>
            <th>Source</th>
            {recoHeaders.map(({ key, label, sortable }) => (
                <HeaderCell key={`${key}-${label}`} headerKey={key as keyof UnifiedInvoice} label={label} sortable={sortable} sortConfig={sortConfig} onSort={onSort as (k: keyof UnifiedInvoice) => void} />
            ))}
        </tr>
    );

    const renderSourceHeader = () => (
        <tr>
            {sourceHeaders.map(({ key, label, sortable }) => (
                <HeaderCell key={`${key}-${label}`} headerKey={key as keyof UnifiedInvoice} label={label} sortable={sortable} sortConfig={sortConfig} onSort={onSort as (k: keyof UnifiedInvoice) => void} />
            ))}
        </tr>
    );

    const tableClassName = isReco 
        ? "excel-grid !border-0 !rounded-none" 
        : "excel-grid";

    return (
        <table className={tableClassName}>
            <thead style={{ top: `${headerTopOffset}px`}}>
                {isReco ? renderRecoHeader() : renderSourceHeader()}
            </thead>
            <tbody>
                {invoices.map((inv) => (
                   isReco ? renderStackedRow(inv) : renderSourceRow(inv)
                ))}
            </tbody>
        </table>
    );
};

export default InvoiceTable;
