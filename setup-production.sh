#!/bin/bash
# setup-production.sh
# Run once after every deploy (git pull + npm install) to patch nodevenv's
# Prisma client so it resolves paths correctly from the project root.
#
# Usage (from app root):  bash setup-production.sh
# Auto-run via:           .cpanel.yml

set -euo pipefail

APP_ROOT="/home/plur2385/public_html/plu-portal"
PROJECT_CLIENT="${APP_ROOT}/node_modules/.prisma/client"
NODEVENV_CLIENT="/home/plur2385/nodevenv/public_html/plu-portal/20/lib/node_modules/.prisma/client"
BINARY="libquery_engine-debian-openssl-1.1.x.so.node"

echo "=== setup-production.sh ==="
echo "APP_ROOT:          ${APP_ROOT}"
echo "PROJECT_CLIENT:    ${PROJECT_CLIENT}"
echo "NODEVENV_CLIENT:   ${NODEVENV_CLIENT}"
echo ""

# ── Verify prerequisites ──────────────────────────────────────────────────────

if [ ! -f "${PROJECT_CLIENT}/index.js" ]; then
  echo "ERROR: ${PROJECT_CLIENT}/index.js not found."
  echo "Run 'npm install' in ${APP_ROOT} first, then re-run this script."
  exit 1
fi

if [ ! -f "${PROJECT_CLIENT}/${BINARY}" ]; then
  echo "ERROR: Engine binary not found at ${PROJECT_CLIENT}/${BINARY}"
  exit 1
fi

mkdir -p "${NODEVENV_CLIENT}"

# ── 1. Patch index.js in nodevenv ─────────────────────────────────────────────
# Read from project (authoritative source), patch config.dirname and schemaEnvPath,
# write to a temp file, then atomic-rename into nodevenv (breaks hardlink).
echo "Patching ${NODEVENV_CLIENT}/index.js ..."

sed \
  -e "s|config\.dirname = __dirname|config.dirname = '${PROJECT_CLIENT}'|g" \
  -e 's|"schemaEnvPath": "\.\./\.\./\.\./\.env"|"schemaEnvPath": null|g' \
  "${PROJECT_CLIENT}/index.js" > "${NODEVENV_CLIENT}/index.js.new"

mv "${NODEVENV_CLIENT}/index.js.new" "${NODEVENV_CLIENT}/index.js"
echo "  config.dirname  => ${PROJECT_CLIENT}"
echo "  schemaEnvPath   => null (DATABASE_URL set by server-start.js)"

# ── 2. Replace default.js in nodevenv with a clean re-export ─────────────────
# The server's default.js may have been hand-patched (throw removed etc.).
# Restore it to the correct 1-line form.
echo "Writing clean default.js ..."
printf "module.exports = { ...require('.') }\n" > "${NODEVENV_CLIENT}/default.js"

# ── 3. Copy schema.prisma to nodevenv ────────────────────────────────────────
# Prisma checks for this file at config.dirname; it's also in inlineSchema but
# having it on disk avoids any edge-case fallback warnings.
if [ -f "${PROJECT_CLIENT}/schema.prisma" ]; then
  cp "${PROJECT_CLIENT}/schema.prisma" "${NODEVENV_CLIENT}/schema.prisma"
  echo "Copied schema.prisma"
fi

# ── 4. Copy + chmod the native binary ────────────────────────────────────────
echo "Copying engine binary ..."
cp "${PROJECT_CLIENT}/${BINARY}" "${NODEVENV_CLIENT}/${BINARY}"
chmod 755 "${NODEVENV_CLIENT}/${BINARY}"
chmod 755 "${PROJECT_CLIENT}/${BINARY}"
echo "  ${BINARY} => 755"

# ── 5. Ensure tmp/ exists (for Passenger-style restart) ───────────────────────
mkdir -p "${APP_ROOT}/tmp"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Done ==="
echo "Next step: restart the Node.js app in cPanel (Node.js Selector > Restart)"
echo "Or from terminal:"
echo "  touch ${APP_ROOT}/tmp/restart.txt"
