'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  authFetch,
  getStoredUser,
  setStoredUser,
  clearStoredAuth,
} from '@/src/lib/api';

export interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  role: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  isVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface UserStats {
  addresses: number;
  orders: number;
  cartItems: number;
  wishlistItems: number;
}

interface AuthContextType {
  user: User | null;
  stats: UserStats | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; phone: string; password: string; confirmPassword: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { username?: string; email?: string; phone?: string; avatarUrl?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/me');
      if (!res.ok) {
        if (res.status === 401) {
          clearStoredAuth();
          setUser(null);
          setStats(null);
        }
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data.user);
        setStoredUser(json.data.user);
        setStats(json.data.stats);
      } else {
        clearStoredAuth();
        setUser(null);
        setStats(null);
      }
    } catch (err) {
      console.warn('Could not verify current user session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    const init = async () => {
      // Rehydrate cached user from storage in async task
      const cached = getStoredUser<User>();
      if (cached && !ignore) {
        setUser(cached);
      }

      try {
        const res = await authFetch('/api/auth/me');
        if (!ignore) {
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              setUser(json.data.user);
              setStoredUser(json.data.user);
              setStats(json.data.stats);
            }
          } else if (res.status === 401) {
            clearStoredAuth();
            setUser(null);
            setStats(null);
          }
        }
      } catch (err) {
        console.warn('Initial auth sync error:', err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    init();
    return () => {
      ignore = true;
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
      credentials: 'include',
    });
    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error?.message || 'Login failed');
    }
    if (json.data.user) {
      setStoredUser(json.data.user);
      setUser(json.data.user);
    }
    await fetchCurrentUser();
  };

  const register = async (data: { username: string; email: string; phone: string; password: string; confirmPassword: string }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error?.message || 'Registration failed');
    }
    if (json.data.user) {
      setStoredUser(json.data.user);
      setUser(json.data.user);
    }
    await fetchCurrentUser();
  };

  const logout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearStoredAuth();
      setUser(null);
      setStats(null);
    }
  };

  const updateProfile = async (data: { username?: string; email?: string; phone?: string; avatarUrl?: string }) => {
    const res = await authFetch('/api/auth/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success || !json.data) {
      throw new Error(json.error?.message || 'Profile update failed');
    }
    setUser(json.data.user);
    setStoredUser(json.data.user);
    setStats(json.data.stats);
  };

  const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    const res = await authFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || 'Password change failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        stats,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
