import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/src/components/providers/AppProviders';

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

