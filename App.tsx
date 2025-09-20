import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { InvoiceData, ReconciliationResult, CustomMatchKeys, PreviewTab, SortConfig, UnifiedInvoice, MatchBasis, MatchStatus, ProbableSupplierMatch, Period } from './types';
import { parseGstr2bJson, parseBooksFile, parseGstr2bCsvFile, normalizeDocNo, normalizeGstin, normalizeName } from './utils/parsers';
import { reconcileInvoices, calculateSummary, scoreAndFinalizeMatch } from './services/reconciliationService';
import { getCarriedForwardInvoices, saveCarriedForwardInvoices } from './services/storageService';
import FileUploadCard from './components/FileUploadCard';
import ResultsDashboard from './components/ResultsDashboard';
import { downloadCsvTemplate, downloadGstr2bTemplate } from './utils/csvExporter';
import Toolbar from './components/Toolbar';
import InvoiceTable from './components/InvoiceTable';
import PeriodSelectionScreen from './components/PeriodSelectionScreen';
import CarryForwardPrompt from './components/CarryForwardPrompt';
import { getNextPeriod, formatPeriod } from './utils/periodUtils';
import MatchFinder from './components/MatchFinder';

const WelcomeScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 text-center p-4" style={{ fontFamily: "Calibri, 'Segoe UI', sans-serif" }}>
        <div className="bg-white p-12 rounded-lg shadow-xl max-w-2xl w-full border border-slate-200">
            <h1 className="text-4xl font-semibold text-slate-800 mb-2">GSTR-2B Reconciliation Tool</h1>
            <p className="text-slate-500 text-lg mb-8">Automated reconciliation with an Excel-like interface.</p>
            <button
                onClick={onStart}
                className="px-8 py-3 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                Start Reconciliation
            </button>
        </div>
    </div>
);


