import * as XLSX from 'xlsx';

// Constant for the 18 required headers in specific order
const EXPORT_HEADERS = [
  'Active', 'Code', 'Name', 'Category', 'Department', 'SalesDef',
  'Price', 'PLU', 'Barcode', 'UOM', 'Folder', 'ServiceCharge',
  'Tax1', 'Tax2', 'NoDiscount', 'HideReceipt', 'Printers', 'Outlets',
];

interface RequestRow {
  id: string;
  requestType: string;
  status: string;
  code: string | null;
  name: string;
  category: string;
  department: string;
  price: number | null;
  folder: string | null;
  serviceCharge: boolean;
  tax1: boolean;
  tax2: boolean;
  noDiscount: boolean;
  hideReceipt: boolean;
  printers: string;
  outlets: string;
  salesDef: string;
  remarks: string | null;
  cashierOutlet: string;
  outletGroup: string;
  createdAt: Date;
}

interface BatchItemRow extends Omit<RequestRow, 'id' | 'status' | 'requestType' | 'remarks' | 'cashierOutlet' | 'outletGroup' | 'createdAt'> {
  batchTitle: string;
}

/**
 * Updated XLSX Generator for New Items
 * Criterias: Adds 'Active' column as '1' and follows exact header order.
 */
export function generateNewItemXLSX(requests: RequestRow[]): Buffer {
  const rows = requests.map((r) => ({
    Active: '1',
    Code: r.code ?? '',
    Name: r.name,
    Category: r.category,
    Department: r.department,
    SalesDef: r.salesDef || '',
    Price: r.price ?? '',
    PLU: '',
    Barcode: '',
    UOM: '',
    Folder: r.folder ?? '',
    ServiceCharge: r.serviceCharge ? 1 : 0,
    Tax1: r.tax1 ? 1 : 0,
    Tax2: r.tax2 ? 1 : 0,
    NoDiscount: r.noDiscount ? 1 : 0,
    HideReceipt: r.hideReceipt ? 1 : 0,
    Printers: r.printers,
    Outlets: r.outlets,
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });

  // Auto-width adjustment
  ws['!cols'] = EXPORT_HEADERS.map(() => ({ wch: 15 }));
  ws['!cols'][2] = { wch: 30 }; // Name column wider

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'New Items');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Updated XLSX Generator for Batch Items
 */
export function generateBatchXLSX(items: BatchItemRow[]): Buffer {
  const rows = items.map((r) => ({
    Active: '1',
    Code: r.code ?? '',
    Name: r.name,
    Category: r.category,
    Department: r.department,
    SalesDef: r.salesDef || '',
    Price: r.price ?? '',
    PLU: '',
    Barcode: '',
    UOM: '',
    Folder: r.folder || r.batchTitle,
    ServiceCharge: r.serviceCharge ? 1 : 0,
    Tax1: r.tax1 ? 1 : 0,
    Tax2: r.tax2 ? 1 : 0,
    NoDiscount: r.noDiscount ? 1 : 0,
    HideReceipt: r.hideReceipt ? 1 : 0,
    Printers: r.printers,
    Outlets: r.outlets,
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  ws['!cols'] = EXPORT_HEADERS.map(() => ({ wch: 15 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Batch Items');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * CSV Generator for Batch Items (Uses the 18 criteria headers)
 */
export function generateBatchCSV(items: BatchItemRow[]): string {
  const rows = items.map((r) => [
    '1',
    r.code ?? '',
    r.name,
    r.category,
    r.department,
    r.salesDef || '',
    r.price != null ? String(r.price) : '',
    '', '', '',
    r.folder || r.batchTitle,
    r.serviceCharge ? '1' : '0',
    r.tax1 ? '1' : '0',
    r.tax2 ? '1' : '0',
    r.noDiscount ? '1' : '0',
    r.hideReceipt ? '1' : '0',
    r.printers,
    r.outlets,
  ]);
  return [
    EXPORT_HEADERS.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');
}

/**
 * CSV Generator for Single Done Requests
 */
export function generateDoneCSV(requests: RequestRow[]): string {
  const rows = requests.map((r) => [
    '1',
    r.code ?? '',
    r.name,
    r.category,
    r.department,
    r.salesDef || '',
    r.price != null ? String(r.price) : '',
    '', '', '',
    r.folder ?? '',
    r.serviceCharge ? '1' : '0',
    r.tax1 ? '1' : '0',
    r.tax2 ? '1' : '0',
    r.noDiscount ? '1' : '0',
    r.hideReceipt ? '1' : '0',
    r.printers,
    r.outlets,
  ]);

  return [
    EXPORT_HEADERS.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}