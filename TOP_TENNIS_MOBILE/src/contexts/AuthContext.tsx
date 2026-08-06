import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '@/services/sentry';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore any persisted session on mount — users stay signed in until they
    // manually sign out. getSession() reads from SecureStore and resolves
    // before the first auth-dependent render.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) setSentryUser(session.user.id);
      else clearSentryUser();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setSentryUser(session.user.id);
      } else {
        clearSentryUser();
      }
      // Forward the refreshed access token to the Realtime socket. Without
      // this, postgres_changes subscriptions silently stop after token expiry
      // because the socket authenticates independently from REST calls.
      try {
        supabase.realtime.setAuth(session?.access_token ?? null);
      } catch { /* ignore if socket not yet connected */ }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone?: string) => {
    if (password.length < 8) throw new Error('Password must be at least 8 characters long.');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, phone },
      },
    });
    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already taken') || error.message.includes('unique constraint')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      throw error;
    }
  };

  const signOut = async () => {
    // Clear this device's push token first so a signed-out device stops
    // receiving notifications. Best-effort — never block sign-out on it.
    if (user?.id) {
      try {
        await supabase.from('profiles').update({ push_token: null }).eq('id', user.id);
      } catch { /* ignore — proceed with sign-out regardless */ }
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const redirectTo = AuthSession.makeRedirectUri({ scheme: 'toptennis', path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      const url = result.url;
      const hashParams = url.split('#')[1] || url.split('?')[1] || '';
      const params = Object.fromEntries(
        hashParams.split('&').map(p => p.split('=').map(decodeURIComponent))
      );
      if (params.access_token && params.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (sessionError) throw sessionError;
      }
    }
  };

  const signInWithApple = async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('Apple sign-in failed: no identity token');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) throw error;
    // Apple only provides the user's name on the very first sign-in.
    // Save it immediately before it disappears on subsequent logins.
    const given  = credential.fullName?.givenName?.trim();
    const family = credential.fullName?.familyName?.trim();
    if (given || family) {
      const { data: { user: appleUser } } = await supabase.auth.getUser();
      if (appleUser) {
        await Promise.allSettled([
          supabase.auth.updateUser({
            data: { first_name: given ?? '', last_name: family ?? '' },
          }),
          supabase.from('profiles').upsert({
            id: appleUser.id,
            first_name: given ?? '',
            last_name: family ?? '',
            name: [given, family].filter(Boolean).join(' '),
          }, { onConflict: 'id' }),
        ]);
      }
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInWithApple,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
