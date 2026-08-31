/** @type {import('next').NextConfig} */
const path = require("path");

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy.
// 'unsafe-inline' is required for BOTH script and style and is not negotiable here:
// - style: the UI is built almost entirely from React inline `style={{...}}` props plus
//   inline <style> blocks (login page, layout). CSP treats both as inline styles.
// - script: Next's App Router injects inline bootstrap/RSC-payload scripts on every page.
//   A nonce would need middleware plumbing on every route; the win is small because the app
//   has no user-authored HTML sink (no dangerouslySetInnerHTML anywhere in the codebase).
// The real value here is the origin allowlist - no third-party script/frame/connect target
// can ever load - plus frame-ancestors, object-src and base-uri.
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' only in dev: the Next dev overlay and React refresh need it.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // blob: is needed for the XLSX/CSV exports the admin pages generate client-side.
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Legacy twin of frame-ancestors, for browsers/proxies that only honour this.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // The Server header and x-powered-by leak the stack version to anyone probing the host.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...SECURITY_HEADERS,
          // HSTS is production-only: sending it from a local http dev server would pin
          // localhost to https in the browser for a year.
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
        ],
      },
      {
        // API responses are per-user and must never be held by a shared cache or the
        // browser's bfcache/back button.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
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