const ReconciliationWorkspace: React.FC<{ period: Period, onBackToPeriodSelection: () => void }> = ({ period, onBackToPeriodSelection }) => {
    const [gstr2bFile, setGstr2bFile] = useState<File | null>(null);
    const [booksFile, setBooksFile] = useState<File | null>(null);
    
    const [gstr2bInvoices, setGstr2bInvoices] = useState<InvoiceData[]>([]);
    const [booksInvoices, setBooksInvoices] = useState<InvoiceData[]>([]);

    const [workflowStep, setWorkflowStep] = useState<'import_gstr2b' | 'import_books' | 'results'>('import_gstr2b');
    
    const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
    const [probableSupplierMatches, setProbableSupplierMatches] = useState<ProbableSupplierMatch[]>([]);
    const [filteredInvoicesForExport, setFilteredInvoicesForExport] = useState<UnifiedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    
    const [previewTab, setPreviewTab] = useState<PreviewTab | null>(null);
    const [previewSortConfig, setPreviewSortConfig] = useState<SortConfig>(null);

    const [customTolerances, setCustomTolerances] = useState({ taxableValue: 10, totalTax: 10 });
    const [customCriteria, setCustomCriteria] = useState<Set<CustomMatchKeys>>(
        new Set(['supplierGstin', 'docNo', 'docDate', 'taxableValue', 'totalTax'])
    );
    const [includeRcmInItc, setIncludeRcmInItc] = useState(true);
    
    const [carryForwardPromptData, setCarryForwardPromptData] = useState<{ gstr2b: InvoiceData[], books: InvoiceData[] } | null>(null);
    const [matchFinderState, setMatchFinderState] = useState<{ open: boolean, invoice: UnifiedInvoice | null }>({ open: false, invoice: null });


    const gstr2bJsonInputRef = useRef<HTMLInputElement>(null);
    const gstr2bCsvInputRef = useRef<HTMLInputElement>(null);
    const booksInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        const checkCarryForward = async () => {
            const periodString = formatPeriod(period);
            const data = await getCarriedForwardInvoices(periodString);
            if(data.gstr2b.length > 0 || data.books.length > 0) {
                setCarryForwardPromptData(data);
            }
        };
        checkCarryForward();
    }, [period]);

    const handleFileChange = async (file: File, parser: (file: File) => Promise<InvoiceData[]>, setter: React.Dispatch<React.SetStateAction<InvoiceData[]>>, fileSetter: React.Dispatch<React.SetStateAction<File | null>>, tab: PreviewTab) => {
        setError('');
        setIsLoading(true);
        fileSetter(file);
        try {
            const invoices = await parser(file);
            if (invoices.length === 0) {
                throw new Error("No valid invoices were found in the uploaded file. Please check the file format and content.");
            }
            // Use functional update to ensure we are appending to the latest state, especially after including carried forward data.
            setter(prev => [...prev, ...invoices]); 
            setPreviewTab(tab);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'File parsing failed.');
            fileSetter(null);
            setter(prev => prev.filter(inv => inv.carriedForwardFromPeriod)); // Keep only carried forward on error
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGstr2bJsonChange = (file: File) => handleFileChange(file, parseGstr2bJson, setGstr2bInvoices, setGstr2bFile, 'gstr2b');
    const handleGstr2bCsvChange = (file: File) => handleFileChange(file, parseGstr2bCsvFile, setGstr2bInvoices, setGstr2bFile, 'gstr2b');
    const handleBooksFileChange = (file: File) => handleFileChange(file, parseBooksFile, setBooksInvoices, setBooksFile, 'books');

    const runReconciliation = (isCustom: boolean = false) => {
        if (gstr2bInvoices.length === 0) {
            setError("Please upload a GSTR-2B file.");
            return;
        }
        if (booksInvoices.length === 0) {
            setError("Please upload the Purchase Register (Books) file.");
            return;
        }
    
        setIsLoading(true);
        setError('');
        setTimeout(() => {
            try {
                const customConfig = isCustom ? { criteria: customCriteria, tolerances: customTolerances } : undefined;
                const result = reconcileInvoices(gstr2bInvoices, booksInvoices, customConfig);
                setReconciliationResult(result);
                setProbableSupplierMatches(result.probableSupplierMatches);
                setWorkflowStep('results');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred during reconciliation.');
                setReconciliationResult(null);
            } finally {
                setIsLoading(false);
            }
        }, 500);
    };

    const handleInitialReconcile = useCallback(() => runReconciliation(false), [gstr2bInvoices, booksInvoices]);
    const handleCustomReconcile = useCallback(() => runReconciliation(true), [gstr2bInvoices, booksInvoices, customCriteria, customTolerances]);

    const handleSupplierLinkConfirm = (match: ProbableSupplierMatch) => {
        const updatedBooksInvoices = booksInvoices.map(inv => {
            if (normalizeName(inv.supplierName) === match.booksSupplierName) {
                return {
                    ...inv,
                    supplierGstin: match.gstr2bSupplier.gstin,
                };
            }
            return inv;
        });
        setBooksInvoices(updatedBooksInvoices); // This will trigger the useEffect to re-reconcile
        setProbableSupplierMatches(prev => prev.filter(p => p.booksSupplierName !== match.booksSupplierName));
    };

    const handleSupplierLinkReject = (matchToReject: ProbableSupplierMatch) => {
        setProbableSupplierMatches(prev => prev.filter(p => p.booksSupplierName !== matchToReject.booksSupplierName));
    };
    
    const isInitialBooksLoad = useRef(true);
    useEffect(() => {
        if (isInitialBooksLoad.current) {
            isInitialBooksLoad.current = false;
        } else {
            if (gstr2bInvoices.length > 0 && booksInvoices.length > 0) {
                handleInitialReconcile();
            }
        }
    }, [booksInvoices]);

    const handleManualOverride = (invoiceId: string, newStatus: MatchStatus, newRemark: string) => {
        if (!reconciliationResult) return;

        const newInvoices = reconciliationResult.allInvoices.map(inv => {
            if (inv.id === invoiceId) {
                return {
                    ...inv,
                    matchStatus: newStatus,
                    remarks: `[Manual] ${newRemark}`,
                    isManualMatch: true,
                };
            }
            return inv;
        });
        
        recalculate(newInvoices);
    };

    const handleBulkOverride = (invoiceIds: Set<string>, newStatus: MatchStatus, newRemark: string) => {
        if (!reconciliationResult) return;
        
        if (newStatus === 'Carried Forward') {
             handleCarryForward(invoiceIds);
             return;
        }

        const newInvoices = reconciliationResult.allInvoices.map(inv => {
            if (invoiceIds.has(inv.id)) {
                return {
                    ...inv,
                    matchStatus: newStatus,
                    remarks: `[Bulk Manual] ${newRemark}`,
                    isManualMatch: true,
                };
            }
            return inv;
        });

        recalculate(newInvoices);
    };
    
     const handleCarryForward = (invoiceIds: Set<string>) => {
        if (!reconciliationResult) return;
        
        const invoicesToCarry = reconciliationResult.allInvoices.filter(inv => invoiceIds.has(inv.id));
        const gstr2bToCarry: InvoiceData[] = invoicesToCarry
            .filter(inv => inv.inGstr2b && inv.gstr2bData)
            .map(inv => ({ ...inv.gstr2bData!, carriedForwardFromPeriod: formatPeriod(period) }));
            
        const booksToCarry: InvoiceData[] = invoicesToCarry
            .filter(inv => inv.inBooks && inv.booksData)
            .map(inv => ({ ...inv.booksData!, carriedForwardFromPeriod: formatPeriod(period) }));
            
        const nextPeriod = getNextPeriod(period);
        saveCarriedForwardInvoices(formatPeriod(nextPeriod), { gstr2b: gstr2bToCarry, books: booksToCarry });
        
        // Update the status locally for the current view
        const newInvoices = reconciliationResult.allInvoices.map(inv => {
            if (invoiceIds.has(inv.id)) {
                return {
                    ...inv,
                    matchStatus: 'Carried Forward' as MatchStatus,
                    remarks: `Carried forward to ${formatPeriod(nextPeriod)}`,
                    isManualMatch: true,
                };
            }
            return inv;
        });
        recalculate(newInvoices);
    };
    
    const recalculate = (newInvoices: UnifiedInvoice[]) => {
         const newSummary = calculateSummary(
            newInvoices,
            {
                totalGstr2b: reconciliationResult!.summary.totalGstr2b,
                totalBooks: reconciliationResult!.summary.totalBooks,
            },
            gstr2bInvoices,
            booksInvoices,
            includeRcmInItc
        );

        setReconciliationResult({
            ...reconciliationResult!,
            summary: newSummary,
            allInvoices: newInvoices,
        });
    };
    
    useEffect(() => {
        if (!reconciliationResult) return;
        recalculate(reconciliationResult.allInvoices);
    }, [includeRcmInItc]);

    const handleReset = () => {
        setGstr2bFile(null);
        setBooksFile(null);
        setGstr2bInvoices([]);
        setBooksInvoices([]);
        setReconciliationResult(null);
        setProbableSupplierMatches([]);
        setError('');
        setIsLoading(false);
        setPreviewTab(null);
        setPreviewSortConfig(null);
        setWorkflowStep('import_gstr2b');
        onBackToPeriodSelection();
    };
    
     const handleAcceptCarryForward = () => {
        if (carryForwardPromptData) {
            setGstr2bInvoices(prev => [...carryForwardPromptData.gstr2b, ...prev]);
            setBooksInvoices(prev => [...carryForwardPromptData.books, ...prev]);
            setCarryForwardPromptData(null);
        }
    };

    const handleRejectCarryForward = () => {
        setCarryForwardPromptData(null);
    };

    const handleOpenMatchFinder = (invoice: UnifiedInvoice) => {
        setMatchFinderState({ open: true, invoice });
    };

    const handleCloseMatchFinder = () => {
        setMatchFinderState({ open: false, invoice: null });
    };
    
    const handleConfirmAssistedMatch = (sourceInvoice: UnifiedInvoice, targetInvoice: UnifiedInvoice) => {
        if (!reconciliationResult) return;

        const gstr2bData = sourceInvoice.inGstr2b ? sourceInvoice.gstr2bData : targetInvoice.gstr2bData;
        const booksData = sourceInvoice.inBooks ? sourceInvoice.booksData : targetInvoice.booksData;

        if (!gstr2bData || !booksData) return; // Should not happen
        
        const mergedId = `${normalizeGstin(gstr2bData.supplierGstin)}-${normalizeDocNo(gstr2bData.docNo)}`;
        
        let mergedInvoice: UnifiedInvoice = {
            id: mergedId,
            ...gstr2bData, // Base data from GSTR-2B
            inGstr2b: true,
            inBooks: true,
            gstr2bData,
            booksData,
            matchBasis: 'GSTIN', // Assume GSTIN match was the goal
            isManualMatch: true,
            remarks: '[Assisted Match]',
            mismatchReasons: [],
            matchStatus: null, // To be determined by scoring
            returnPeriod: '',
            carriedForwardAge: 0,
            // FIX: Add required 'rcm' property with a default value since it's required by the UnifiedInvoice type.
            rcm: gstr2bData.rcm ?? 'N',
        };
        
        // Score the newly merged invoice
        mergedInvoice = scoreAndFinalizeMatch(mergedInvoice, { criteria: customCriteria, tolerances: customTolerances });

        // Remove old invoices and add the new one
        const newInvoices = reconciliationResult.allInvoices
            .filter(inv => inv.id !== sourceInvoice.id && inv.id !== targetInvoice.id);
        newInvoices.push(mergedInvoice);

        recalculate(newInvoices);
        handleCloseMatchFinder();
    };


    
    const unifiedPreviewData: UnifiedInvoice[] = useMemo(() => {
        let sourceData: InvoiceData[] = [];
        let sourceTab: PreviewTab | null = previewTab;

        if (sourceTab === 'gstr2b') sourceData = gstr2bInvoices;
        else if (sourceTab === 'books') sourceData = booksInvoices;
        else return [];
        
        return sourceData.map(inv => {
            const id = `${normalizeGstin(inv.supplierGstin) || normalizeName(inv.supplierName)}-${normalizeDocNo(inv.docNo)}-${sourceTab}`;
            return {
                id,
                ...inv,
                inGstr2b: sourceTab === 'gstr2b',
                inBooks: sourceTab === 'books',
                matchStatus: null,
                matchBasis: 'N/A' as MatchBasis,
                mismatchReasons: [],
                remarks: inv.carriedForwardFromPeriod ? `Carried forward from ${inv.carriedForwardFromPeriod}` : '',
                returnPeriod: '',
                carriedForwardAge: 0,
                rcm: inv.rcm ?? 'N',
            };
        });
    }, [previewTab, gstr2bInvoices, booksInvoices]);


    const sortedPreviewInvoices = useMemo(() => {
        const invoices = [...unifiedPreviewData];
        if (previewSortConfig !== null) {
            invoices.sort((a, b) => {
                const aValue = a[previewSortConfig.key];
                const bValue = b[previewSortConfig.key];
                 if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return previewSortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
                }
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return previewSortConfig.direction === 'ascending' 
                        ? aValue.localeCompare(bValue) 
                        : bValue.localeCompare(aValue);
                }
                return 0;
            });
        }
        return invoices;
    }, [unifiedPreviewData, previewSortConfig]);
    
    const handlePreviewSort = (key: keyof UnifiedInvoice) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (previewSortConfig && previewSortConfig.key === key && previewSortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setPreviewSortConfig({ key, direction });
    };

    const renderImportGstr2b = () => (
         <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200">
             {carryForwardPromptData && (
                <CarryForwardPrompt 
                    data={carryForwardPromptData} 
                    onAccept={handleAcceptCarryForward} 
                    onReject={handleRejectCarryForward} 
                />
            )}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-slate-700">Step 1: Import GSTR-2B Data</h2>
                <p className="text-slate-500 mt-1">Upload your official GSTR-2B JSON from the GST Portal or use our CSV template.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <FileUploadCard title="GSTR-2B JSON" description="Upload official JSON file from GST portal." fileType=".json" file={gstr2bFile?.type === 'application/json' ? gstr2bFile : null} onFileChange={handleGstr2bJsonChange} invoiceCount={gstr2bInvoices.length} />
                <FileUploadCard title="GSTR-2B CSV" description="Upload data using our standard template." fileType=".csv" file={gstr2bFile?.type === 'text/csv' ? gstr2bFile : null} onFileChange={handleGstr2bCsvChange} invoiceCount={gstr2bInvoices.length} />
            </div>
             <div className="mt-8 flex justify-center items-center gap-6">
                 <button 
                   onClick={downloadGstr2bTemplate}
                   className="text-sm text-blue-600 hover:underline"
                 >
                   Download GSTR-2B CSV Template
                 </button>
            </div>
            {gstr2bInvoices.length > 0 && (
                <div className="mt-8 flex justify-center">
                     <button 
                        onClick={() => { setWorkflowStep('import_books'); setPreviewTab('books'); }}
                        className="px-10 py-3 text-lg font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                       Proceed to Import Books
                    </button>
                </div>
            )}
        </div>
    );

    const renderImportBooks = () => (
         <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-slate-700">Step 2: Import Purchase Register</h2>
                <p className="text-slate-500 mt-1">Upload your books data to reconcile against the imported GSTR-2B records.</p>
            </div>
             <div className="max-w-xl mx-auto">
                <FileUploadCard title="Purchase Register" description="Upload Books CSV file." fileType=".csv" file={booksFile} onFileChange={handleBooksFileChange} invoiceCount={booksInvoices.length} />
            </div>

            <div className="mt-8 flex justify-center items-center gap-6">
                <button 
                    onClick={() => { setWorkflowStep('import_gstr2b'); setPreviewTab('gstr2b'); }}
                    className="text-sm text-slate-600 hover:underline"
                 >
                   &larr; Back to GSTR-2B Import
                 </button>
                <button 
                    onClick={handleInitialReconcile} 
                    disabled={isLoading || gstr2bInvoices.length === 0 || booksInvoices.length === 0}
                    className="px-10 py-3 text-lg font-semibold text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 transition-all disabled:bg-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                    {isLoading ? "Processing..." : "Reconcile Now"}
                </button>
                 <button 
                   onClick={downloadCsvTemplate}
                   className="text-sm text-blue-600 hover:underline"
                 >
                   Download Purchase Register Template
                 </button>
            </div>
        </div>
    );
    
    const renderDataPreview = () => (
         <div className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col flex-grow">
             <h3 className="text-xl font-semibold text-slate-700 mb-2">Data Preview</h3>
             <div className="flex-grow flex flex-col min-h-0">
                <div className="excel-tabs mb-2 flex">
                     {gstr2bInvoices.length > 0 && <button onClick={() => setPreviewTab('gstr2b')} className={`excel-tab ${previewTab === 'gstr2b' ? 'active' : ''}`}>2B Data</button>}
                     {booksInvoices.length > 0 && <button onClick={() => setPreviewTab('books')} className={`excel-tab ${previewTab === 'books' ? 'active' : ''}`}>Books Data</button>}
                </div>
                <div className="flex-grow overflow-auto">
                     <InvoiceTable invoices={sortedPreviewInvoices} type="source" sortConfig={previewSortConfig} onSort={handlePreviewSort} headerTopOffset={0} />
                </div>
            </div>
         </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <Toolbar
                period={period}
                onImportGstr2b={() => { setWorkflowStep('import_gstr2b'); gstr2bJsonInputRef.current?.click() }}
                onImportBooks={() => { setWorkflowStep('import_books'); booksInputRef.current?.click() }}
                onReset={handleReset}
                reconciliationResult={reconciliationResult}
                filteredInvoicesForExport={filteredInvoicesForExport}
                customTolerances={customTolerances}
                setCustomTolerances={setCustomTolerances}
                customCriteria={customCriteria}
                setCustomCriteria={setCustomCriteria}
                onCustomReconcile={handleCustomReconcile}
            />
             {/* Hidden file inputs */}
            <input type="file" ref={gstr2bJsonInputRef} className="hidden" accept=".json" onChange={e => e.target.files && handleGstr2bJsonChange(e.target.files[0])} />
            <input type="file" ref={gstr2bCsvInputRef} className="hidden" accept=".csv" onChange={e => e.target.files && handleGstr2bCsvChange(e.target.files[0])} />
            <input type="file" ref={booksInputRef} className="hidden" accept=".csv" onChange={e => e.target.files && handleBooksFileChange(e.target.files[0])} />

            <main className="flex-grow p-4 flex flex-col overflow-hidden">
                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}
                {workflowStep === 'results' && reconciliationResult ? (
                    <>
                        <ResultsDashboard 
                            result={reconciliationResult} 
                            probableSupplierMatches={probableSupplierMatches}
                            onSupplierLinkConfirm={handleSupplierLinkConfirm}
                            onSupplierLinkReject={handleSupplierLinkReject}
                            onManualOverride={handleManualOverride}
                            onBulkOverride={handleBulkOverride}
                            includeRcmInItc={includeRcmInItc}
                            setIncludeRcmInItc={setIncludeRcmInItc}
                            onFilteredInvoicesChange={setFilteredInvoicesForExport}
                            onFindMatch={handleOpenMatchFinder}
                        />
                         {matchFinderState.open && matchFinderState.invoice && (
                            <MatchFinder
                                sourceInvoice={matchFinderState.invoice}
                                allInvoices={reconciliationResult.allInvoices}
                                onClose={handleCloseMatchFinder}
                                onConfirmMatch={handleConfirmAssistedMatch}
                            />
                        )}
                    </>
                ) : (
                    <>
                    {workflowStep === 'import_gstr2b' && renderImportGstr2b()}
                    {workflowStep === 'import_books' && renderImportBooks()}
                    {(gstr2bInvoices.length > 0 || booksInvoices.length > 0) && renderDataPreview()}
                    </>
                )}
            </main>
        </div>
    );
};

const App: React.FC = () => {
    const [screen, setScreen] = useState<'welcome' | 'period_selection' | 'reco'>('welcome');
    const [period, setPeriod] = useState<Period | null>(null);

    const handlePeriodSelect = (selectedPeriod: Period) => {
        setPeriod(selectedPeriod);
        setScreen('reco');
    };

    const handleBackToPeriodSelection = () => {
        setPeriod(null);
        setScreen('period_selection');
    };

    if (screen === 'welcome') {
        return <WelcomeScreen onStart={() => setScreen('period_selection')} />;
    }
    
    if (screen === 'period_selection' || !period) {
        return <PeriodSelectionScreen onPeriodSelect={handlePeriodSelect} />;
    }

    return <ReconciliationWorkspace period={period} onBackToPeriodSelection={handleBackToPeriodSelection}/>;
};

export default App;
