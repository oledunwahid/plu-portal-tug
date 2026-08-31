import { NextResponse } from 'next/server';

/**
 * Upload ceiling for the spreadsheet import endpoints.
 *
 * WHY THIS MATTERS HERE: the whole SQLite database is held in memory by sql.js, and
 * XLSX.read materialises the entire workbook plus a row-object array on top of the raw
 * buffer - so a single oversized upload can multiply into hundreds of MB and get the
 * process killed by cPanel's resource limits, taking the portal down for everyone.
 * 15 MB comfortably covers the real master-item exports (the largest observed are a few MB).
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function maxUploadMb(): number {
  return Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
}

/**
 * Returns a 413 response when the file exceeds the ceiling, or null when it is acceptable.
 * Call this immediately after pulling the File off the FormData and before arrayBuffer(),
 * so an oversized payload is never materialised.
 */
export function rejectOversizedUpload(file: File, message?: string): NextResponse | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  return NextResponse.json(
    { error: message ?? `File terlalu besar. Maksimal ${maxUploadMb()} MB.` },
    { status: 413 },
  );
}
