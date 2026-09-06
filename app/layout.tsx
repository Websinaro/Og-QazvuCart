import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@/src/components/providers/AppProviders';

// Tells the browser this site only supports a light theme. Without this,
// Android Chrome's "Auto dark theme for web content" heuristic can forcibly
// re-invert colors on native form controls like <button> — it's aggressive
// with neutral grays inside buttons (turning the hamburger/bell icons
// near-white on a white header) but leaves plain links (wishlist heart) and
// saturated brand colors (cart's yellow) alone, which is exactly the pattern
// reported. `color-scheme: light` (also set in globals.css) makes Chrome
// skip that heuristic entirely.
export const viewport: Viewport = {
  colorScheme: 'light',
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

