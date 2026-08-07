'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase/client';
import type { Profile, RoleKey } from './types';



interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  quickSignIn: (email: string, password?: string) => Promise<{ error: string | null }>;
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


  const quickSignIn = useCallback(async (email: string, password?: string) => {
    if (!email || !password) return { error: 'No credentials provided' };
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
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
    <AuthContext.Provider value={{ profile, loading, quickSignIn, signOut, refresh }}>
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
