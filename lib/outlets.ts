export type OutletGroup = 'UNION' | 'CNS' | 'FRENCH' | 'IBR' | 'IND';

export const OUTLET_TO_GROUP: Record<string, OutletGroup> = {
  UTP: 'UNION', UPKW: 'UNION', UPS: 'UNION', USC: 'UNION', UCP: 'UNION',
  UGI: 'UNION', UPIM: 'UNION', UPIK: 'UNION', UMKG: 'UNION', USMS: 'UNION', UMPI: 'UNION',
  'UCP-B': 'UNION', 'UPS-B': 'UNION', 'USC-B': 'UNION', 'UPIK-B': 'UNION', 'UMKG-B': 'UNION', 'UMPI-B': 'UNION',

  CSPI: 'CNS', CSPP: 'CNS', CSSG: 'CNS',
  'CSPI-B': 'CNS', 'CSPP-B': 'CNS', 'CSSG-B': 'CNS',
  BLCS: 'CNS',

  'LWY-OAK': 'FRENCH', 'LWY-OAK-B': 'FRENCH',
  'BAB-SEN': 'FRENCH', 'BAB-SEN-B': 'FRENCH',
  'PIE-SNPT': 'FRENCH', 'PIE-SNPT-B': 'FRENCH',

  ROMSCBD: 'IBR', ROMPIM: 'IBR', BISSCBD: 'IBR', BISPIK: 'IBR',
  MILGI: 'IBR', MILPIK: 'IBR', 'BISSCBD-B': 'IBR',

  IND1: 'IND',
};

export const OUTLETS_BY_GROUP: Record<OutletGroup, string[]> = {
  UNION: ['UTP','UPKW','UPS','USC','UCP','UGI','UPIM','UPIK','UMKG','USMS','UMPI','UCP-B','UPS-B','USC-B','UPIK-B','UMKG-B','UMPI-B'],
  CNS:   ['CSPI','CSPP','CSSG','CSPI-B','CSPP-B','CSSG-B','BLCS'],
  FRENCH: ['LWY-OAK','LWY-OAK-B','BAB-SEN','BAB-SEN-B','PIE-SNPT','PIE-SNPT-B'],
  IBR:   ['ROMSCBD','ROMPIM','BISSCBD','BISPIK','MILGI','MILPIK','BISSCBD-B'],
  IND:   ['IND1'],
};

export const ALL_OUTLETS = Object.keys(OUTLET_TO_GROUP);

export const MILAN_OUTLETS = ['MILGI', 'MILPIK'];

// "Cork" outlets - the CNS wine-bar outlets whose WINE NEW_ITEM requests route through the
// Cost Control approval stage. NOTE: BLCS is a CNS outlet but is NOT a Cork outlet (excluded).
// Mirrors the CORK_OUTLETS set used for NEW_ITEM price-level pre-population in lib/export.ts.
export const CORK_OUTLETS = ['CSPP', 'CSPI', 'CSSG', 'CSPP-B', 'CSPI-B', 'CSSG-B'];

// Case-insensitive + trimmed so a stored outlet like " cspp " or "cspp" still matches. The exact
// codes are uppercase, but cashier/session outlet values shouldn't fail the Cost Control trigger
// over casing or stray whitespace.
const CORK_OUTLET_SET = new Set(CORK_OUTLETS.map((o) => o.toUpperCase()));

export function isCorkOutlet(outlet: string | null | undefined): boolean {
  return CORK_OUTLET_SET.has(String(outlet ?? '').trim().toUpperCase());
}

export const ALL_PRINTERS: string[] = [
  'KITCHEN1','KITCHEN2','KITCHEN3','KITCHEN4','KITCHEN5','KITCHEN6',
  'CK KITCHEN','CK KITCHEN 2','CK BAR',
  'BAR','BAR2','BAR3','BAR4','BAR5','BAR6',
  'BL','BILL','PIZZA','PASTRY',
  'DESSERT','DESSERT2','DESSERT3',
  'WINE','WINE2',
  'CIGAR','CIGAR2',
  'EVENT','EVENT2','EVENT3',
];

export const PRINTERS_BY_GROUP: Record<OutletGroup, string[]> = {
  UNION: [
    'KITCHEN1','KITCHEN2','KITCHEN3','CK KITCHEN','CK KITCHEN 2','CK BAR',
    'BAR','BAR2','BAR3','BL','BILL','DESSERT','WINE','EVENT','EVENT2','PASTRY',
  ],
  CNS: [
    'KITCHEN1','KITCHEN2','KITCHEN3','CK KITCHEN','CK BAR',
    'BAR','BAR2','BL','BILL','DESSERT','PASTRY','WINE','EVENT','CIGAR',
  ],
  FRENCH: [
    'KITCHEN1','KITCHEN2','KITCHEN3','KITCHEN4','CK KITCHEN','CK KITCHEN 2','CK BAR',
    'BAR','BAR2','BAR3','BAR4','BAR5','BAR6','BL','BILL',
    'PASTRY','DESSERT','DESSERT2','WINE','WINE2','CIGAR','CIGAR2','EVENT','EVENT2','EVENT3',
  ],
  IBR: [
    'KITCHEN1','KITCHEN2','KITCHEN3','KITCHEN4','KITCHEN5','KITCHEN6',
    'CK KITCHEN','CK KITCHEN 2','CK BAR',
    'BAR','BAR2','BAR3','BAR4','BAR5','BAR6','BL','BILL','PIZZA',
    'PASTRY','DESSERT','DESSERT2','DESSERT3','WINE','WINE2',
    'CIGAR','CIGAR2','EVENT','EVENT2','EVENT3',
  ],
  IND: [
    'KITCHEN1','KITCHEN2','KITCHEN3',
    'BAR','BAR2','BL','BILL',
    'DESSERT','WINE','EVENT',
  ],
};

export const PRINTER_GROUPS: { label: string; printers: string[] }[] = [
  { label: 'Kitchen', printers: ['KITCHEN1','KITCHEN2','KITCHEN3','KITCHEN4','KITCHEN5','KITCHEN6','CK KITCHEN','CK KITCHEN 2','PIZZA','PASTRY'] },
  { label: 'Bar', printers: ['BAR','BAR2','BAR3','BAR4','BAR5','BAR6','CK BAR','WINE','WINE2'] },
  { label: 'Service', printers: ['BL','BILL','DESSERT','DESSERT2','DESSERT3'] },
  { label: 'Specialty', printers: ['CIGAR','CIGAR2'] },
  { label: 'Event', printers: ['EVENT','EVENT2','EVENT3'] },
];

export function getOutletGroup(outlet: string): OutletGroup {
  return OUTLET_TO_GROUP[outlet] ?? 'UNION';
}

// Admin-side outlet rename (display + export only). A cashier selects BISPIK and/or MILPIK (both
// IBR) as distinct outlets, but admin/export always presents either as the combined outlet
// "MILBISPIK": selecting BISPIK alone → MILBISPIK, MILPIK alone → MILBISPIK, both → a single
// MILBISPIK (de-duplicated). Other outlets and order are preserved. Cashier-facing views are
// intentionally NOT passed through this - they keep the raw selections.
export function collapseAdminOutlets(outlets: string): string {
  if (!outlets) return outlets;
  const tokens = outlets.split(';').map((t) => t.trim()).filter(Boolean);
  const result: string[] = [];
  for (const t of tokens) {
    const mapped = (t === 'BISPIK' || t === 'MILPIK') ? 'MILBISPIK' : t;
    if (!result.includes(mapped)) result.push(mapped);
  }
  return result.join(';');
}
