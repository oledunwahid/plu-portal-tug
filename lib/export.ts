import * as XLSX from 'xlsx';

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

export function generateNewItemXLSX(requests: RequestRow[]): Buffer {
  const rows = requests.map((r) => ({
    Name: r.name,
    Category: r.category,
    Department: r.department,
    Price: r.price ?? '',
    Folder: r.folder ?? '',
    ServiceCharge: r.serviceCharge ? 1 : 0,
    Tax1: r.tax1 ? 1 : 0,
    Tax2: r.tax2 ? 1 : 0,
    NoDiscount: r.noDiscount ? 1 : 0,
    HideReceipt: r.hideReceipt ? 1 : 0,
    Printers: r.printers,
    Outlets: r.outlets,
    'Submitted By': r.cashierOutlet,
    Date: r.createdAt instanceof Date ? r.createdAt.toISOString().slice(0, 10) : String(r.createdAt).slice(0, 10),
    Remarks: r.remarks ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = [
    { wch: 30 }, // Name
    { wch: 25 }, // Category
    { wch: 22 }, // Department
    { wch: 10 }, // Price
    { wch: 20 }, // Folder
    { wch: 14 }, // ServiceCharge
    { wch: 6 },  // Tax1
    { wch: 6 },  // Tax2
    { wch: 12 }, // NoDiscount
    { wch: 12 }, // HideReceipt
    { wch: 30 }, // Printers
    { wch: 30 }, // Outlets
    { wch: 14 }, // Submitted By
    { wch: 12 }, // Date
    { wch: 30 }, // Remarks
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'New Items');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

const CSV_HEADERS = [
  'Active', 'Code', 'Name', 'Category', 'Department', 'SalesDef',
  'Price', 'PLU', 'Barcode', 'UOM', 'Folder', 'ServiceCharge',
  'Tax1', 'Tax2', 'NoDiscount', 'HideReceipt', 'Printers', 'Outlets',
];

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateDoneCSV(requests: RequestRow[]): string {
  const rows = requests.map((r) => [
    '1',
    r.code ?? '',
    r.name,
    r.category,
    r.department,
    r.salesDef,
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
    CSV_HEADERS.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');
}
