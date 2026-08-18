import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

/**
 * Email + password authentication, with a security question for password reset.
 *
 * Mirrors TOP_TENNIS_MOBILE/src/contexts/AuthContext.tsx as closely as this
 * app's calling convention allows. In particular:
 *
 *  Signup   signUp -> claimProfile
 *           signUp() calls supabase.auth.signUp({ email, password }) directly —
 *           email confirmations are disabled project-wide, so this returns a
 *           real session immediately, no OTP/confirmation step. That session
 *           creation flips `user` truthy right away, which would otherwise let
 *           AuthRedirect navigate away from the signup form before the username
 *           and security question are claimed. `pendingClaim` keeps the form
 *           mounted in between — claimProfile() is a separate call so a
 *           username collision can be retried without recreating the account.
 *
 *  Login    signIn() calls supabase.auth.signInWithPassword({ email, password })
 *           directly. There is no PII to resolve server-side the way a phone
 *           number was, so no Edge Function is needed here.
 *
 *  Reset    getSecurityQuestion -> verifySecurityAnswer -> setNewPassword
 *           verifySecurityAnswer mints a short-lived session server-side (no
 *           email is sent); setNewPassword then revokes every session,
 *           including this one, so the user lands back on the login screen
 *           rather than being dropped into the app from a recovery flow.
 *
 * Errors are RETURNED, not thrown — the existing pages are written against that
 * convention and it is preserved here deliberately.
 */

type Result = { error: { message: string; field?: string } | null };
/**
 * `failed` distinguishes "we could not check" from "it is taken". Collapsing the
 * two tells the user their handle is unavailable when the truth is that the
 * lookup errored.
 */
type UsernameCheck = { available: boolean; reason?: string; failed?: boolean };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;

  /** True between signUp() creating the account and claimProfile() finishing. */
  pendingClaim: boolean;
  /** True between a verified security answer and the new password being saved. */
  resetPending: boolean;

  checkUsername: (username: string) => Promise<UsernameCheck>;

  signUp: (args: { email: string; password: string }) => Promise<Result>;
  claimProfile: (args: {
    username: string;
    securityQuestion: string;
    securityAnswer: string;
  }) => Promise<Result>;

  signIn: (email: string, password: string) => Promise<Result>;

  /** Always resolves, whether or not the account exists. `question` is what to show. */
  getSecurityQuestion: (email: string) => Promise<{ question: string | null } & Result>;
  verifySecurityAnswer: (answer: string) => Promise<Result>;
  setNewPassword: (password: string) => Promise<Result>;

  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** The only message shown for a failed sign-in, whatever actually went wrong. */
export const GENERIC_SIGNIN_ERROR = 'Incorrect email or password.';

/**
 * supabase.functions.invoke puts the response body on error.context for any
 * non-2xx, so the server's own message is unreachable without reading it back.
 */
