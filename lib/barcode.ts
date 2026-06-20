// Shared NCK barcode derivation. Quinos wine barcodes are derived from SAP NCK
// item codes: take the digits-only of the code and suffix "11".
// e.g. "3151476(NCK)" → "315147611". Only codes flagged "(NCK)" qualify.
//
// Lifted from app/admin/kb/barcode/page.tsx so the server-side dual-lookup
// (lib match-batch route) and the client share one implementation.

// True when the SAP code carries the "(NCK)" marker that means a barcode can be derived.
export function isNckCode(code: string): boolean {
  return code.toUpperCase().includes('(NCK)');
}

// digits-only of the NCK code, suffixed with "11" — e.g. "3151476(NCK)" → "315147611".
export function deriveNckBarcode(code: string): string {
  return code.replace(/\D/g, '') + '11';
}

// Returns the derived barcode for an NCK code, or null when the code is not an
// NCK code (no barcode can be derived) or has no digits at all.
export function deriveBarcodeFromSapCode(code: string | null | undefined): string | null {
  if (!code) return null;
  if (!isNckCode(code)) return null;
  const derived = deriveNckBarcode(code);
  // "11" alone means the code had no digits — not a real barcode.
  return derived.length > 2 ? derived : null;
}
