import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
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
export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffdf4' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0d08' },
  ],
};

const SITE_DESCRIPTION =
  'Shop electronics, fashion, home and more from verified sellers. Live delivery dates, secure UPI and card payments, easy 7-day returns.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'QazvuCart: shop from verified sellers',
    template: '%s | QazvuCart',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'QazvuCart',
  openGraph: {
    siteName: 'QazvuCart',
    title: 'QazvuCart: shop from verified sellers',
    description: SITE_DESCRIPTION,
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QazvuCart: shop from verified sellers',
    description: SITE_DESCRIPTION,
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        suppressHydrationWarning
        className="font-sans antialiased"
      >
        <ThemeProvider>
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

