import { PLURequest } from '@prisma/client';

const CSV_HEADERS = [
  'Active',
  'Code',
  'Name',
  'Category',
  'Department',
  'SalesDef',
  'Price',
  'PLU',
  'Barcode',
  'UOM',
  'Folder',
  'ServiceCharge',
  'Tax1',
  'Tax2',
  'NoDiscount',
  'HideReceipt',
  'Printers',
  'Outlets',
];

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCSV(requests: PLURequest[]): string {
  const rows = requests.map((r) => [
    '1',
    r.code ?? '',
    r.name,
    r.category,
    r.department,
    r.salesDef,
    r.price != null ? String(r.price) : '',
    '',
    '',
    '',
    r.folder ?? '',
    r.serviceCharge ? '1' : '0',
    r.tax1 ? '1' : '0',
    r.tax2 ? '1' : '0',
    r.noDiscount ? '1' : '0',
    r.hideReceipt ? '1' : '0',
    r.printers,
    r.outlets,
  ]);

  const lines = [
    CSV_HEADERS.join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ];

  return lines.join('\n');
}
