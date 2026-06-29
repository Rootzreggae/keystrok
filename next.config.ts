import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy.
 *
 * `script-src` keeps 'unsafe-inline' because Next.js injects inline hydration
 * scripts and we are not (yet) wiring nonces through middleware — that is the
 * next CSP hardening step. 'unsafe-eval' is dev-only (HMR / React refresh).
 * `style-src` allows 'unsafe-inline' for Tailwind's injected styles.
 * `connect-src` permits same-origin plus the dev websocket for HMR.
 * `frame-ancestors 'none'` (plus X-Frame-Options) blocks clickjacking.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // ESLint and TypeScript strict checking both enforced — real errors block
  // builds. (The strict-TS backlog was drained; the `ignoreBuildErrors` escape
  // hatch is intentionally gone.)
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
