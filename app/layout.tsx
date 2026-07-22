import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Archivo, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
});

// Design-system fonts, exposed as CSS variables (not the default body font).
// Archivo = display/headings, IBM Plex Mono = data/labels/code. Self-hosted by
// next/font at build time, so they load from our origin (CSP-clean). The
// landing reads them via --font-archivo / --font-plex-mono; the rest of the app
// keeps Inter.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-plex-mono",
  display: "swap",
});

// Social cards resolve against the instance's own URL, so a self-hosted
// Keystrok unfurls as itself, not as keystrok.dev.
const SITE_URL = process.env.NEXTAUTH_URL || "https://keystrok.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Keystrok: the key lifecycle, instrumented",
  description:
    "Keystrok scans your code and platforms for exposed API keys, keeps one encrypted inventory, and guides safe rotation. Self-hostable.",
  openGraph: {
    title: "Keystrok: the key lifecycle, instrumented",
    description:
      "Find exposed API keys, see which are still live, and rotate them safely. Self-hosted, open source, MIT.",
    url: "/",
    siteName: "Keystrok",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Keystrok: the key lifecycle, instrumented" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Keystrok: the key lifecycle, instrumented",
    description:
      "Find exposed API keys, see which are still live, and rotate them safely. Self-hosted, open source, MIT.",
    images: ["/og.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request CSP nonce from middleware.ts. Reading headers() makes every
  // route dynamic — accepted cost of dropping script-src 'unsafe-inline'.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // suppressHydrationWarning: the no-flash script below sets data-theme before
    // React hydrates, so the html attributes never match the server render.
    <html lang="en" suppressHydrationWarning style={{ margin: 0, padding: 0, overflowX: 'hidden', maxWidth: '100vw' }}>
      <head>
        {/* No-flash theme resolve: set data-theme before paint from the user's
            saved preference, else the system. Dark is the default identity. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `(function(){try{var p=localStorage.getItem('ks-theme');var t=(p==='light'||p==='dark')?p:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();` }} />
      </head>
      <body
        className={`${inter.className} ${archivo.variable} ${plexMono.variable} antialiased`}
        style={{ margin: 0, padding: 0, overflowX: 'hidden', maxWidth: '100vw' }}
      >
        <Providers>
          <div style={{ overflowX: 'hidden', maxWidth: '100vw' }}>
            {children}
          </div>
        </Providers>
        {/* Umami analytics, only when the deploy sets a website id (the hosted
            keystrok deployment does; self-hosted builds ship no tracking). */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src="/stats/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
            nonce={nonce}
          />
        )}
      </body>
    </html>
  );
}
