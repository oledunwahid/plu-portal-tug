// Wine List module setup: flag (or create) the Wine Cork / Wine PIC account and seed the wine
// reference lists with the values the wine team needs on day one.
//
// Idempotent - safe to re-run. It never changes a user's role, password or outlet unless asked to
// create the account from scratch, and it only ever ADDs master data (existing rows are left alone).
//
// Usage:
//   node scripts/seedWineCork.mjs <dbPath>                          # dry run (report only)
//   node scripts/seedWineCork.mjs <dbPath> --apply                  # flag existing account + seed data
//   node scripts/seedWineCork.mjs <dbPath> --apply --create-account --password 'Secret123'
//
// Options:
//   --email <addr>     account to flag / create (default winecork@uniongroup.com)
//   --name  <name>     display name when creating (default "Wine Cork")
//   --outlet <code>    base outlet when creating (default CSSG - required by the schema, but a Wine
//                      PIC never shows an outlet subtitle and Wine List is not outlet-scoped)
//   --skip-master-data don't seed the reference lists
import initSqlJs from 'sql.js';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const args = process.argv.slice(2);
function opt(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const dbPath = args[0] && !args[0].startsWith('--') ? args[0] : './prisma/dev.db';
const apply = args.includes('--apply');
const createAccount = args.includes('--create-account');
const skipMasterData = args.includes('--skip-master-data');
const email = opt('--email', 'winecork@uniongroup.com');
const name = opt('--name', 'Wine Cork');
const outlet = opt('--outlet', 'CSSG');
const password = opt('--password', null);

const ACCOUNT_TYPE = 'WINE_PIC';
const BUSINESS_UNIT = 'Wine Cork';

// Mirrors normalizeWineText() in lib/wine.ts - the unique index is on (type, normalizedName), so this
// must fold the same way or a seeded row could collide with a UI-created one.
function normalizeWineText(value) {
  return String(value ?? '')
    .replace(/[‘’ʼ′`´]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['".,;:!?()[\]{}/\\|+*_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MASTER_DATA = {
  BOTTLE_SIZE: [
    'Piccolo 187.5ml', 'Half Bottle 375ml', 'Bottle 750ml', 'Magnum 1.5L',
    'Double Magnum 3L', 'Jeroboam 5L', 'Glass Pour', 'Carafe',
  ],
  WINE_TYPE: [
    'Red', 'White', 'Rosé', 'Sparkling', 'Champagne', 'Dessert', 'Fortified', 'Orange',
  ],
  COUNTRY: [
    'France', 'Italy', 'Spain', 'Portugal', 'Germany', 'Austria', 'United States', 'Argentina',
    'Chile', 'Australia', 'New Zealand', 'South Africa', 'Japan', 'Indonesia',
  ],
  CLASSIFICATION: [
    'Grand Cru', 'Premier Cru', 'Village', 'Regional', 'DOCG', 'DOC', 'IGT', 'AOC', 'Reserva',
    'Gran Reserva',
  ],
  CATEGORY: ['Still Wine', 'Sparkling Wine', 'Fortified Wine', 'Wine by the Glass', 'Wine Event'],
  VARIETAL: [
    'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah', 'Shiraz', 'Grenache', 'Sangiovese',
    'Nebbiolo', 'Tempranillo', 'Malbec', 'Chardonnay', 'Sauvignon Blanc', 'Riesling',
    'Pinot Grigio', 'Chenin Blanc', 'Viognier', 'Sémillon', 'Gewürztraminer',
  ],
};

const SQL = await initSqlJs();
if (!fs.existsSync(dbPath)) {
  console.error(`DB file not found: ${dbPath}`);
  process.exit(1);
}
const db = new SQL.Database(fs.readFileSync(dbPath));

function all(sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

console.log(`DB: ${dbPath}`);
console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);

// The app itself adds these columns on first boot (lib/db.ts initDb). Add them here too so this
// script can run against a database the app has not yet opened.
for (const column of ['accountType TEXT', 'businessUnit TEXT', 'winePermissions TEXT']) {
  try { db.run(`ALTER TABLE "User" ADD COLUMN ${column}`); } catch { /* already exists */ }
}
db.run(`CREATE TABLE IF NOT EXISTS "WineMasterData" (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, code TEXT, name TEXT NOT NULL,
  normalizedName TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Active',
  createdAt TEXT NOT NULL, createdBy TEXT, updatedAt TEXT NOT NULL, updatedBy TEXT
)`);
db.run('CREATE UNIQUE INDEX IF NOT EXISTS "idx_winemasterdata_type_norm" ON "WineMasterData" (type, normalizedName)');

// ── 1. The Wine Cork account ────────────────────────────────────────────────
const existing = all('SELECT id, email, name, role, outlet, accountType FROM "User" WHERE email = ?', [email])[0];
const now = new Date().toISOString();

if (existing) {
  console.log(`\nFound account: ${existing.name} <${existing.email}> role=${existing.role} outlet=${existing.outlet} accountType=${existing.accountType ?? 'null'}`);
  if (existing.accountType === ACCOUNT_TYPE) {
    console.log('  Already marked WINE_PIC - nothing to change.');
  } else if (apply) {
    db.run('UPDATE "User" SET accountType = ?, businessUnit = ? WHERE id = ?',
      [ACCOUNT_TYPE, BUSINESS_UNIT, existing.id]);
    console.log(`  -> set accountType=${ACCOUNT_TYPE}, businessUnit=${BUSINESS_UNIT}`);
    console.log('  NOTE: the account must sign out and back in for the new session claims to apply.');
  } else {
    console.log(`  Would set accountType=${ACCOUNT_TYPE}, businessUnit=${BUSINESS_UNIT}`);
  }
} else if (createAccount) {
  if (!password) {
    console.error(`\nNo account for ${email} and --create-account given without --password.`);
    process.exit(1);
  }
  console.log(`\nNo account for ${email} - will create one (role CASHIER + accountType WINE_PIC).`);
  if (apply) {
    const hash = bcrypt.hashSync(password, 12);
    db.run(
      `INSERT INTO "User" (id, email, password, name, role, outlet, active, createdAt, accountType, businessUnit, winePermissions)
       VALUES (?,?,?,?,'CASHIER',?,1,?,?,?,NULL)`,
      [crypto.randomUUID(), email, hash, name, outlet, now, ACCOUNT_TYPE, BUSINESS_UNIT],
    );
    console.log(`  -> created ${name} <${email}> (outlet ${outlet}, accountType ${ACCOUNT_TYPE})`);
  } else {
    console.log(`  Would create ${name} <${email}> (outlet ${outlet})`);
  }
} else {
  console.log(`\nNo account found for ${email}. Re-run with --create-account --password '...' to create it,`);
  console.log("or pass --email with the Wine Cork account's real address.");
}

// ── 2. Wine reference lists ─────────────────────────────────────────────────
if (!skipMasterData) {
  let added = 0;
  let skipped = 0;
  for (const [type, names] of Object.entries(MASTER_DATA)) {
    for (const value of names) {
      const normalized = normalizeWineText(value);
      const found = all(
        'SELECT id FROM "WineMasterData" WHERE type = ? AND normalizedName = ? LIMIT 1',
        [type, normalized],
      )[0];
      if (found) { skipped += 1; continue; }
      added += 1;
      if (apply) {
        db.run(
          `INSERT INTO "WineMasterData" (id, type, code, name, normalizedName, status, createdAt, createdBy, updatedAt, updatedBy)
           VALUES (?,?,NULL,?,?,'Active',?, 'seed', ?, 'seed')`,
          [crypto.randomUUID(), type, value, normalized, now, now],
        );
      }
    }
  }
  console.log(`\nWine master data: ${apply ? 'added' : 'would add'} ${added}, already present ${skipped}.`);
}

if (apply) {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  console.log('\nSaved DB.');
} else {
  console.log('\nDry run only. Re-run with --apply to write changes.');
}
db.close();
