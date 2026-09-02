'use client';

import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { useToast } from '@/src/context/ToastContext';
import { X, Mail, Lock, User, Phone, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

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

  const fillDemoCustomer = () => {
    setLoginIdentifier('john@example.com');
    setLoginPassword('Customer@123');
  };

  const fillDemoSeller = () => {
    setLoginIdentifier('seller@primecommerce.com');
    setLoginPassword('Seller@123');
  };

  const fillDemoAdmin = () => {
    setLoginIdentifier('admin@qazvucart.com');
    setLoginPassword('AdminPassword@123');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-100 overflow-hidden">
        {/* Header with gradient badge */}
        <div className="bg-neutral-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#FFD21F] text-black font-extrabold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              QazvuCart
            </span>
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FFD21F]" /> 100% Secure Auth
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {mode === 'login' ? 'Welcome Back' : 'Create Customer Account'}
          </h2>
          <p className="text-xs text-neutral-300 mt-1">
            {mode === 'login'
              ? 'Access your orders, saved addresses, and express checkout'
              : 'Join thousands of shoppers enjoying verified multi-vendor deals'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-neutral-200 bg-neutral-50">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              mode === 'login'
                ? 'bg-white text-neutral-900 border-b-2 border-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              mode === 'register'
                ? 'bg-white text-neutral-900 border-b-2 border-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="john@example.com or john_doe"
                    required
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21F] focus:border-neutral-900 transition-all text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21F] focus:border-neutral-900 transition-all text-neutral-900"
                  />
                </div>
              </div>

              {/* Demo One-Click Fill Buttons */}
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Quick Dev / Demo Credentials
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={fillDemoCustomer}
                    className="py-1.5 px-2 text-[11px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-colors text-center"
                    title="john@example.com / Customer@123"
                  >
                    👤 Customer
                  </button>
                  <button
                    type="button"
                    onClick={fillDemoSeller}
                    className="py-1.5 px-2 text-[11px] font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-colors text-center"
                    title="seller@primecommerce.com / Seller@123"
                  >
                    🏪 Seller
                  </button>
                  <button
                    type="button"
                    onClick={fillDemoAdmin}
                    className="py-1.5 px-2 text-[11px] font-bold text-amber-900 bg-amber-100/70 hover:bg-amber-200/80 border border-amber-300 rounded-lg transition-colors text-center"
                    title="admin@qazvucart.com / AdminPassword@123"
                  >
                    🛡️ Admin (Dev)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="inline-block animate-spin w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>Sign In to Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Full Name / Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. sarah_connor"
                    required
                    className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21F] text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="sarah@example.com"
                    required
                    className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21F] text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Mobile Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    required
                    className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21F] text-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    required
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21F] text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Confirm
                  </label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repeat"
                    required
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FFD21F] text-neutral-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-[#FFD21F] hover:bg-[#ebc21a] text-neutral-950 font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="inline-block animate-spin w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full" />
                ) : (
                  <>
                    <span>Create Customer Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-[11px] text-center text-neutral-500 mt-4 leading-relaxed">
            By continuing, you agree to QazvuCart&apos;s Terms of Service, Privacy Policy, and authentic customer guarantee.
          </p>
        </div>
      </div>
    </div>
  );
}
