'use client';

import React from 'react';
import { useTheme } from '@/src/context/ThemeContext';

/**
 * Icon-only toggle. Deliberately a <div role="button">, not a native
 * <button> — matches every other header trigger (hamburger, bell, avatar)
 * for the same OEM/Android auto-dark-invert reasons documented there.
 *
 * The sun/moon icons don't need light+dark variants like the hamburger/bell
 * do: each one is only ever shown against a background that already
 * matches it (sun = amber, shown on the dark surface; moon = dark neutral,
 * shown on the light surface), so a single fixed color per icon is enough.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={toggleTheme}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleTheme();
        }
      }}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`p-2 rounded-xl bg-white hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 cursor-pointer select-none force-dark-safe ${className}`}
    >
      <img
        src={isDark ? '/assets/icons/sun.svg' : '/assets/icons/moon.svg'}
        alt=""
        className="w-5 h-5"
        draggable={false}
      />
    </div>
  );
}
