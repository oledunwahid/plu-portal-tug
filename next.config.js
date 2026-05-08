/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    // sql.js is bundled by webpack (not externalized) so the server needs no npm install for it.
    // Keep @prisma/client external in case any route still references Prisma types.
    serverComponentsExternalPackages: ['@prisma/client'],
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
