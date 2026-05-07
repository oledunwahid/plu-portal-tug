/**
 * Direct SQLite access via better-sqlite3.
 * Used for queries that must survive cPanel's shared hosting resource limits,
 * where Prisma's native query engine binary gets killed.
 *
 * better-sqlite3 is synchronous and runs in-process — no child processes,
 * no resource-limit risk.
 */
import Database from 'better-sqlite3';
import path from 'path';

// Matches Prisma's SQLite path resolution:
//   "file:./dev.db"  → resolved relative to prisma/ (where schema.prisma lives)
//   "file:/abs/path" → used as-is
function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  const filePart = url.replace(/^file:/, '');
  if (path.isAbsolute(filePart)) return filePart;
  // Prisma resolves relative URLs from the schema.prisma directory
  const normalized = filePart.replace(/^\.\//, '');
  return path.resolve(process.cwd(), 'prisma', normalized);
}

export interface DbUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  outlet: string;
  active: number; // SQLite stores Prisma Boolean as 0 / 1
  createdAt: string;
}

// Singleton — survives Next.js hot-reloads in dev via globalThis
const g = globalThis as unknown as { __bsqlite?: Database.Database };

function getDb(): Database.Database {
  if (!g.__bsqlite) {
    g.__bsqlite = new Database(resolveDbPath());
    g.__bsqlite.pragma('journal_mode = WAL');
    g.__bsqlite.pragma('foreign_keys = ON');
  }
  return g.__bsqlite;
}

export function getUserByEmail(email: string): DbUser | null {
  try {
    const row = getDb()
      .prepare<[string], DbUser>(
        'SELECT id, email, password, name, role, outlet, active, createdAt FROM "User" WHERE email = ? LIMIT 1'
      )
      .get(email);
    return row ?? null;
  } catch (err) {
    console.error('[db] getUserByEmail failed:', err);
    return null;
  }
}
