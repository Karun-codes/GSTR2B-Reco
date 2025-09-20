import React, { useState } from 'react';
import { Period } from '../types';
import { getMonthName } from '../utils/periodUtils';

interface PeriodSelectionScreenProps {
    onPeriodSelect: (period: Period) => void;
}

const months = Array.from({ length: 12 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

const PeriodSelectionScreen: React.FC<PeriodSelectionScreenProps> = ({ onPeriodSelect }) => {
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onPeriodSelect({ month: selectedMonth, year: selectedYear });
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4" style={{ fontFamily: "Calibri, 'Segoe UI', sans-serif" }}>
            <div className="bg-white p-12 rounded-lg shadow-xl max-w-lg w-full border border-slate-200">
                <h1 className="text-3xl font-semibold text-slate-800 mb-2 text-center">Select Reconciliation Period</h1>
                <p className="text-slate-500 text-md mb-8 text-center">Choose the financial month and year you want to reconcile.</p>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="month" className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                        <select
                            id="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {months.map(m => <option key={m} value={m}>{getMonthName(m)}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="year" className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                         <select
                            id="year"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                     <button
                        type="submit"
                        className="w-full px-8 py-3 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Proceed
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PeriodSelectionScreen;
