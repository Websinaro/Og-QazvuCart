import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Schibsted_Grotesk } from 'next/font/google';
import { Intro } from '@/src/components/ui/Intro';
import { AppProviders } from '@/src/components/providers/AppProviders';
import { ThemeProvider } from '@/src/context/ThemeContext';

// The site now genuinely supports both themes (see ThemeContext + the
// `.dark` class strategy in globals.css), so we tell the browser
// `light dark` instead of the old `only light` lie. That old approach
// fought every OS/OEM auto-dark heuristic (Chrome's own, plus ColorOS's on
// Oppo devices) by refusing to admit a dark mode existed at all — which is
// also *why* it kept losing: those heuristics only override pages that
// don't declare real dark-mode support. A page that actually implements
// `prefers-color-scheme`/`.dark` correctly has nothing left for an
// auto-dark repaint to "fix". The header icons that specifically triggered
// the old bug are handled separately (theme-matched real <img> assets in
// Header/NotificationBell — see ThemeContext's resolvedTheme comment for
// why that still can't be pure CSS recoloring).
// Primary typeface: a grotesk with a little more character than the system
// default, still very legible at small sizes and for prices (tabular figures).
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
  display: 'swap',
});

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef6ef' },
    { media: '(prefers-color-scheme: dark)', color: '#07110a' },
  ],
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

// Runs before hydration (and before first paint) so the page never renders
// one theme and then visibly snaps to the other. ThemeProvider reads the
// same localStorage key on mount and agrees with whatever class this
// script already set, so there's no client/server mismatch either.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('qazvucart-theme');
    var resolved = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var root = document.documentElement;
    if (resolved === 'dark') root.classList.add('dark');
    root.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

// First-visit intro gate. Repeat visits in the same session and visitors who
// prefer reduced motion never see the overlay (no flash, no scroll lock).
const introInitScript = `
(function () {
  var d = document.documentElement;
  try {
    var seen = sessionStorage.getItem('qazvucart-intro') === '1';
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    d.classList.add(seen || reduce ? 'intro-skip' : 'intro-active');
  } catch (e) { d.classList.add('intro-skip'); }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${schibsted.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: introInitScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="font-sans antialiased"
      >
        <Intro />
        <ThemeProvider>
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

