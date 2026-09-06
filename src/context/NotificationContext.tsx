'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '@/src/lib/api';
import { useAuth } from '@/src/context/AuthContext';
import { requestPushPermissionAndToken, listenForForegroundMessages } from '@/src/lib/firebaseClient';

export interface AppNotification {
  id: number;
  type: 'ADMIN' | 'ORDER' | 'WISHLIST' | 'SYSTEM';
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  pushPermission: 'default' | 'granted' | 'denied' | 'unsupported';
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  enablePush: () => Promise<{ success: boolean; reason?: string }>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 45_000;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationContextType['pushPermission']>(() => {
    // Lazy initializer runs once per mount, including the client-side
    // mount during hydration (where `window` is defined) — this avoids
    // needing an effect just to read a synchronous browser API on mount.
    if (typeof window === 'undefined') return 'default';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission as 'default' | 'granted' | 'denied';
  });

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await authFetch('/api/notifications');
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data.items);
        setUnreadCount(json.data.unreadCount);
      }
    } catch {
      // Silent — the bell just won't update this cycle; next poll retries.
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Fetching on mount/dependency-change is the intended, standard use of
    // this effect (syncing with the external notifications API) — see the
    // identical, already-reviewed pattern in the admin dashboard's
    // loadAdminCategories/loadNotificationsData/loadCouponsData effects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  // Foreground push arrives while the tab is open — refresh the bell
  // immediately instead of waiting for the next poll tick. The ref is
  // updated in its own effect (not during render) so the listener effect
  // below always calls the latest fetchNotifications closure without
  // needing to re-subscribe on every render.
  const fetchRef = useRef(fetchNotifications);
  useEffect(() => {
    fetchRef.current = fetchNotifications;
  });
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = listenForForegroundMessages(() => {
      fetchRef.current();
    });
    return unsubscribe;
  }, [isAuthenticated]);

  const markRead = useCallback(async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      // Best-effort — local state already reflects "read"; a background
      // refresh will reconcile if the server call actually failed.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await authFetch('/api/notifications/read-all', { method: 'PATCH' });
    } catch {
      // See markRead above.
    }
  }, []);

  const enablePush = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    const result = await requestPushPermissionAndToken();
    setPushPermission(
      typeof window !== 'undefined' && 'Notification' in window
        ? (Notification.permission as 'default' | 'granted' | 'denied')
        : 'unsupported'
    );
    if (!result.token) return { success: false, reason: result.reason };
    try {
      await authFetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: result.token }),
      });
      return { success: true };
    } catch {
      return { success: false, reason: 'registration_failed' };
    }
  }, []);

  // Self-healing: if the browser already granted permission in a past
  // session (e.g. before a bug was fixed server-side, or the token
  // expired/rotated), the "Enable notifications" banner never shows again
  // — permission is already 'granted' — so there'd otherwise be no way to
  // retry registration. Silently re-registers once per app load whenever
  // permission is already granted; requesting again when already granted
  // just resolves immediately without showing a prompt, so this is
  // invisible to the person unless it needed to fix something.
  const hasAutoRegisteredRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || pushPermission !== 'granted' || hasAutoRegisteredRef.current) return;
    hasAutoRegisteredRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    enablePush();
  }, [isAuthenticated, pushPermission, enablePush]);

  return (
    <NotificationContext.Provider
      value={{
        notifications: isAuthenticated ? notifications : [],
        unreadCount: isAuthenticated ? unreadCount : 0,
        isLoading,
        pushPermission,
        refresh: fetchNotifications,
        markRead,
        markAllRead,
        enablePush,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
