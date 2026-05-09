import type { PrismaClient } from '@prisma/client';

// Stub — Prisma's native query engine binary is killed by cPanel resource limits.
// Auth uses sql.js (lib/db.ts) directly. All other routes will get null/empty
// responses from the Proxy rather than crashing the server process.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handler: any = {
  get() { return new Proxy(function () {}, handler); },
  apply() { return Promise.resolve(null); },
  construct() { return new Proxy({}, handler); },
};

export default new Proxy({}, handler) as unknown as PrismaClient;
