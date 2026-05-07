#!/usr/bin/env node
/**
 * patch-client.js
 *
 * Rewrites the Prisma generated client for the server environment.
 * Called by setup-production.sh after every deploy.
 *
 * Problem: cPanel's nodevenv hardlinks .prisma/client/index.js, so __dirname
 * inside the module points to the nodevenv path (~/.nodevenv/…), which makes
 * ALL relative path resolution (binary, schema, .env) resolve to wrong locations.
 * Additionally, manual server-side edits may have removed config.dirname = __dirname.
 *
 * This script:
 *   1. Reads the current index.js from the project's .prisma/client/
 *   2. Ensures config.dirname = __dirname is present (re-inserts if manually removed)
 *   3. Replaces it with the absolute project path
 *   4. Nulls out schemaEnvPath (DATABASE_URL is set directly via server-start.js)
 *   5. Writes the patched file to BOTH the project client dir AND nodevenv
 *   6. Writes a clean default.js to nodevenv
 *
 * Run as: node prisma/patch-client.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const APP_ROOT        = '/home/plur2385/public_html/plu-portal';
const PROJECT_CLIENT  = path.join(APP_ROOT, 'node_modules/.prisma/client');
const NODEVENV_CLIENT = '/home/plur2385/nodevenv/public_html/plu-portal/20/lib/node_modules/.prisma/client';

// ── 1. Read source ────────────────────────────────────────────────────────────
const srcPath = path.join(PROJECT_CLIENT, 'index.js');
if (!fs.existsSync(srcPath)) {
  console.error('ERROR: Cannot find', srcPath);
  console.error('Run "npm install" (or "npm install --ignore-scripts") first.');
  process.exit(1);
}

let src = fs.readFileSync(srcPath, 'utf8');

// ── 2. Re-insert config.dirname = __dirname if manually removed ───────────────
// The line should appear right after `const fs = require('fs')`.
// Pattern: after that require, before the fs.existsSync check.
if (!src.includes('config.dirname = __dirname')) {
  console.log('  config.dirname = __dirname was missing — re-inserting…');
  // Insert before the fs.existsSync block (the fallback alternative-path logic)
  src = src.replace(
    /^(const fs = require\('fs'\))\s*\n/m,
    "$1\n\nconfig.dirname = __dirname\n"
  );
  if (!src.includes('config.dirname = __dirname')) {
    // Fallback: insert just before `config.runtimeDataModel`
    src = src.replace(
      /^(config\.runtimeDataModel\s*=)/m,
      "config.dirname = __dirname\n\n$1"
    );
  }
}

// ── 3. Apply production patches ───────────────────────────────────────────────
src = src
  // Fix dirname to absolute project path (bypasses __dirname = nodevenv path)
  .replace(
    'config.dirname = __dirname',
    `config.dirname = '${PROJECT_CLIENT}'`
  )
  // Null out the env file path — DATABASE_URL is injected by server-start.js
  .replace(
    '"schemaEnvPath": "../../../.env"',
    '"schemaEnvPath": null'
  )
  // Remove the windows native:true marker — server uses debian-openssl-1.1.x
  .replace(
    /\{"fromEnvVar":null,"value":"windows","native":true\}/,
    '{"fromEnvVar":null,"value":"windows"}'
  )
  // Set debian-openssl-1.1.x as native target for this server
  .replace(
    /\{"fromEnvVar":null,"value":"debian-openssl-1\.1\.x"\}/,
    '{"fromEnvVar":null,"value":"debian-openssl-1.1.x","native":true}'
  );

// ── 4. Write to project client dir (in case hardlink was already broken) ──────
fs.mkdirSync(PROJECT_CLIENT, { recursive: true });
fs.writeFileSync(path.join(PROJECT_CLIENT, 'index.js'), src, 'utf8');
console.log('  Written:', path.join(PROJECT_CLIENT, 'index.js'));

// ── 5. Write to nodevenv client dir (breaks hardlink, creates independent copy) ─
fs.mkdirSync(NODEVENV_CLIENT, { recursive: true });
fs.writeFileSync(path.join(NODEVENV_CLIENT, 'index.js'), src, 'utf8');
console.log('  Written:', path.join(NODEVENV_CLIENT, 'index.js'));

// ── 6. Write correct default.js to nodevenv ───────────────────────────────────
// Previous manual patches may have left default.js in a broken state.
const cleanDefault = "module.exports = { ...require('.') }\n";
fs.writeFileSync(path.join(NODEVENV_CLIENT, 'default.js'), cleanDefault, 'utf8');
console.log('  Written:', path.join(NODEVENV_CLIENT, 'default.js'));

// ── 7. Copy schema.prisma to nodevenv if available ────────────────────────────
const schemaSrc  = path.join(PROJECT_CLIENT, 'schema.prisma');
const schemaDest = path.join(NODEVENV_CLIENT, 'schema.prisma');
if (fs.existsSync(schemaSrc)) {
  fs.copyFileSync(schemaSrc, schemaDest);
  console.log('  Copied schema.prisma to nodevenv');
}

// ── 8. Ensure binary is executable ────────────────────────────────────────────
const BINARY = 'libquery_engine-debian-openssl-1.1.x.so.node';
const binSrc  = path.join(PROJECT_CLIENT, BINARY);
const binDest = path.join(NODEVENV_CLIENT, BINARY);
if (fs.existsSync(binSrc)) {
  fs.copyFileSync(binSrc, binDest);
  fs.chmodSync(binDest, 0o755);
  fs.chmodSync(binSrc,  0o755);
  console.log('  Binary chmod 755 and copied to nodevenv');
} else {
  console.warn('  WARNING: engine binary not found at', binSrc);
}

console.log('\nPrisma client patched successfully.');
console.log('  config.dirname =>', PROJECT_CLIENT);
console.log('  schemaEnvPath  => null');
console.log('  native target  => debian-openssl-1.1.x');
