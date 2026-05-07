'use strict';

/**
 * cPanel startup file — set this as "Application startup file" in Node.js Selector.
 *
 * Why this exists: cPanel's nodevenv hardlinks node_modules, so Node resolves
 * .prisma/client/index.js from the nodevenv path. __dirname inside that module
 * then points to nodevenv, making relativePath and binary resolution wrong.
 *
 * This file fixes everything before any Prisma code loads.
 */

const Module = require('module');

const APP_ROOT = '/home/plur2385/public_html/plu-portal';
const PROJECT_CLIENT = APP_ROOT + '/node_modules/.prisma/client';

// ── 1. Engine binary ───────────────────────────────────────────────────────────
// PRISMA_QUERY_ENGINE_LIBRARY bypasses __dirname-relative binary discovery entirely.
process.env.PRISMA_QUERY_ENGINE_LIBRARY =
  PROJECT_CLIENT + '/libquery_engine-debian-openssl-1.1.x.so.node';

// ── 2. Database path ───────────────────────────────────────────────────────────
// Prisma resolves "file:./prisma/dev.db" relative to cwd, which may be wrong in cPanel.
// Force the absolute path here; Next.js .env.production is a fallback.
process.env.DATABASE_URL = 'file:' + APP_ROOT + '/prisma/dev.db';

// ── 3. Working directory ────────────────────────────────────────────────────────
// Ensures process.cwd()-relative logic inside Next.js and Prisma resolves correctly.
process.chdir(APP_ROOT);

// ── 4. Patch config.dirname at compile time ────────────────────────────────────
// When Node.js loads .prisma/client/index.js from the nodevenv symlink path,
// __dirname is the nodevenv path. config.dirname = __dirname bakes in the wrong base.
// We intercept the module source and swap that one line before it evaluates.
const _compile = Module.prototype._compile;
Module.prototype._compile = function patchPrismaConfigDirname(content, filename) {
  if (filename.includes('/.prisma/client/index.js')) {
    content = content
      .replace(
        'config.dirname = __dirname',
        `config.dirname = '${PROJECT_CLIENT}'`
      )
      .replace(
        '"schemaEnvPath": "../../../.env"',
        '"schemaEnvPath": null'
      );
    // Restore the original compile so no other modules are affected.
    Module.prototype._compile = _compile;
  }
  return _compile.call(this, content, filename);
};

// ── 5. Hand off to the Next.js server ──────────────────────────────────────────
require('./server.js');
