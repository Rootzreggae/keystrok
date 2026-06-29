import type { Metadata } from "next";
import { Inter, Archivo, IBM_Plex_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Keystrok: the key lifecycle, instrumented",
  description:
    "Keystrok scans your code and platforms for exposed API keys, keeps one encrypted inventory, and guides safe rotation. Self-hostable.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ margin: 0, padding: 0, backgroundColor: '#1a1b1b', overflowX: 'hidden', maxWidth: '100vw' }}>
      <body
        className={`${inter.className} ${archivo.variable} ${plexMono.variable} antialiased`}
        style={{ margin: 0, padding: 0, backgroundColor: '#1a1b1b', color: '#e4e4e7', overflowX: 'hidden', maxWidth: '100vw' }}
      >
        <Providers>
          <div style={{ overflowX: 'hidden', maxWidth: '100vw' }}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
