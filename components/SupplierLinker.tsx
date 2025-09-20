import React, { useEffect, useRef } from 'react';
import { ProbableSupplierMatch } from '../types';

interface SupplierLinkerProps {
    matches: ProbableSupplierMatch[];
    onConfirm: (match: ProbableSupplierMatch) => void;
    onReject: (match: ProbableSupplierMatch) => void;
}

const SupplierLinker: React.FC<SupplierLinkerProps> = ({ matches, onConfirm, onReject }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Focus the first button on mount
        const firstButton = containerRef.current?.querySelector('button');
        firstButton?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                // Reject the first visible match on Escape
                if (matches.length > 0) {
                    onReject(matches[0]);
                }
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
    }, [matches, onReject]);

    return (
        <div ref={containerRef} className="p-4 bg-yellow-50 border-l-4 border-yellow-400 my-4 rounded-r-lg">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-bold text-yellow-800">Supplier Linking Assistant</h3>
                    <p className="text-sm text-yellow-700 mt-1">We found names in your Books that are similar to suppliers in GSTR-2B. Confirm them to improve matching.</p>
                </div>
            </div>
            
            <ul className="mt-4 space-y-2">
                {matches.slice(0, 3).map(match => ( // Show max 3 at a time to not overwhelm
                    <li key={match.booksSupplierName} className="p-3 bg-white rounded-md shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div className="text-sm">
                           <p>Is "<strong className="text-slate-800 font-semibold">{match.booksSupplierName}</strong>" (from Books)</p>
                           <p className="mt-1">the same as "<strong className="text-slate-800 font-semibold">{match.gstr2bSupplier.name}</strong>" (GSTIN: {match.gstr2bSupplier.gstin})?</p>
                        </div>
                        <div className="space-x-2 mt-2 sm:mt-0 flex-shrink-0">
                           <button 
                             onClick={() => onConfirm(match)} 
                             className="px-3 py-1 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                           >
                            Confirm & Link
                           </button>
                           <button 
                             onClick={() => onReject(match)} 
                             className="px-3 py-1 text-xs font-semibold bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors"
                           >
                            Reject
                           </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SupplierLinker;