// Client-side API helpers.
//
// Auth tokens are NEVER stored in localStorage or attached as an
// Authorization header from client JS. The access & refresh tokens live
// exclusively in HttpOnly cookies set by the server; the browser attaches
// them automatically on same-origin requests when `credentials: 'include'`
// is used. This file only caches the (non-secret) user profile object for
// fast UI rendering between page loads.

export const USER_KEY = 'marketplace_user';

export function getStoredUser<T = unknown>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredUser(user: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn('Failed to store user profile:', err);
  }
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.warn('Failed to clear stored auth:', err);
  }
}

/**
 * Universal authenticated fetch. Auth is carried entirely via the browser's
 * HttpOnly cookie jar (`credentials: 'include'`) - there is no
 * Authorization header to attach here on purpose.
 */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: init.credentials || 'include',
  });
}
