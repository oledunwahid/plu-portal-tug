'use strict';

/**
 * cPanel Application startup file (set in Node.js Selector).
 *
 * Auth uses sql.js (pure WASM, no native modules, no compilation).
 * WASM is loaded from public/sql-wasm.wasm (committed to git).
 * After deploy: git pull → restart app in cPanel. No npm install required.
 *
 * The Module._compile patch below is retained for any remaining Prisma routes.
 */

'use strict';

const Module = require('module');
const path   = require('path');

const APP_ROOT       = '/home/plur2385/public_html/plu-portal';
const PROJECT_CLIENT = APP_ROOT + '/node_modules/.prisma/client';

// ── 1. Database path (absolute, avoids cwd-relative resolution issues) ────────
process.env.DATABASE_URL = 'file:' + APP_ROOT + '/prisma/dev.db';

// ── 2. Engine binary (bypasses __dirname-relative discovery in Prisma) ────────
process.env.PRISMA_QUERY_ENGINE_LIBRARY =
  PROJECT_CLIENT + '/libquery_engine-debian-openssl-1.1.x.so.node';

// ── 3. Working directory ───────────────────────────────────────────────────────
process.chdir(APP_ROOT);

// ── 4. Belt-and-suspenders: patch Prisma's config.dirname at compile time ─────
// setup-production.sh/patch-client.js already writes the absolute path into
// index.js.  This intercept is a second layer: if for any reason the file still
// has config.dirname = __dirname at load time, fix it then.
// It's a no-op when the file was already patched correctly.
const _compile = Module.prototype._compile;
Module.prototype._compile = function patchPrismaConfigDirname(content, filename) {
  if (filename.includes('/.prisma/client/index.js')) {
    const patched = content
      .replace('config.dirname = __dirname', `config.dirname = '${PROJECT_CLIENT}'`)
      .replace('"schemaEnvPath": "../../../.env"', '"schemaEnvPath": null');
    Module.prototype._compile = _compile; // restore immediately
    return _compile.call(this, patched, filename);
  }
  return _compile.call(this, content, filename);
};

// ── 5. Start Next.js ───────────────────────────────────────────────────────────
require('./server.js');
