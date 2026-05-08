import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  const filePart = url.replace(/^file:/, '');
  if (path.isAbsolute(filePart)) return filePart;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as { __sqljsDb?: any };

async function getDb() {
  if (!g.__sqljsDb) {
    const SQL = await initSqlJs({
      // Resolve from public/ — committed to git, works without node_modules at runtime.
      locateFile: () => path.join(process.cwd(), 'public', 'sql-wasm.wasm'),
    });
    const fileBuffer = fs.readFileSync(resolveDbPath());
    g.__sqljsDb = new SQL.Database(fileBuffer);
  }
  return g.__sqljsDb;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  try {
    const db = await getDb();
    const results = db.exec(
      'SELECT id, email, password, name, role, outlet, active, createdAt FROM "User" WHERE email = ? LIMIT 1',
      [email]
    );
    if (!results.length || !results[0].values.length) return null;
    const { columns, values } = results[0];
    const row: unknown[] = values[0];
    const obj: Record<string, unknown> = {};
    columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj as unknown as DbUser;
  } catch (err) {
    console.error('[db] getUserByEmail failed:', err);
    return null;
  }
}
