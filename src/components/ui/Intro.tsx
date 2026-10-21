'use client';

import React, { useEffect, useState } from 'react';

const SEEN_KEY = 'qazvucart-intro';

/**
 * First-visit intro. Shown once per browser session.
 *
 * The timeline itself is pure CSS (see `.intro-*` in globals.css) so it still
 * finishes if JS is slow. React only (a) remembers that it played, (b) releases
 * the scroll lock, (c) unmounts the overlay, and (d) lets the visitor skip it.
 * The inline script in app/layout.tsx adds `intro-skip` to <html> for repeat
 * visits and reduced-motion users, so there is no flash before hydration.
 */
export function Intro() {
  const [mounted, setMounted] = useState(true);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains('intro-skip')) {
      return;
    }
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode: the intro may replay on refresh, which is harmless */
    }
    const release = window.setTimeout(() => root.classList.remove('intro-active'), skipped ? 450 : 3050);
    const unmount = window.setTimeout(() => {
      // From here on, treat the intro as seen so in-app navigation to the home
      // page doesn't re-delay the hero entrance (see --intro-offset in globals.css).
      root.classList.add('intro-skip');
      setMounted(false);
    }, skipped ? 600 : 3300);
    return () => {
      window.clearTimeout(release);
      window.clearTimeout(unmount);
      root.classList.remove('intro-active');
    };
  }, [skipped]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSkipped(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="intro-root"
      data-skip={skipped ? 'true' : undefined}
      onClick={() => setSkipped(true)}
      role="presentation"
      aria-hidden="true"
    >
      <div className="intro-stage">
        <svg viewBox="0 0 64 64" className="intro-mark" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <circle className="intro-draw" cx="30" cy="30" r="16" pathLength={1} />
          <path className="intro-draw intro-draw-tail" d="M41 41 L53 53" pathLength={1} />
        </svg>
        <div className="intro-word">
          <span className="intro-word-inner">
            Qazvu<span className="text-brand-300">Cart</span>
          </span>
        </div>
        <p className="intro-tag">Marketplace of verified sellers</p>
      </div>
      <span className="intro-line" />
    </div>
  );
}
