'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/supabase/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  authenticated: boolean;
  googleCalendarConnected: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const effectiveProfile = useMemo<UserProfile | null>(() => {
    if (profile || !user) return profile;

    const metadata = user.user_metadata ?? {};
    const displayName = metadata.full_name ?? metadata.name ?? user.email?.split('@')[0] ?? null;
    const avatarUrl = metadata.avatar_url ?? metadata.picture ?? null;

    return {
      id: user.id,
      email: user.email ?? '',
      display_name: displayName,
      avatar_url: avatarUrl,
      google_calendar_connected: false,
      google_tokens: null,
      preferences: {
        theme: 'dark',
        default_view: 'month',
        auto_sync_google: false,
      },
      created_at: '',
      updated_at: '',
    };
  }, [profile, user]);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.readonly',
        ].join(' '),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
        },
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    window.location.href = '/';
  };

  const isGoogleUser =
    user?.app_metadata?.provider === 'google' ||
    (Array.isArray(user?.app_metadata?.providers) &&
      (user.app_metadata.providers as string[]).includes('google'));

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: effectiveProfile,
        session,
        loading,
        authenticated: !!user,
        googleCalendarConnected: effectiveProfile?.google_calendar_connected || isGoogleUser || false,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
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
