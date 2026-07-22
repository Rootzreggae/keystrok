import type { NextConfig } from "next";

// Content-Security-Policy moved to middleware.ts: it is nonce-based, so it
// must be generated per request. The static headers below still apply
// everywhere (including API routes and assets the middleware matcher skips).
const securityHeaders = [
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
  // ESLint and TypeScript strict checking both enforced. Real errors block
  // builds. (The strict-TS backlog was drained; the `ignoreBuildErrors` escape
  // hatch is intentionally gone.)
  // Trace-pruned server bundle for the Docker image (.next/standalone runs with
  // `node server.js`, no full node_modules). Ignored by `next dev`.
  output: "standalone",
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
  // First-party proxy for Umami analytics: content blockers block
  // cloud.umami.is outright (most of our DevOps audience runs one), so the
  // tracker script and its /api/send beacon are served from our own origin.
  // The script derives its API root from its own src path, so the single
  // /stats/* rewrite covers both.
  async rewrites() {
    return [
      {
        source: "/stats/:path*",
        destination: "https://cloud.umami.is/:path*",
      },
    ];
  },
};

export default nextConfig;
