#!/bin/bash
# setup-production.sh
# Run after every "git pull" on the cPanel server.
# Usage: bash setup-production.sh  (from app root)

set -euo pipefail

APP_ROOT="/home/plur2385/public_html/plu-portal"
NODE_BIN="/home/plur2385/nodevenv/public_html/plu-portal/20/bin/node"

# Use nodevenv node if available (ensures correct Node version), fall back to PATH
NODE_CMD="node"
if [ -x "${NODE_BIN}" ]; then
  NODE_CMD="${NODE_BIN}"
fi

echo "=== setup-production.sh ==="
echo "Node: $(${NODE_CMD} --version)"
echo ""

# ── 1. Install / update dependencies ──────────────────────────────────────────
cd "${APP_ROOT}"

echo "Installing npm dependencies…"
# --ignore-scripts skips the prisma generate postinstall, which hangs on this host.
# better-sqlite3 is rebuilt separately below.
npm install --ignore-scripts 2>&1 | tail -5

# Rebuild better-sqlite3 native addon (needs scripts, can't use --ignore-scripts)
echo "Rebuilding better-sqlite3…"
if [ -d "${APP_ROOT}/node_modules/better-sqlite3" ]; then
  # Try downloading a pre-built binary first (fast, no compiler needed)
  "${NODE_CMD}" "${APP_ROOT}/node_modules/.bin/node-pre-gyp" install \
    --fallback-to-build \
    --directory "${APP_ROOT}/node_modules/better-sqlite3" 2>&1 \
    && echo "  better-sqlite3 binary ready" \
    || {
      echo "  node-pre-gyp failed, trying npm rebuild…"
      npm rebuild better-sqlite3 2>&1 | tail -5
    }
else
  echo "  ERROR: better-sqlite3 not in node_modules. Did 'npm install --ignore-scripts' run?"
  exit 1
fi

# ── 2. Patch the Prisma generated client ──────────────────────────────────────
echo ""
echo "Patching Prisma client…"
"${NODE_CMD}" "${APP_ROOT}/prisma/patch-client.js"

# ── 3. Ensure tmp/ exists for Passenger-style restart ─────────────────────────
mkdir -p "${APP_ROOT}/tmp"

echo ""
echo "=== Done ==="
echo "Next: restart the Node.js app in cPanel (Node.js Selector > Restart)"
echo "  or: touch ${APP_ROOT}/tmp/restart.txt"
