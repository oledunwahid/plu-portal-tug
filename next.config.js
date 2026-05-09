/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // @prisma/client removed from serverComponentsExternalPackages so webpack bundles
    // the Prisma stub (lib/prisma.ts) directly — no runtime require('@prisma/client')
    // that could trigger the native query-engine binary.
    outputFileTracingRoot: path.join(__dirname),
    outputFileTracingExcludes: {
      '**': [
        '**/node_modules/.prisma/**',
        '**/node_modules/@prisma/engines/**',
      ],
    },
  },
  webpack(config) {
    // Required for sql.js WASM — webpack 5 async WebAssembly support.
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    return config;
  },
};

module.exports = nextConfig;
