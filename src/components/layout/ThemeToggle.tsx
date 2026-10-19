'use client';

import React from 'react';
import { Sun, Moon } from '@/src/components/ui/icons';
import { useTheme } from '@/src/context/ThemeContext';

/** Icon-only light/dark toggle. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  // Scoped colour-scheme opt-out so OEM auto-dark heuristics don't repaint the icon.
  const iconSafeStyle: React.CSSProperties = {
    colorScheme: isDark ? 'only dark' : 'only light',
  };

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
      className={`relative grid place-items-center w-10 h-10 rounded-full text-neutral-700 dark:text-neutral-200 hover:bg-neutral-900/5 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer select-none ${className}`}
      style={iconSafeStyle}
    >
      {isDark ? <Sun className="w-[21px] h-[21px] text-amber-300" /> : <Moon className="w-[21px] h-[21px]" />}
    </div>
  );
}
