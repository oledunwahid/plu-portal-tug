import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 12);
  const cashierHash = await bcrypt.hash('cashier123', 12);

  const users = [
    { email: 'admin@uniongroup.com', name: 'Admin', role: 'ADMIN', outlet: 'HEAD OFFICE', password: adminHash },
    { email: 'utp@uniongroup.com', name: 'Cashier UTP', role: 'CASHIER', outlet: 'UTP', password: cashierHash },
    { email: 'cspi@uniongroup.com', name: 'Cashier CSPI', role: 'CASHIER', outlet: 'CSPI', password: cashierHash },
    { email: 'lwyoak@uniongroup.com', name: 'Cashier LWY-OAK', role: 'CASHIER', outlet: 'LWY-OAK', password: cashierHash },
    { email: 'romscbd@uniongroup.com', name: 'Cashier ROMSCBD', role: 'CASHIER', outlet: 'ROMSCBD', password: cashierHash },
    { email: 'milgi@uniongroup.com', name: 'Cashier MILGI', role: 'CASHIER', outlet: 'MILGI', password: cashierHash },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  console.log('✓ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());