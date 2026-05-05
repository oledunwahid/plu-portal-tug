export type OutletGroup = 'UNION' | 'CNS' | 'FRENCH' | 'IBR';

export const OUTLET_TO_GROUP: Record<string, OutletGroup> = {
  UTP: 'UNION', UPKW: 'UNION', UPS: 'UNION', USC: 'UNION', UCP: 'UNION',
  UGI: 'UNION', UPIM: 'UNION', UPIK: 'UNION', UMKG: 'UNION', USMS: 'UNION',
  'UCP-B': 'UNION', 'UPS-B': 'UNION', 'USC-B': 'UNION', 'UPIK-B': 'UNION', 'UMKG-B': 'UNION',

  CSPI: 'CNS', CSPP: 'CNS', CSSG: 'CNS',
  'CSPI-B': 'CNS', 'CSPP-B': 'CNS', 'CSSG-B': 'CNS',

  'LWY-OAK': 'FRENCH', 'LWY-OAK-B': 'FRENCH',
  'BAB-SEN': 'FRENCH', 'BAB-SEN-B': 'FRENCH',
  'PIE-SNPT': 'FRENCH', 'PIE-SNPT-B': 'FRENCH',

  ROMSCBD: 'IBR', ROMPIM: 'IBR', BISSCBD: 'IBR', BISPIK: 'IBR',
  MILGI: 'IBR', MILPIK: 'IBR',
};

export const OUTLETS_BY_GROUP: Record<OutletGroup, string[]> = {
  UNION: ['UTP','UPKW','UPS','USC','UCP','UGI','UPIM','UPIK','UMKG','USMS','UCP-B','UPS-B','USC-B','UPIK-B','UMKG-B'],
  CNS:   ['CSPI','CSPP','CSSG','CSPI-B','CSPP-B','CSSG-B'],
  FRENCH: ['LWY-OAK','LWY-OAK-B','BAB-SEN','BAB-SEN-B','PIE-SNPT','PIE-SNPT-B'],
  IBR:   ['ROMSCBD','ROMPIM','BISSCBD','BISPIK','MILGI','MILPIK'],
};

export const ALL_OUTLETS = Object.keys(OUTLET_TO_GROUP);

export const MILAN_OUTLETS = ['MILGI', 'MILPIK'];

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
