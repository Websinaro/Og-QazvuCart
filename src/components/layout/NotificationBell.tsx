'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, CheckCheck, BellRing } from 'lucide-react';
import { useNotifications } from '@/src/context/NotificationContext';
import { useAuth } from '@/src/context/AuthContext';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const { notifications, unreadCount, pushPermission, markRead, markAllRead, enablePush } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  if (!isAuthenticated) return null;

  const showPushPrompt = pushPermission === 'default';

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative p-2 rounded-xl hover:bg-neutral-100 text-neutral-700 hover:text-neutral-950 transition-colors cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            key={unreadCount}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className="absolute -top-1 -right-1 bg-red-600 text-white font-extrabold text-[10px] min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center shadow-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <h3 className="font-black text-sm text-neutral-950">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] font-bold text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>

            {showPushPrompt && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2.5">
                <BellRing className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-amber-900">
                    Turn on push notifications for order updates & deals
                  </p>
                  <button
                    onClick={() => enablePush()}
                    className="mt-1.5 text-[11px] font-bold text-amber-900 underline underline-offset-2 cursor-pointer"
                  >
                    Enable notifications
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 font-medium">You&apos;re all caught up</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const content = (
                    <div
                      className={`px-4 py-3 border-b border-neutral-50 last:border-0 flex gap-2.5 hover:bg-neutral-50 transition-colors cursor-pointer ${
                        !n.isRead ? 'bg-amber-50/40' : ''
                      }`}
                      onClick={() => {
                        if (!n.isRead) markRead(n.id);
                        setIsOpen(false);
                      }}
                    >
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[#FFD21F] mt-1.5 shrink-0" />}
                      <div className={`flex-1 min-w-0 ${n.isRead ? 'pl-4' : ''}`}>
                        <p className="text-xs font-bold text-neutral-900 line-clamp-1">{n.title}</p>
                        <p className="text-[11px] text-neutral-600 line-clamp-2 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-neutral-400 font-medium mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          className="p-1 text-neutral-400 hover:text-emerald-600 shrink-0 h-fit cursor-pointer"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );

                  return n.link ? (
                    <Link key={n.id} href={n.link} className="block">
                      {content}
                    </Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
