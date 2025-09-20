import { UnifiedInvoice } from '../types';

const convertToCSV = (data: UnifiedInvoice[]): string => {
    if (data.length === 0) return '';

    const headers = [
        'Supplier Name', 'GSTIN', 'Doc No', 'Date', 'Taxable Value', 'IGST', 'CGST', 'SGST', 
        'In 2B', 'In Books', 'Match Status', 'Match Basis', 'Remarks', 'Carried Forward Age'
    ];

    const rows = data.map(inv => [
        inv.supplierName,
        inv.supplierGstin,
        inv.docNo,
        inv.docDate,
        inv.taxableValue.toFixed(2),
        inv.igst.toFixed(2),
        inv.cgst.toFixed(2),
        inv.sgst.toFixed(2),
        inv.inGstr2b ? 'Y' : 'N',
        inv.inBooks ? 'Y' : 'N',
        inv.matchStatus,
        inv.matchBasis,
        inv.mismatchReasons.join('; ') + ' ' + inv.remarks,
        inv.carriedForwardAge,
    ].map(val => `"${val ?? ''}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
};

export const exportToCsv = (data: UnifiedInvoice[], filename: string) => {
    const csvString = convertToCSV(data);
    if (!csvString) return;

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

const PURCHASE_REGISTER_TEMPLATE = [
    "Supplier Name,GSTIN,Doc Type,Doc No,Date,Taxable Value,IGST,CGST,SGST,Cess",
    `"ABC Corp","29AABCU9567L1Z1","INV","INV/001","01-04-2024","10000.00","1800.00","0.00","0.00","0.00"`,
    `"XYZ Pvt Ltd","","INV","B2B/567","02-04-2024","5000.00","0.00","450.00","450.00","0.00"`,
].join('\n');

export const downloadCsvTemplate = () => {
    const filename = 'purchase_register_template.csv';
    const blob = new Blob([PURCHASE_REGISTER_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

const GSTR2B_TEMPLATE = [
    "Supplier Name,GSTIN,Doc Type,Doc No,Date,Taxable Value,IGST,CGST,SGST,Cess,Reverse Charge",
    `"ABC Corp","29AABCU9567L1Z1","INV","GST/B2B/001","15-04-2024","25000.00","4500.00","0.00","0.00","0.00","N"`,
    `"DEF Logistics","27ADEFG1234H1Z5","INV","RCM/001","18-04-2024","12000.00","0.00","1080.00","1080.00","0.00","Y"`,
].join('\n');

export const downloadGstr2bTemplate = () => {
    const filename = 'gstr2b_template.csv';
    const blob = new Blob([GSTR2B_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};