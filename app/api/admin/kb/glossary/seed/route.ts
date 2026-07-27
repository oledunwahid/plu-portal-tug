import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { countGlossaryEntries, bulkInsertGlossaryEntries } from '@/lib/db';
import { CATEGORY_CODE_MAP } from '@/lib/pluCode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRINTER_ENTRIES = [
  { term: 'KITCHEN1', definition: 'Main kitchen production printer. Receives all standard food tickets.' },
  { term: 'KITCHEN2', definition: 'Secondary kitchen printer. Used for hot section or overflow.' },
  { term: 'KITCHEN3', definition: 'Third kitchen line. Typically pastry or cold section.' },
  { term: 'KITCHEN4', definition: 'Fourth kitchen zone. Large kitchens only.' },
  { term: 'KITCHEN5', definition: 'Fifth kitchen zone.' },
  { term: 'KITCHEN6', definition: 'Sixth kitchen zone.' },
  { term: 'CK KITCHEN', definition: 'Central kitchen main printer.' },
  { term: 'CK KITCHEN 2', definition: 'Central kitchen secondary printer.' },
  { term: 'CK BAR', definition: 'Central kitchen bar printer.' },
  { term: 'BAR', definition: 'Main bar printer. Receives all beverage tickets.' },
  { term: 'BAR2', definition: 'Second bar station.' },
  { term: 'BAR3', definition: 'Third bar station. Back bar or lounge.' },
  { term: 'BAR4', definition: 'Fourth bar station.' },
  { term: 'BAR5', definition: 'Fifth bar station.' },
  { term: 'BAR6', definition: 'Sixth bar station.' },
  { term: 'BL', definition: 'Bill printer / billing station.' },
  { term: 'BILL', definition: 'Alternate bill printer.' },
  { term: 'PIZZA', definition: 'Dedicated pizza station printer.' },
  { term: 'PASTRY', definition: 'Pastry station printer. Desserts and pastry items.' },
  { term: 'DESSERT', definition: 'Dessert plating station.' },
  { term: 'DESSERT2', definition: 'Second dessert station.' },
  { term: 'DESSERT3', definition: 'Third dessert station.' },
  { term: 'WINE', definition: 'Wine station printer. Wine orders routed here.' },
  { term: 'WINE2', definition: 'Second wine station.' },
  { term: 'CIGAR', definition: 'Cigar lounge printer.' },
  { term: 'CIGAR2', definition: 'Second cigar station.' },
  { term: 'EVENT', definition: 'Event space printer.' },
  { term: 'EVENT2', definition: 'Second event space printer.' },
  { term: 'EVENT3', definition: 'Third event space printer.' },
];

const OUTLET_ENTRIES = [
  { term: 'ROMSCBD', definition: 'Roma SCBD - IBR Group', grp: 'IBR' },
  { term: 'ROMPIM', definition: 'Roma PIK - IBR Group', grp: 'IBR' },
  { term: 'BISSCBD', definition: 'Bistecca SCBD - IBR Group', grp: 'IBR' },
  { term: 'BISPIK', definition: 'Bistecca PIK - IBR Group', grp: 'IBR' },
  { term: 'MILGI', definition: 'Milano Grand Indonesia - IBR Group (MIL prefix)', grp: 'IBR' },
  { term: 'MILPIK', definition: 'Milano PIK - IBR Group (MIL prefix)', grp: 'IBR' },
  { term: 'UTP', definition: 'Union Tunjungan Plaza - Union Group', grp: 'UNION' },
  { term: 'UPKW', definition: 'Union Pakuwon - Union Group', grp: 'UNION' },
  { term: 'UPS', definition: 'Union Pondok Indah - Union Group', grp: 'UNION' },
  { term: 'USC', definition: 'Union Senayan City - Union Group', grp: 'UNION' },
  { term: 'UCP', definition: 'Union Central Park - Union Group', grp: 'UNION' },
  { term: 'UGI', definition: 'Union Grand Indonesia - Union Group', grp: 'UNION' },
  { term: 'UPIM', definition: 'Union PIM - Union Group', grp: 'UNION' },
  { term: 'UPIK', definition: 'Union PIK - Union Group', grp: 'UNION' },
  { term: 'UMKG', definition: 'Union MKG - Union Group', grp: 'UNION' },
  { term: 'USMS', definition: 'Union SMS - Union Group', grp: 'UNION' },
  { term: 'UCP-B', definition: 'Union Central Park (Internal) - Union Group', grp: 'UNION' },
  { term: 'UPS-B', definition: 'Union Pondok Indah (Internal) - Union Group', grp: 'UNION' },
  { term: 'USC-B', definition: 'Union Senayan City (Internal) - Union Group', grp: 'UNION' },
  { term: 'UPIK-B', definition: 'Union PIK (Internal) - Union Group', grp: 'UNION' },
  { term: 'UMKG-B', definition: 'Union MKG (Internal) - Union Group', grp: 'UNION' },
  { term: 'CSPI', definition: 'CNS Plaza Indonesia - CNS Group', grp: 'CNS' },
  { term: 'CSPP', definition: 'CNS Pacific Place - CNS Group', grp: 'CNS' },
  { term: 'CSSG', definition: 'CNS Senayan Country Club - CNS Group', grp: 'CNS' },
  { term: 'CSPI-B', definition: 'CNS Plaza Indonesia (Internal) - CNS Group', grp: 'CNS' },
  { term: 'CSPP-B', definition: 'CNS Pacific Place (Internal) - CNS Group', grp: 'CNS' },
  { term: 'CSSG-B', definition: 'CNS Senayan Country Club (Internal) - CNS Group', grp: 'CNS' },
  { term: 'BLCS', definition: 'Barluca SCBD - CNS Group (BLC prefix)', grp: 'CNS' },
  { term: 'LWY-OAK', definition: 'Loewy Oak - French Group', grp: 'FRENCH' },
  { term: 'LWY-OAK-B', definition: 'Loewy Oak (Internal) - French Group', grp: 'FRENCH' },
  { term: 'BAB-SEN', definition: 'Bouchon Senopati - French Group (BCH prefix)', grp: 'FRENCH' },
  { term: 'BAB-SEN-B', definition: 'Bouchon Senopati (Internal) - French Group (BCH prefix)', grp: 'FRENCH' },
  { term: 'PIE-SNPT', definition: 'Pieree Senopati - French Group (PIE prefix)', grp: 'FRENCH' },
  { term: 'PIE-SNPT-B', definition: 'Pieree Senopati (Internal) - French Group (PIE prefix)', grp: 'FRENCH' },
  { term: 'IND1', definition: 'Salira Senopati - IND1 GROUP', grp: 'IND1' },
];

