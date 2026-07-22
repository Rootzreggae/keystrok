import { NextRequest, NextResponse } from "next/server";

/**
 * Content-Security-Policy, nonce-based.
 *
 * The CSP lives here (not next.config) because a per-request nonce is the only
 * way to drop `script-src 'unsafe-inline'`: Next.js reads the CSP from the
 * request headers we set below and stamps the nonce onto every inline script
 * it emits. `'strict-dynamic'` then lets those nonce'd scripts load the chunk
 * graph; `'self'` remains as a fallback for browsers that predate it.
 *
 * Dev keeps the old lax policy: react-refresh needs 'unsafe-eval' and the dev
 * overlay injects un-nonce'd inline scripts.
 *
 * `style-src` keeps 'unsafe-inline' (Tailwind + Next inject inline styles;
 * style nonces buy little and break hydration).
 */
export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    // github.com is allowed so the GitHub App Manifest setup form can POST there.
    "form-action 'self' https://github.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip static assets and the /stats analytics proxy; API routes return JSON
  // and keep the header-based protections from next.config.
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|og.png|stats).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
