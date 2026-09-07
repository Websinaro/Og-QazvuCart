'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'qazvucart-theme';

interface ThemeContextValue {
  /** The user's stored preference — may be 'system'. */
  theme: Theme;
  /** What's actually applied right now — never 'system'. Use this to pick
   *  theme-specific assets (e.g. which icon .svg to load) since real <img>
   *  assets can't be recolored with CSS the way inline SVG/text can. */
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
  /** Convenience: flips light<->dark. If currently following system, this
   *  pins to the opposite of whatever system currently resolves to. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  // Keep color-scheme in sync so native form controls, scrollbars, etc.
  // (anything we're NOT already special-casing with a real-image swap)
  // render as the correct theme instead of the browser guessing.
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read synchronously on first render where possible so this matches the
  // class the blocking inline script (see app/layout.tsx <head>) already
  // set before hydration — avoids a mismatch flash.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });

  // Tracks the OS-level preference only; updated by the media-query
  // listener below. Combined with `theme` (via useMemo) to derive
  // `resolvedTheme` during render instead of via effect-triggered
  // setState, which the react-hooks/set-state-in-effect rule flags.
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  const resolvedTheme = useMemo<ResolvedTheme>(
    () => (theme === 'system' ? systemTheme : theme),
    [theme, systemTheme]
  );

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    window.localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // Apply the resolved theme to the DOM whenever it changes. This is a
  // side effect on an external system (the DOM), not derived state, so
  // it stays in an effect.
  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  // While following system, react live to OS/browser theme flips. The
  // setState here happens inside the event callback, not synchronously
  // in the effect body, so it doesn't trigger cascading renders on mount.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemTheme(getSystemTheme());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
