// Wine-only advisory checks layered on top of the standard import match cascade.
// Two independent checks, both detection-only (no auto-correction):
//
//   1. Barcode integrity — once a WINE row resolves to a Quinos master, look the
//      same item up in the SAP registry (fuzzy by name, since SAP item numbers
//      don't map 1:1 to Quinos codes), derive the SAP barcode, and compare it to
//      the Quinos master's stored barcode. Disagreement → BARCODE MISMATCH flag.
//   2. Price levels — if the matched master has any active (non-zero) price
//      level override, a flat Price update may not change the charged price.
//
// Pure functions (no DB import) so they can be unit tested; the route feeds in
// the SAP refs and master lookup.

import { parsePriceLevels } from './priceLevels';
import {
  diceCoefficient, normalizeText,
  type RowMatch, type MatchInput, type MasterRef,
  type BarcodeMismatch, type PriceLevelsWarning,
} from './itemMatch';

export interface SapRef {
  itemNo: string;
  description: string;
  barcode: string | null;
}

// Minimum name similarity for the best-match SAP suggestion to be surfaced.
const SAP_NAME_THRESHOLD = 0.5;
// Minimum similarity between a wine's name and the SAP item its barcode points
// at for the pointer to count as consistent. Same wine / different vintage
// (e.g. "Opus One 10" vs "Opus One Bordeaux Blend 2012") clears; a different
// wine entirely (≈0.1) does not. Tunable.
const POINTER_OK_THRESHOLD = 0.35;

export function isWineDepartment(department: string): boolean {
  return normalizeText(department).includes('wine');
}

// Digits-only comparison key for barcodes — strips formatting so "315147611"
// and " 315147611 " compare equal, and an empty value normalizes to ''.
function barcodeKey(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

// Resolve the comparable identifier from a SAP row. Verified against live data
// (List of Items-WINE.xlsx + Quinos master, Jun 2026): Quinos stores the SAP
// *Item Number* as the wine "barcode" (41/43 sampled items), NOT the commercial
// Bar Code EAN (2/43) nor the legacy "+11" NCK derivation (1/43). So we compare
// against the Item No. digits, with the "(NCK)" marker stripped — which collapses
// each plain/NCK SAP pair to the same value, removing name-match ambiguity.
export function resolveSapBarcode(sap: SapRef): string | null {
  const digits = barcodeKey(sap.itemNo);
  return digits || null;
}

// Best SAP match for a Quinos item name (fuzzy). Returns null below threshold.
function bestSapMatch(quinosName: string, saps: SapRef[]): { sap: SapRef; score: number } | null {
  const target = normalizeText(quinosName);
  if (!target) return null;
  let best: { sap: SapRef; score: number } | null = null;
  for (const sap of saps) {
    const score = diceCoefficient(target, normalizeText(sap.description));
    if (!best || score > best.score) best = { sap, score };
  }
  if (!best || best.score < SAP_NAME_THRESHOLD) return null;
  return best;
}

// Wine barcode-integrity check, anchored on the pointer Quinos actually stores
// (the SAP Item No.). Returns a flag only for a genuine integrity problem:
//   - the barcode resolves to a SAP item that is a *different* wine, or
//   - the barcode is not any SAP item number (orphan), while the wine itself
//     IS present in SAP by name (so we can suggest the correct item).
// A barcode that resolves to a SAP item with a matching name → null (clean).
// A wine absent from SAP entirely → null (per spec: not every item is in both).
export function checkWineBarcode(
  quinosName: string,
  quinosBarcode: string | null,
  saps: SapRef[],
): BarcodeMismatch | null {
  const qDigits = barcodeKey(quinosBarcode);
  if (!qDigits) return null; // no barcode to validate — identity check only

  const best = bestSapMatch(quinosName, saps);
  const suggestion = best
    ? { suggestedItemNo: best.sap.itemNo, suggestedDescription: best.sap.description, suggestedScore: best.score }
    : {};

  // Does the Quinos barcode resolve to a SAP item number?
  const resolved = saps.find((s) => barcodeKey(s.itemNo) === qDigits);
  if (resolved) {
    const sim = diceCoefficient(normalizeText(quinosName), normalizeText(resolved.description));
    if (sim >= POINTER_OK_THRESHOLD) return null; // pointer is consistent → clean
    return {
      quinosBarcode: quinosBarcode ?? null,
      kind: 'wrong-pointer',
      resolvedItemNo: resolved.itemNo,
      resolvedDescription: resolved.description,
      ...suggestion,
    };
  }

  // Orphan barcode. Only flag when the wine is otherwise present in SAP by name
  // (so the flag is actionable); a wine simply absent from SAP raises nothing.
  if (!best) return null;
  return {
    quinosBarcode: quinosBarcode ?? null,
    kind: 'orphan',
    ...suggestion,
  };
}

export function checkPriceLevels(priceLevels: string | null | undefined): PriceLevelsWarning | null {
  const info = parsePriceLevels(priceLevels);
  if (!info.hasActiveOverride) return null;
  return { entries: info.entries };
}

// Enrich match results in place with wine-only advisory flags. WINE rows only;
// non-wine rows are returned unchanged. `masterByCode` provides the full master
// (barcode + priceLevels) for any candidate code so fuzzy/ambiguous rows can
// carry per-candidate warnings.
export function annotateWineWarnings(
  inputs: MatchInput[],
  results: RowMatch[],
  masterByCode: Map<string, MasterRef>,
  saps: SapRef[],
): RowMatch[] {
  return results.map((result, i) => {
    const input = inputs[i];
    if (!input || !isWineDepartment(input.department)) return result;

    // Resolved exact match — annotate the RowMatch directly.
    if (result.master && result.resolvedCode) {
      const m = masterByCode.get(result.resolvedCode) ?? result.master;
      const barcodeMismatch = checkWineBarcode(m.name, m.barcode, saps) ?? undefined;
      const priceLevels = checkPriceLevels(m.priceLevels) ?? undefined;
      return { ...result, barcodeMismatch, priceLevels };
    }

    // Fuzzy / ambiguous — annotate each candidate so the warning follows the
    // identity the admin ultimately selects.
    if (result.candidates && result.candidates.length > 0) {
      const candidates = result.candidates.map((c) => {
        const m = masterByCode.get(c.code);
        if (!m) return c;
        const barcodeMismatch = checkWineBarcode(m.name, m.barcode, saps) ?? undefined;
        const priceLevels = checkPriceLevels(m.priceLevels) ?? undefined;
        return { ...c, barcodeMismatch, priceLevels };
      });
      return { ...result, candidates };
    }

    return result;
  });
}
