/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["sql.js"],
    outputFileTracingRoot: path.join(__dirname),
    outputFileTracingIncludes: {
      "/api/auth/**": ["./node_modules/sql.js/dist/**"],
      "**": ["./node_modules/sql.js/dist/**"],
    },
    outputFileTracingExcludes: {
      "**": [
        "**/node_modules/.prisma/**",
        "**/node_modules/@prisma/engines/**",
      ],
    },
  },
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

module.exports = nextConfig;
