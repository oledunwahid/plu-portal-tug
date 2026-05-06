# PLU Management Portal

Internal portal for PLU Management System (Jakarta) to manage PLU (Price Look-Up) update requests for Quinos POS import.

## Setup

```bash
npm install

npx prisma generate
npx prisma db push
npx prisma db seed
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Features

- **Cashier**: Submit PLU requests (new item, price update, name update, printer change)
- **Admin**: Review, approve/reject, bulk-action, and export approved requests as Quinos-compatible CSV
- Role-based access control via NextAuth JWT sessions
- Category/department validation filtered by outlet group (IBR / Union / French)
- CSV export marks requests as EXPORTED to prevent duplicate exports

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Prisma ORM + SQLite
- NextAuth v4 (credentials, JWT)
- Tailwind CSS (Union Group brand design)
- Radix UI primitives
