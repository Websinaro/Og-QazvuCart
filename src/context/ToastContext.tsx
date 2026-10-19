'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from '@/src/components/ui/icons';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider
      value={{
        toast: addToast,
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        info: (msg) => addToast(msg, 'info'),
      }}
    >
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[60] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none px-4 sm:px-0" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto relative overflow-hidden flex items-center justify-between gap-3 pl-4 pr-2.5 py-3 rounded-2xl text-[13px] font-medium bg-neutral-950/95 dark:bg-white/95 text-white dark:text-neutral-950 backdrop-blur-xl shadow-lift ring-1 ring-white/10 dark:ring-black/5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`grid place-items-center w-7 h-7 rounded-full shrink-0 ${
                    t.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-400 dark:text-emerald-600'
                      : t.type === 'error'
                      ? 'bg-rose-500/20 text-rose-400 dark:text-rose-600'
                      : 'bg-brand-500/25 text-brand-300 dark:text-brand-700'
                  }`}
                >
                  {t.type === 'success' && <CheckCircle2 className="w-[18px] h-[18px]" weight="fill" />}
                  {t.type === 'error' && <AlertCircle className="w-[18px] h-[18px]" weight="fill" />}
                  {t.type === 'info' && <Info className="w-[18px] h-[18px]" weight="fill" />}
                </span>
                <span className="leading-snug">{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss"
                className="grid place-items-center w-8 h-8 hover:bg-white/10 dark:hover:bg-black/5 rounded-full text-white/60 dark:text-neutral-500 hover:text-white dark:hover:text-neutral-900 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4, ease: 'linear' }}
                style={{ originX: 0 }}
                className={`absolute bottom-0 left-0 h-[3px] w-full ${
                  t.type === 'error' ? 'bg-rose-500/70' : t.type === 'success' ? 'bg-emerald-500/70' : 'bg-brand-500/70'
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
