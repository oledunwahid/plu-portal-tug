import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// All printers that should be available to every outlet group.
// These were previously seeded with function-type groups (Kitchen, Bar, etc.).
// Setting them to 'ALL' makes them appear in all cashier forms.
const UNIVERSAL_PRINTERS = [
  'KITCHEN1', 'KITCHEN2', 'KITCHEN3', 'KITCHEN4', 'KITCHEN5', 'KITCHEN6',
  'CK KITCHEN', 'CK KITCHEN 2', 'CK BAR',
  'BAR', 'BAR2', 'BAR3', 'BAR4', 'BAR5', 'BAR6',
  'BL', 'BILL', 'PIZZA', 'PASTRY',
  'DESSERT', 'DESSERT2', 'DESSERT3',
  'WINE', 'WINE2',
  'CIGAR', 'CIGAR2',
  'EVENT', 'EVENT2', 'EVENT3',
];

async function main() {
  let updated = 0;
  for (const name of UNIVERSAL_PRINTERS) {
    const result = await prisma.printerConfig.updateMany({
      where: { name },
      data: { group: 'ALL' },
    });
    updated += result.count;
  }
  console.log(`Updated ${updated} printer(s) to group=ALL`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
