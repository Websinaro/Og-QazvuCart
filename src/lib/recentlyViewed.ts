'use client';

/**
 * Recently viewed products, stored client-side in localStorage — exactly
 * as the roadmap calls for ("store it locally initially"). No account or
 * server round-trip required; works the same for guests and signed-in
 * users. Caps at MAX_ITEMS, most-recent first, de-duplicated by id.
 */

const STORAGE_KEY = 'qazvucart:recently-viewed';
const MAX_ITEMS = 20;

export interface RecentlyViewedEntry {
  id: number;
  slug: string;
  categoryId?: number;
  viewedAt: number;
}

function readAll(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentlyViewedEntry => e && typeof e.id === 'number' && typeof e.slug === 'string'
    );
  } catch {
    return [];
  }
}

function writeAll(entries: RecentlyViewedEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
  } catch {
    // Storage full or disabled (private browsing) — fail silently, this
    // is a nice-to-have feature, not core functionality.
  }
}

/** Record a product view. Call this from the product detail page. */
export function recordProductView(product: { id: number; slug: string; categoryId?: number }) {
  const existing = readAll().filter((e) => e.id !== product.id);
  const next: RecentlyViewedEntry[] = [
    { id: product.id, slug: product.slug, categoryId: product.categoryId, viewedAt: Date.now() },
    ...existing,
  ];
  writeAll(next);
}

/** Most-recent-first list of viewed product ids, excluding the given id if provided. */
export function getRecentlyViewed(opts?: { excludeId?: number; limit?: number }): RecentlyViewedEntry[] {
  const all = readAll().sort((a, b) => b.viewedAt - a.viewedAt);
  const filtered = opts?.excludeId ? all.filter((e) => e.id !== opts.excludeId) : all;
  return typeof opts?.limit === 'number' ? filtered.slice(0, opts.limit) : filtered;
}

/** Category ids the person has actually looked at recently, most-viewed first — used to power "Based on your activity". */
export function getRecentCategoryIds(limit = 5): number[] {
  const counts = new Map<number, number>();
  for (const entry of readAll()) {
    if (!entry.categoryId) continue;
    counts.set(entry.categoryId, (counts.get(entry.categoryId) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([categoryId]) => categoryId);
}

export function clearRecentlyViewed() {
  writeAll([]);
}
