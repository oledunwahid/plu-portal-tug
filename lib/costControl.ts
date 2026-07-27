// Cost Control approval stage - routing predicate + barcode auto-derivation.
//
// Scope: this stage activates ONLY for a NEW_ITEM request, in the WINE department, submitted by a
// cashier at a Cork outlet (see lib/outlets.ts CORK_OUTLETS). Every other request type/department/
// outlet combination is completely unaffected and follows the normal PENDING → DONE flow.
//
// Pure functions only (no DB import) so they can be unit tested; the submission route feeds in the
// SAP refs it loaded via getAllSapItemsForMatch().

import { isCorkOutlet } from './outlets';
import { isWineDepartment } from './wineChecks';
import { isNckCode } from './barcode';

// The status a routed request enters at creation, instead of PENDING.
export const STATUS_PENDING_COST_CONTROL = 'PENDING_COST_CONTROL';

// "Wine Event" items do not need a barcode, so they never generate a suggestedBarcode, never consume
// the NCK suffix sequence, and bypass cost control (which exists to verify barcodes).
export function isWineEventCategory(category: string | null | undefined): boolean {
  return String(category ?? '').trim().toLowerCase() === 'wine event';
}

// True when a request must enter the cost-control stage rather than going straight to admin.
export function shouldRouteToCostControl(
  requestType: string,
  department: string,
  cashierOutlet: string,
  category?: string | null,
): boolean {
  return (
    requestType === 'NEW_ITEM' &&
    isWineDepartment(department) &&
    isCorkOutlet(cashierOutlet) &&
    !isWineEventCategory(category)
  );
}

type MaybeString = string | null | undefined;

export interface SapItemRef {
  itemNo: string;
  description: string;
}

export interface BarcodeOccupancyRefs {
  masterBarcodes?: MaybeString[];
  pluSuggestedBarcodes?: MaybeString[];
  extraBarcodes?: MaybeString[];
}

export interface SuggestedBarcodeResult {
  value: string | null;
  source: string | null;
}

// Human-readable source labels surfaced to cost control under the barcode field.
export const BARCODE_SOURCE_NCK_SEQ = 'Dibuat otomatis dari SAP NCK suffix 11';
export const BARCODE_SOURCE_AUTO = 'Dibuat otomatis - verifikasi sebelum konfirmasi';
// Cashier supplied the barcode - it is trusted verbatim, no derivation ran. Labelled so the review
// modal's source line stays accurate (otherwise a null source reads as "not found - fill manually").
export const BARCODE_SOURCE_CASHIER = 'Barcode dari kasir';

function digitsOnly(value: MaybeString): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits || null;
}

// Canonical barcode for a SAP item number.
// NCK:     "31515607(NCK)" → "3151560711"
// Non-NCK: "31515607"      → "31515607"
export function normalizeSapNckToBarcode(itemNo: string): string | null {
  const base = itemNo.replace(/\(NCK\)/gi, '').replace(/\D/g, '');
  if (!base) return null;
  return isNckCode(itemNo) ? `${base}11` : base;
}

// Highest numeric SAP NCK base.
// Example: "31515607(NCK)" → 31515607
export function latestNckSequence(saps: SapItemRef[]): number {
  let max = 0;

  for (const sap of saps) {
    if (!isNckCode(sap.itemNo)) continue;

    const base = digitsOnly(sap.itemNo.replace(/\(NCK\)/gi, ''));
    if (!base) continue;

    const numericBase = parseInt(base, 10);
    if (!Number.isNaN(numericBase) && numericBase > max) {
      max = numericBase;
    }
  }

  return max;
}

function addOccupiedBarcode(set: Set<string>, value: MaybeString): void {
  const barcode = digitsOnly(value);
  if (barcode) set.add(barcode);
}

export function buildOccupiedBarcodeSet(
  saps: SapItemRef[],
  refs: BarcodeOccupancyRefs = {},
): Set<string> {
  const occupied = new Set<string>();

  for (const sap of saps) {
    addOccupiedBarcode(occupied, normalizeSapNckToBarcode(sap.itemNo));
  }

  for (const barcode of refs.masterBarcodes ?? []) {
    addOccupiedBarcode(occupied, barcode);
  }

  for (const barcode of refs.pluSuggestedBarcodes ?? []) {
    addOccupiedBarcode(occupied, barcode);
  }

  for (const barcode of refs.extraBarcodes ?? []) {
    addOccupiedBarcode(occupied, barcode);
  }

  return occupied;
}

// Duplicate-safe NCK fallback.
// If SAP latest is 31515607(NCK), SAP already occupies 3151560711,
// so the first free fallback should be 3151560811.
export function nextFreeNckSuffixBarcode(
  latestNckBase: number,
  occupiedBarcodes: Set<string>,
): string | null {
  if (latestNckBase <= 0) return null;

  let base = latestNckBase;

  for (let guard = 0; guard < 100000; guard += 1) {
    const candidate = `${base}11`;

    if (!occupiedBarcodes.has(candidate)) {
      return candidate;
    }

    base += 1;
  }

  throw new Error('Unable to generate a free SAP NCK suffix-11 barcode after 100000 attempts.');
}

// Full suggestion flow. A new PLU is NEVER handed a barcode already occupied by SAP, a MasterItem,
// or a prior PLURequest suggestion - even when its name matches an existing SAP NCK item, because
// that item's own barcode is part of occupiedAll. It always gets the next free suffix-11 value.
// 1. Latest SAP NCK base → next free `${base}11`, skipping occupied values.
// 2. No SAP NCK → max existing barcode + 1, also collision-safe.
// 3. Nothing found → null, modal shows "TIDAK DITEMUKAN - ISI MANUAL".
//
// itemName is retained in the signature for call-site stability and possible future name-based
// heuristics, though the current flow derives the barcode purely from SAP sequence + occupancy.
export function suggestBarcode(
  _itemName: string,
  saps: SapItemRef[],
  maxExistingBarcode: number,
  occupancy: BarcodeOccupancyRefs = {},
): SuggestedBarcodeResult {
  const occupiedAll = buildOccupiedBarcodeSet(saps, occupancy);

  const latestNckBase = latestNckSequence(saps);
  const nextNck = nextFreeNckSuffixBarcode(latestNckBase, occupiedAll);

  if (nextNck) {
    return {
      value: nextNck,
      source: BARCODE_SOURCE_NCK_SEQ,
    };
  }

  if (maxExistingBarcode > 0) {
    let candidate = maxExistingBarcode + 1;

    for (let guard = 0; guard < 100000; guard += 1) {
      const candidateString = String(candidate);

      if (!occupiedAll.has(candidateString)) {
        return {
          value: candidateString,
          source: BARCODE_SOURCE_AUTO,
        };
      }

      candidate += 1;
    }

    throw new Error('Unable to generate a free auto barcode after 100000 attempts.');
  }

  return {
    value: null,
    source: null,
  };
}