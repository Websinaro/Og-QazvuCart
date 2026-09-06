import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@/src/components/providers/AppProviders';

// Tells the browser this site only supports a light theme.
// `only light` (not just `light`) is the important part: plain `light`
// is a preference the browser can still override, which is why it wasn't
// enough — some phones (this bug was confirmed on an Oppo/ColorOS device)
// run their own OS-level forced-dark repaint on top of Chrome that inverts
// rendered pixels regardless of element type, ignoring plain `light`. The
// `only` keyword is a hard declaration ("this page has no dark variant at
// all, don't ever auto-adapt it") that both Chromium's automatic dark-theme
// heuristic and its manually-forced dark mode setting are specced to
// respect and skip entirely. `color-scheme: only light` (also set in
// globals.css) is what actually makes the icons immune to this.
export const viewport: Viewport = {
  colorScheme: 'only light',
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  title: 'QazvuCart - Multi-Vendor Marketplace',
  description: 'A high-performance, production-ready multi-vendor e-commerce marketplace featuring product discovery, dynamic delivery estimations, authenticated carts, transactional checkout, orders tracking, and customer reviews.',
  openGraph: {
    title: 'QazvuCart - Multi-Vendor Marketplace',
    description: 'A high-performance, production-ready multi-vendor e-commerce marketplace featuring product discovery, dynamic delivery estimations, authenticated carts, transactional checkout, orders tracking, and customer reviews.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QazvuCart - Multi-Vendor Marketplace',
    description: 'A high-performance, production-ready multi-vendor e-commerce marketplace featuring product discovery, dynamic delivery estimations, authenticated carts, transactional checkout, orders tracking, and customer reviews.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="bg-neutral-50 text-neutral-900 antialiased font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

