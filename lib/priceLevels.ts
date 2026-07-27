// Parser for the Quinos PriceLevels field. Stored as a raw semicolon-delimited
// string of entries in the form  OutletType:OutletGroup:Price
// e.g. "DINE IN:CSPI+CSPI-B:1100000;TAKE AWAY:CSPI:1100000".
//
// Quinos POS reads Price Levels *before* the flat Price when present, so a flat
// Price update can silently fail to change what customers are actually charged
// for any item that has a non-zero override here. This parser feeds the
// "PRICE LEVELS ACTIVE" warning shown during price-change imports.

export interface PriceLevelEntry {
  outletType: string;
  outletGroup: string;
  price: number;
}

export interface PriceLevelsInfo {
  entries: PriceLevelEntry[];
  // True when at least one entry has a non-zero price - i.e. a real override
  // that the flat Price update will NOT affect.
  hasActiveOverride: boolean;
}

// Parse a single entry "OutletType:OutletGroup:Price". The price is the LAST
// colon-separated segment; outlet type/group may themselves contain spaces or
// "+" (e.g. "CSPI+CSPI-B") but not colons, so a 3-way split from the right is safe.
function parseEntry(raw: string): PriceLevelEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length < 3) return null;
  const priceStr = parts[parts.length - 1].trim();
  const price = Number(priceStr.replace(/[^0-9.-]/g, ''));
  return {
    outletType: parts[0].trim(),
    outletGroup: parts.slice(1, parts.length - 1).join(':').trim(),
    price: Number.isFinite(price) ? price : 0,
  };
}

export function parsePriceLevels(raw: string | null | undefined): PriceLevelsInfo {
  if (!raw || !raw.trim()) return { entries: [], hasActiveOverride: false };
  const entries: PriceLevelEntry[] = [];
  for (const chunk of raw.split(';')) {
    const entry = parseEntry(chunk);
    if (entry) entries.push(entry);
  }
  return {
    entries,
    hasActiveOverride: entries.some((e) => e.price !== 0),
  };
}
