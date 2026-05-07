/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // Native addons cannot be webpack-bundled; they load from node_modules at runtime.
    // Externalising them means the server bundles emit require('...') calls instead
    // of attempting to inline the .node binary, which would break cross-platform builds.
    serverComponentsExternalPackages: ['@prisma/client', 'better-sqlite3'],
    // Do not copy platform-specific native binaries into .next/standalone/node_modules.
    // We run via server.js (project root), not .next/standalone/server.js, so the
    // standalone copy is unused — but without this the Windows build would trace
    // win32 .node files into standalone, which fail on Linux.
    outputFileTracingExcludes: {
      '**': [
        '**/node_modules/.prisma/**',
        '**/node_modules/better-sqlite3/build/**',
        '**/node_modules/@prisma/engines/**',
      ],
    },
  },
};

module.exports = nextConfig;
