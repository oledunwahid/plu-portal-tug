// One-time cleanup for Wine Event rows wrongly routed to Cost Control with an auto-generated barcode.
// Cost Control is barcode-verification only, and Wine Event needs no barcode, so these rows have their
// barcode fields cleared and are moved back to the normal admin PENDING queue.
//
// Usage:
//   node scripts/wineEventCleanup.mjs <dbPath>            # dry run (report only)
//   node scripts/wineEventCleanup.mjs <dbPath> --apply    # apply the fix
import initSqlJs from 'sql.js';
import fs from 'fs';

const dbPath = process.argv[2] || './prisma/dev.db';
const apply = process.argv.includes('--apply');

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync(dbPath));

const sel = `SELECT id, name, category, status, suggestedBarcode, confirmedBarcode, barcode
  FROM PLURequest
  WHERE TRIM(LOWER(category)) = 'wine event'
    AND status = 'PENDING_COST_CONTROL'`;
const res = db.exec(sel);
const rows = res.length ? res[0].values : [];
console.log(`DB: ${dbPath}`);
console.log(`Bad Wine Event rows in PENDING_COST_CONTROL: ${rows.length}`);
for (const r of rows) console.log('  ', JSON.stringify(r));

if (apply && rows.length) {
  db.run(`UPDATE PLURequest
    SET suggestedBarcode = NULL, suggestedBarcodeSource = NULL, confirmedBarcode = NULL, barcode = NULL
    WHERE TRIM(LOWER(category)) = 'wine event' AND status = 'PENDING_COST_CONTROL'`);
  db.run(`UPDATE PLURequest
    SET status = 'PENDING'
    WHERE TRIM(LOWER(category)) = 'wine event' AND status = 'PENDING_COST_CONTROL'`);
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  console.log('Applied cleanup and saved DB.');
} else if (rows.length) {
  console.log('Dry run only. Re-run with --apply to fix.');
}
db.close();
