import React, { useState } from 'react';
import { ReconciliationResult, CustomMatchKeys, UnifiedInvoice, Period } from '../types';
import { exportToCsv } from '../utils/csvExporter';
import { getMonthName } from '../utils/periodUtils';

interface ToolbarProps {
    period: Period;
    onImportGstr2b: () => void;
    onImportBooks: () => void;
    onReset: () => void;
    reconciliationResult: ReconciliationResult | null;
    filteredInvoicesForExport: UnifiedInvoice[];
    customTolerances: { taxableValue: number; totalTax: number; };
    setCustomTolerances: (value: { taxableValue: number; totalTax: number; }) => void;
    customCriteria: Set<CustomMatchKeys>;
    setCustomCriteria: (value: Set<CustomMatchKeys>) => void;
    onCustomReconcile: () => void;
}

const ToolbarButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ onClick, children, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex flex-col items-center px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded-md disabled:text-slate-400 disabled:hover:bg-transparent"
    >
        {children}
    </button>
);

const allCriteria: { key: CustomMatchKeys, label: string }[] = [
    { key: 'supplierGstin', label: 'GSTIN' },
    { key: 'docType', label: 'Doc Type' },
    { key: 'docNo', label: 'Doc No' },
    { key: 'docDate', label: 'Date' },
    { key: 'taxableValue', label: 'Taxable Value' },
    { key: 'totalTax', label: 'Total Tax' },
    { key: 'taxHeads', label: 'Tax Heads' },
];

const Toolbar: React.FC<ToolbarProps> = ({ 
    period, onImportGstr2b, onImportBooks, onReset, reconciliationResult,
    filteredInvoicesForExport, customTolerances, setCustomTolerances, 
    customCriteria, setCustomCriteria, onCustomReconcile 
}) => {
    
    const [isManualMatchVisible, setIsManualMatchVisible] = useState(false);

    const handleExport = () => {
        if (filteredInvoicesForExport.length > 0) {
            exportToCsv(filteredInvoicesForExport, 'filtered_reconciliation_export.csv');
        }
    };

    const handleCriteriaChange = (key: CustomMatchKeys) => {
        const newCriteria = new Set(customCriteria);
        if (newCriteria.has(key)) {
            newCriteria.delete(key);
        } else {
            newCriteria.add(key);
        }
        setCustomCriteria(newCriteria);
    };
    
    const periodDisplay = `${getMonthName(period.month)} ${period.year}`;

    return (
        <header className="excel-ribbon shadow-sm">
            <div className="flex flex-col">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-1 border-r pr-4">
                            <ToolbarButton onClick={onReset}>
                                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20v-5h-5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9a9 9 0 0115-2.82" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 15a9 9 0 01-15 2.82" /></svg>
                                <span>New Reco</span>
                            </ToolbarButton>
                        </div>

                        <div className="flex items-center space-x-1 border-r pr-4">
                            <ToolbarButton onClick={onImportGstr2b}>
                                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                                <span>Import 2B</span>
                            </ToolbarButton>
                            <ToolbarButton onClick={onImportBooks}>
                                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
                                <span>Import Books</span>
                            </ToolbarButton>
                        </div>
                        
                        <div className="flex items-center space-x-1 border-r pr-4">
                            <ToolbarButton onClick={() => setIsManualMatchVisible(!isManualMatchVisible)} disabled={!reconciliationResult}>
                                 <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                                <span>Matching Options</span>
                            </ToolbarButton>
                        </div>

                        <div className="flex items-center space-x-1">
                            <ToolbarButton onClick={handleExport} disabled={!reconciliationResult || filteredInvoicesForExport.length === 0}>
                                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                <span>Export</span>
                            </ToolbarButton>
                        </div>
                    </div>
                     <div className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-md border">
                        Period: {periodDisplay}
                    </div>
                </div>

                {isManualMatchVisible && reconciliationResult && (
                    <div className="mt-2 pt-3 border-t bg-slate-50 p-3 rounded-md text-slate-700">
                        <div className="grid grid-cols-3 gap-x-6 items-end">
                            <div className="col-span-1">
                                <label className="text-sm font-semibold text-slate-600 mb-2 block">Match On:</label>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    {allCriteria.map(({ key, label }) => (
                                        <label key={key} className="flex items-center text-sm text-slate-800">
                                            <input type="checkbox" className="form-checkbox h-4 w-4 rounded text-blue-600 focus:ring-blue-500" checked={customCriteria.has(key)} onChange={() => handleCriteriaChange(key)} />
                                            <span className="ml-2">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-1 border-l pl-6">
                                <label className="text-sm font-semibold text-slate-600 mb-2 block">Tolerances (±)</label>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="taxable-tolerance" className="text-sm font-medium text-slate-600">Taxable Value:</label>
                                        <input
                                            id="taxable-tolerance"
                                            type="number"
                                            value={customTolerances.taxableValue}
                                            onChange={(e) => setCustomTolerances({ ...customTolerances, taxableValue: parseFloat(e.target.value) || 0 })}
                                            className="w-28 p-1 border rounded-md text-sm text-slate-800 bg-white shadow-sm"
                                            aria-label="Taxable Value Tolerance"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="tax-tolerance" className="text-sm font-medium text-slate-600">Total Tax:</label>
                                        <input
                                            id="tax-tolerance"
                                            type="number"
                                            value={customTolerances.totalTax}
                                            onChange={(e) => setCustomTolerances({ ...customTolerances, totalTax: parseFloat(e.target.value) || 0 })}
                                            className="w-28 p-1 border rounded-md text-sm text-slate-800 bg-white shadow-sm"
                                            aria-label="Total Tax Tolerance"
                                        />
                                    </div>
                                </div>
                            </div>
                             <div className="col-span-1 flex justify-start pl-6">
                                <button
                                    onClick={onCustomReconcile}
                                    className="px-6 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm"
                                >
                                    Re-Run Match
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Toolbar;