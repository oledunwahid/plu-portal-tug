/**
 * Spreadsheet reading for the wine import. Server-only (uses Buffer + SheetJS).
 *
 * Both CSV and XLSX are supported because `xlsx` (SheetJS) is already the portal's spreadsheet
 * dependency for every other import/export - no new package was added for this.
 */

import * as XLSX from 'xlsx';
import type { RawImportRow } from './wineImport';

export interface ParsedSheet {
  sheetNames: string[];
  sheetName: string;
  headers: string[];
  rows: RawImportRow[];
}

const MAX_ROWS = 20000;

/**
 * Reads an uploaded file into headers + raw rows.
 *
 * `raw: false` makes SheetJS hand back formatted strings, which keeps a vintage cell as "2018"
 * instead of a date-coerced value; parsing back to numbers is done deliberately in lib/wineImport.
 */
export function parseWineImportFile(buffer: Buffer, sheetName?: string): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) throw new Error('File tidak memiliki sheet.');

  const chosen = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
  const sheet = workbook.Sheets[chosen];
  if (!sheet) throw new Error(`Sheet "${chosen}" tidak ditemukan.`);

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  if (matrix.length === 0) throw new Error('Sheet kosong.');

  const headerRow = matrix[0] ?? [];
  const headers: string[] = [];
  headerRow.forEach((cell, index) => {
    const label = String(cell ?? '').trim();
    // Unnamed columns still need a stable key so a mapping can point at them.
    headers.push(label || `Column ${index + 1}`);
  });

  const rows: RawImportRow[] = [];
  for (let i = 1; i < matrix.length && rows.length < MAX_ROWS; i += 1) {
    const line = matrix[i] ?? [];
    const values: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      const cell = line[index];
      values[header] = cell;
      if (String(cell ?? '').trim() !== '') hasValue = true;
    });
    if (!hasValue) continue;
    // rowNumber is the file's own row number (1 = first data row) so the error report matches the file.
    rows.push({ rowNumber: i, values });
  }

  return { sheetNames, sheetName: chosen, headers, rows };
}
