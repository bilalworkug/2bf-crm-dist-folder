'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase/client';
import type { Profile, RoleKey } from './types';

const QUICK_CREDENTIALS: Record<RoleKey, { email: string; password: string }> = {
  admin: { email: 'admin@2bf.com.et', password: '2bf-admin-2025' },
  production: { email: 'production@2bf.com.et', password: '2bf-prod-2025' },
  warehouse: { email: 'warehouse1@2bf.com.et', password: '2bf-wh1-2025' },
  dispatch: { email: 'dispatch@2bf.com.et', password: '2bf-disp-2025' },
  sales: { email: 'sales@2bf.com.et', password: '2bf-sales-2025' },
  accounts: { email: 'accounts@2bf.com.et', password: '2bf-acc-2025' },
  manager: { email: 'manager@2bf.com.et', password: '2bf-mgr-2025' },
  reports: { email: 'reports@2bf.com.et', password: '2bf-rep-2025' },
};

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  quickSignIn: (role: RoleKey) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error || !data) {
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null);
        setLoading(false);
        return;
      }
      (async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!error && data) setProfile(data as Profile);
        setLoading(false);
      })();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const quickSignIn = useCallback(async (role: RoleKey) => {
    const cred = QUICK_CREDENTIALS[role];
    if (!cred) return { error: 'No credentials for this role' };
    const { error } = await supabase.auth.signInWithPassword({
      email: cred.email,
      password: cred.password,
    });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refresh = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, quickSignIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useRole(): RoleKey | null {
  const { profile } = useAuth();
  return profile?.role ?? null;
}