const GENERAL_ENTRIES = [
  { term: 'TUG Code', definition: 'A group-level PLU code used for items sold across multiple outlets simultaneously. Prefix TUG. Automatically assigned for Alcoholic Beverages, Non Alcoholic Beverages, Wine, Cigar-ettes, and Miscellaneous categories.' },
  { term: 'PLU Code', definition: 'Price Look-Up code. A unique 16-character identifier for every item in the Quinos POS system. Format: PREFIX(3) + DEPT(2) + CAT(3) + SEQ(8).' },
  { term: 'Sequence Number', definition: 'The last 8 digits of a PLU code. Codes generated by this portal start at sequence 4000 to distinguish them from pre-existing Quinos items.' },
  { term: 'NEW ITEM Request', definition: 'A cashier request to add a brand new item to the POS. Exported as XLSX for admin to verify codes in Quinos before CSV import.' },
  { term: 'UPDATE PRICE', definition: "A cashier request to change an existing item's price. Requires the existing PLU code. Exported as Quinos-compatible CSV." },
  { term: 'DONE Status', definition: 'A request that has been reviewed and approved by admin. Included in CSV export for Quinos import.' },
  { term: 'PENDING Status', definition: 'A request submitted by a cashier awaiting admin review.' },
  { term: 'PriceLevels', definition: 'A Quinos field for price tier configuration. Left blank in exports - admin fills manually in Quinos after import.' },
  { term: 'SalesDef', definition: 'Always set to "SALES" in Quinos. Defines the transaction type for the item.' },
  { term: 'codeIsAutoGenerated', definition: 'Internal flag. AUTO means the PLU code was system-generated. MANUAL means the cashier overrode the suggestion.' },
];

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existing = await countGlossaryEntries();
    if (existing > 0) {
      return NextResponse.json({ message: 'Already seeded', count: existing });
    }

    const entries: { type: string; term: string; definition: string; grp?: string | null; isSeeded: boolean }[] = [];

    // Category entries from CATEGORY_CODE_MAP
    for (const cat of CATEGORY_CODE_MAP) {
      const deptCode = String(cat.departmentCode).padStart(2, '0');
      const catCode = String(cat.categoryCode).padStart(3, '0');
      entries.push({
        type: 'CATEGORY',
        term: cat.category,
        definition: `[${cat.department} dept] Dept code: ${deptCode}, Cat code: ${catCode}. ${cat.category} category items.`,
        grp: cat.department,
        isSeeded: true,
      });
    }

    // Printer entries
    for (const p of PRINTER_ENTRIES) {
      entries.push({ type: 'PRINTER', term: p.term, definition: p.definition, grp: null, isSeeded: true });
    }

    // Outlet entries
    for (const o of OUTLET_ENTRIES) {
      entries.push({ type: 'OUTLET', term: o.term, definition: o.definition, grp: o.grp ?? null, isSeeded: true });
    }

    // General entries
    for (const g of GENERAL_ENTRIES) {
      entries.push({ type: 'GENERAL', term: g.term, definition: g.definition, grp: null, isSeeded: true });
    }

    const count = await bulkInsertGlossaryEntries(entries);
    return NextResponse.json({ message: 'Seeded successfully', count });
  } catch (err) {
    console.error('[POST /api/admin/kb/glossary/seed]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
