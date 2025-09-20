import React from 'react';
import { ReconciliationResult } from '../types';
import { formatIndianCurrency } from '../utils/formatters';

interface ItcSummaryTableProps {
    summary: ReconciliationResult['summary'];
}

const ItcSummaryTable: React.FC<ItcSummaryTableProps> = ({ summary }) => {
    return (
        <table className="w-full text-sm">
            <tbody>
                <tr className="border-b">
                    <td className="py-2 pr-4 text-slate-600">Total ITC Available as per GSTR-2B</td>
                    <td className="py-2 pl-4 text-right font-semibold text-slate-800">{formatIndianCurrency(summary.itcAsPerGstr2bTotal)}</td>
                </tr>
                <tr className="border-b">
                    <td className="py-2 pr-4 text-slate-600">
                        <span className="text-red-500 font-bold mr-2">(-)</span>
                        Less: ITC in GSTR-2B not in Books
                    </td>
                    <td className="py-2 pl-4 text-right font-semibold text-red-600">{formatIndianCurrency(summary.itcNotInBooksAmount)}</td>
                </tr>
                 <tr className="border-b">
                    <td className="py-2 pr-4 text-slate-600">
                        <span className="text-red-500 font-bold mr-2">(-)</span>
                        Less: Ineligible ITC
                    </td>
                    <td className="py-2 pl-4 text-right font-semibold text-red-600">{formatIndianCurrency(summary.ineligibleAmount)}</td>
                </tr>
                <tr className="border-b bg-slate-50">
                    <td className="py-2 pr-4 font-bold text-slate-700">Net ITC as per GSTR-2B</td>
                    <td className="py-2 pl-4 text-right font-bold text-slate-900">{formatIndianCurrency(summary.finalEligibleItc)}</td>
                </tr>
                 <tr className="border-b">
                    <td className="py-2 pr-4 text-slate-600">Total ITC as per Books</td>
                    <td className="py-2 pl-4 text-right font-semibold text-slate-800">{formatIndianCurrency(summary.netItcAsPerBooks)}</td>
                </tr>
                <tr>
                    <td className="pt-3 pr-4 text-blue-600 font-bold">Difference to be Reconciled</td>
                    <td className="pt-3 pl-4 text-right font-bold text-blue-700">
                        {formatIndianCurrency(summary.finalEligibleItc - summary.netItcAsPerBooks)}
                    </td>
                </tr>
            </tbody>
        </table>
    );
};

export default ItcSummaryTable;
