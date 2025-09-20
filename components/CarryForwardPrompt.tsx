import React, { useEffect, useRef } from 'react';
import { InvoiceData } from '../types';

interface CarryForwardPromptProps {
    data: {
        gstr2b: InvoiceData[];
        books: InvoiceData[];
    };
    onAccept: () => void;
    onReject: () => void;
}

const CarryForwardPrompt: React.FC<CarryForwardPromptProps> = ({ data, onAccept, onReject }) => {
    const totalInvoices = data.gstr2b.length + data.books.length;
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Focus the first button on mount
        const firstButton = containerRef.current?.querySelector('button');
        firstButton?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onReject();
            }

            if (e.key === 'Tab') {
                const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusableElements || focusableElements.length === 0) return;

                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) { // Shift + Tab
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else { // Tab
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onReject]);

    return (
        <div ref={containerRef} className="p-4 bg-blue-50 border-l-4 border-blue-400 mb-6 rounded-r-lg shadow-sm">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="ml-3 flex-grow">
                    <h3 className="text-sm font-bold text-blue-800">Carry Forward Assistant</h3>
                    <p className="text-sm text-blue-700 mt-1">
                        We found <strong>{totalInvoices} invoice(s)</strong> ({data.gstr2b.length} from GSTR-2B, {data.books.length} from Books) carried forward from the previous period.
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                        Would you like to include them in this reconciliation?
                    </p>
                     <div className="mt-3 space-x-4">
                        <button 
                            onClick={onAccept} 
                            className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            Yes, Include
                        </button>
                        <button 
                            onClick={onReject} 
                            className="px-4 py-1.5 text-sm font-semibold bg-transparent text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                        >
                            Ignore for now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CarryForwardPrompt;