async function invokeJson<T>(
  fn: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; status: number; message?: string; field?: string }> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (!error) return { data: data as T, status: 200 };

  let message: string | undefined;
  let field: string | undefined;
  let status = 500;
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    status = context.status ?? 500;
    try {
      const parsed = await context.json();
      message = parsed?.error;
      field = parsed?.field;
    } catch {
      /* non-JSON body — fall through to the caller's default message */
    }
  }
  return { data: null, status, message, field };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingClaim, setPendingClaim] = useState(false);
  const [resetPending, setResetPending] = useState(false);

  // The email the user typed on the "forgot password" screen. Kept so the
  // verify step can be resolved server-side.
  const resetEmail = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      logger.info('Auth state changed', { event });
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => {
          logUserActivity('user_logged_in', {
            provider: session.user.app_metadata?.provider || 'email',
            timestamp: new Date().toISOString(),
          });
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setTimeout(() => {
          logUserActivity('user_logged_out', { timestamp: new Date().toISOString() });
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      logger.error('AuthProvider: Error getting session', { error });
      if (!mounted) return;
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logUserActivity = async (activityType: string, metadata?: Record<string, unknown>) => {
    try {
      await supabase.from('user_activity_log').insert({
        user_id: user?.id || null,
        activity_type: activityType,
        metadata: metadata || null,
      });
    } catch (error) {
      logger.warn('Failed to log activity', { activityType, error });
    }
  };

  // ── Username availability ───────────────────────────────────────────────────

  const checkUsername = useCallback(async (username: string): Promise<UsernameCheck> => {
    const { data, message } = await invokeJson<UsernameCheck>('check-username', { username });
    if (!data) {
      // Never report "available" on a failed check — claim_username would reject
      // it later, after the account already exists. Flag it as a failure so the
      // UI does not say "taken".
      return {
        available: false,
        failed: true,
        reason: message ?? "Couldn't check that username. Check your connection and try again.",
      };
    }
    return data;
  }, []);

  // ── Signup ──────────────────────────────────────────────────────────────────

  const signUp = useCallback<AuthContextType['signUp']>(async ({ email, password }) => {
    if (password.length < 8) {
      return { error: { message: 'Password must be at least 8 characters long.', field: 'password' } };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    // A duplicate, already-confirmed email returns no error but also no
    // session and an empty identities array — Supabase's own anti-enumeration
    // shape for "this account already exists".
    if (!error && data.user && !data.session && (data.user.identities ?? []).length === 0) {
      return { error: { message: 'That email is already registered.', field: 'email' } };
    }

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      const duplicate = msg.includes('already registered') || msg.includes('already exists');
      return {
        error: {
          message: duplicate
            ? 'That email is already registered.'
            : (error.message || 'Could not create your account.'),
          field: 'email',
        },
      };
    }

    if (!data.session) {
      return {
        error: { message: 'Could not sign you in after creating your account. Please try signing in.' },
      };
    }

    // The session is now live, which flips `user` truthy. pendingClaim keeps
    // AuthRedirect from navigating away until claimProfile() finishes below.
    setPendingClaim(true);
    setTimeout(() => {
      logUserActivity('registration_attempt', { timestamp: new Date().toISOString() });
    }, 0);

    return { error: null };
  }, []);

  const claimProfile = useCallback<AuthContextType['claimProfile']>(async ({
    username,
    securityQuestion,
    securityAnswer,
  }) => {
    if (securityAnswer.trim().length < 2) {
      return { error: { message: 'Enter an answer at least 2 characters long.', field: 'securityAnswer' } };
    }

    const { error: claimError } = await supabase.rpc('claim_username', {
      p_username: username.trim(),
    });
    if (claimError) {
      const raw = claimError.message ?? '';
      if (raw.includes('USERNAME_TAKEN')) {
        // The session is intentionally left intact so the user can pick
        // another handle without recreating the account.
        return { error: { message: 'That username was just taken. Try another.', field: 'username' } };
      }
      if (raw.includes('INVALID_USERNAME')) {
        return {
          error: {
            message: '3–20 characters, letters, numbers and underscores only.',
            field: 'username',
          },
        };
      }
      return { error: { message: 'Could not finish setting up your account. Please try again.' } };
    }

    const { error: answerError } = await supabase.rpc('set_security_answer', {
      p_question: securityQuestion,
      p_answer: securityAnswer.trim(),
    });
    if (answerError) {
      return {
        error: { message: 'Could not save your security question. You can set it later from Settings.' },
      };
    }

    setPendingClaim(false);
    return { error: null };
  }, []);

  // ── Login ───────────────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: { message: GENERIC_SIGNIN_ERROR } };
    return { error: null };
  }, []);

  // ── Password reset ──────────────────────────────────────────────────────────

  const getSecurityQuestion = useCallback(async (
    email: string,
  ): Promise<{ question: string | null } & Result> => {
    const { data, status, message } = await invokeJson<{ question: string }>('get-security-question', {
      email,
    });

    if (status === 429) {
      return { question: null, error: { message: message ?? 'Too many requests. Please try again later.' } };
    }
    if (!data?.question) {
      return { question: null, error: { message: message ?? 'Something went wrong. Please try again.' } };
    }

    resetEmail.current = email;
    return { question: data.question, error: null };
  }, []);

  /**
   * Verify the answer via verify-security-answer, which mints a short-lived
   * session server-side. Establishes the session that setNewPassword then acts
   * on — same contract the old OTP-based reset used.
   */
  const verifySecurityAnswer = useCallback(async (answer: string): Promise<Result> => {
    const email = resetEmail.current;
    if (!email) return { error: { message: 'No reset in progress.' } };

    const { data, status, message } = await invokeJson<{
      session: { access_token: string; refresh_token: string };
    }>('verify-security-answer', { email, answer });

    if (!data?.session) {
      if (status === 429) {
        return { error: { message: message ?? 'Too many attempts. Please try again shortly.' } };
      }
      return { error: { message: message ?? 'That answer is incorrect. Try again.' } };
    }

    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) return { error: { message: 'Could not verify that answer. Please try again.' } };

    setResetPending(true);
    return { error: null };
  }, []);

  const setNewPassword = useCallback(async (password: string): Promise<Result> => {
    if (password.length < 8) {
      return { error: { message: 'Password must be at least 8 characters long.', field: 'password' } };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: { message: error.message } };

    setResetPending(false);
    resetEmail.current = null;

    // Revoke every session, this one included. A password reset must invalidate
    // whatever an attacker may already hold, and the user is deliberately sent
    // back to the login screen instead of being dropped into the app.
    await supabase.auth.signOut({ scope: 'global' });
    return { error: null };
  }, []);

  // ── Sign out ────────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    try {
      setUser(null);
      setSession(null);
      // Otherwise a signup abandoned mid-claim would leave the next sign-in
      // permanently stuck off AuthRedirect — pendingClaim is in-memory only.
      setPendingClaim(false);
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      logger.error('Signout error', { error });
      setUser(null);
      setSession(null);
      setPendingClaim(false);
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    pendingClaim,
    resetPending,
    checkUsername,
    signUp,
    claimProfile,
    signIn,
    getSecurityQuestion,
    verifySecurityAnswer,
    setNewPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
