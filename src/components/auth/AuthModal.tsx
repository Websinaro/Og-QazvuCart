'use client';

import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { X, Mail, Lock, User, Phone, ArrowRight, ShieldCheck, Loader2 } from '@/src/components/ui/icons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { login, register } = useAuth();
  const { success, error } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) {
      error('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    try {
      await login(loginIdentifier, loginPassword);
      success('Welcome back to QazvuCart!');
      onClose();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      await register({
        username: regUsername,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        confirmPassword: regConfirmPassword,
      });
      success('Account created successfully! Welcome to QazvuCart.');
      onClose();
    } catch (err: unknown) {
      const errObj = err as Error;
      error(errObj.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full h-12 pl-11 pr-4 text-sm rounded-xl bg-neutral-900/[0.04] dark:bg-white/[0.06] border border-transparent text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/15 transition-all';
  const inputPlainCls =
    'w-full h-12 px-4 text-sm rounded-xl bg-neutral-900/[0.04] dark:bg-white/[0.06] border border-transparent text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/15 transition-all';
  const labelCls = 'block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5';
  const iconCls = 'w-[18px] h-[18px] text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none';
  const submitCls =
    'w-full h-12 px-5 rounded-full bg-brand-600 hover:bg-brand-500 text-neutral-950 font-semibold text-sm shadow-glow active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed';

  const spinner = <Loader2 className="w-[18px] h-[18px] animate-spin" />;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/55 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? 'Sign in' : 'Create account'}
    >
      <div className="relative w-full sm:max-w-[26rem] max-h-[96vh] overflow-y-auto bg-white dark:bg-[#14110a] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-neutral-900/5 dark:border-white/10 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative isolate overflow-hidden px-7 pt-8 pb-6 text-neutral-950 bg-gradient-to-br from-brand-200 via-brand-300 to-brand-400">
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/70 blur-3xl -z-10 animate-pulse-glow" />
          <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-white/50 blur-3xl -z-10" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 grid place-items-center w-9 h-9 text-neutral-900 bg-white/55 hover:bg-white/90 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 mb-5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-neutral-950 text-brand-300 font-bold text-lg shadow-soft">Q</span>
            <span className="text-xs text-neutral-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-950" /> Secure sign-in
            </span>
          </div>
          <h2 className="text-[26px] font-semibold tracking-tight leading-tight">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-[13px] text-neutral-800/80 mt-1.5 leading-relaxed">
            {mode === 'login'
              ? 'Access your orders, saved addresses and express checkout.'
              : 'Join shoppers enjoying verified multi-vendor deals.'}
          </p>
        </div>

        {/* Segmented switch */}
        <div className="px-7 pt-5">
          <div className="grid grid-cols-2 p-1 rounded-full bg-neutral-900/[0.05] dark:bg-white/[0.07]">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-9 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                  mode === m
                    ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        </div>

        {/* Form body */}
        <div className="p-7 pt-5">
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Email or username</label>
                <div className="relative">
                  <Mail className={iconCls} />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="john@example.com or john_doe"
                    required
                    autoComplete="username"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <Lock className={iconCls} />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className={inputCls}
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className={`${submitCls} mt-2`}>
                {isLoading ? (
                  spinner
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-4 h-4" weight="bold" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className={labelCls}>Full name / username</label>
                <div className="relative">
                  <User className={iconCls} />
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. sarah_connor"
                    required
                    autoComplete="username"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Email address</label>
                <div className="relative">
                  <Mail className={iconCls} />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    required
                    autoComplete="email"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Mobile number</label>
                <div className="relative">
                  <Phone className={iconCls} />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    required
                    autoComplete="tel"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Password</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    required
                    autoComplete="new-password"
                    className={inputPlainCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Confirm</label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat"
                    required
                    autoComplete="new-password"
                    className={inputPlainCls}
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className={`${submitCls} mt-2`}>
                {isLoading ? (
                  spinner
                ) : (
                  <>
                    <span>Create account</span>
                    <ArrowRight className="w-4 h-4" weight="bold" />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-[11px] text-center text-neutral-500 mt-5 leading-relaxed">
            By continuing, you agree to QazvuCart&apos;s Terms of Service, Privacy Policy and authentic customer guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}
