import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

/**
 * Phone + username authentication.
 *
 * Mirrors the mobile app exactly — both clients share one auth.users table, so a
 * behavioural difference between them is a security difference. In particular:
 *
 *  * signIn always goes through the login-with-username Edge Function, for BOTH
 *    usernames and phone numbers. Resolving a username to a phone number in the
 *    browser would be a PII leak; handling the phone case locally while usernames
 *    went server-side would give the two paths different response times and
 *    reintroduce the account-enumeration signal.
 *
 *  * The signup password is never sent to start-signup. The account is created
 *    without one and the password is applied on the session verifyOtp returns.
 *
 *  * Password reset verification also goes server-side, because on the username
 *    path this client is never told which number the code was sent to.
 *
 * Errors are RETURNED, not thrown — the existing pages are written against that
 * convention and it is preserved here deliberately.
 */

type PendingSignup = { phone: string; username: string; password: string };

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

  /** In-memory only. Non-null between startSignup and completeSignup. */
  pendingSignup: PendingSignup | null;
  /** True between a verified reset code and the new password being saved. */
  resetPending: boolean;

  checkUsername: (username: string) => Promise<UsernameCheck>;

  startSignup: (args: {
    phone: string;
    username: string;
    password: string;
    defaultCountry?: string;
  }) => Promise<Result>;
  resendSignupCode: () => Promise<Result>;
  verifyPhoneOtp: (token: string) => Promise<Result>;
  completeSignup: (usernameOverride?: string) => Promise<Result>;
  cancelSignup: () => void;

  signIn: (identifier: string, password: string, defaultCountry?: string) => Promise<Result>;

  requestPasswordReset: (identifier: string, defaultCountry?: string) => Promise<Result>;
  verifyResetOtp: (token: string) => Promise<Result>;
  resendResetCode: () => Promise<Result>;
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
export const GENERIC_SIGNIN_ERROR = 'Incorrect username or password.';

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
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [resetPending, setResetPending] = useState(false);

  // What the user typed on the forgot-password screen — NOT a phone number. On
  // the username path the number is never disclosed to this client.
  const resetIdentifier = useRef<string | null>(null);
  const resetCountry = useRef<string>('US');

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
            provider: session.user.app_metadata?.provider || 'phone',
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
      // Never report "available" on a failed check — claim_identity would reject
      // it later, after the user had already verified their number. Flag it as a
      // failure so the UI does not say "taken".
      return {
        available: false,
        failed: true,
        reason: message ?? "Couldn't check that username. Check your connection and try again.",
      };
    }
    return data;
  }, []);

  // ── Signup ──────────────────────────────────────────────────────────────────

  const startSignup = useCallback<AuthContextType['startSignup']>(async ({
    phone, username, password, defaultCountry = 'US',
  }) => {
    if (password.length < 8) {
      return { error: { message: 'Password must be at least 8 characters long.', field: 'password' } };
    }

    const { data, message, field } = await invokeJson<{ ok: boolean }>('start-signup', {
      phone,
      username,
      defaultCountry,
    });

    if (!data?.ok) {
      return { error: { message: message ?? 'Could not start signup. Please try again.', field } };
    }

    // Normalise to E.164 so verifyOtp uses the same phone string that GoTrue
    // received when the OTP was issued.
    const e164 =
      parsePhoneNumberFromString(phone, defaultCountry as never)?.number ??
      phone;
    setPendingSignup({ phone: e164, username, password });
    setTimeout(() => {
      logUserActivity('registration_attempt', { timestamp: new Date().toISOString() });
    }, 0);
    return { error: null };
  }, []);

  const resendSignupCode = useCallback(async (): Promise<Result> => {
    if (!pendingSignup) return { error: { message: 'No signup in progress.' } };
    const { data, message } = await invokeJson<{ ok: boolean }>('start-signup', {
      phone: pendingSignup.phone,
      username: pendingSignup.username,
    });
    if (!data?.ok) return { error: { message: message ?? 'Could not resend your code.' } };
    return { error: null };
  }, [pendingSignup]);

  const verifyPhoneOtp = useCallback(async (token: string): Promise<Result> => {
    // Signup only: the user typed this number, so the client legitimately knows
    // it. The reset path cannot do this — see verifyResetOtp.
    const phone = pendingSignup?.phone;
    if (!phone) return { error: { message: 'No signup in progress.' } };

    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) {
      // One message for wrong and expired alike: distinguishing them would tell
      // an attacker whether a code was ever valid.
      return { error: { message: 'That code is incorrect or has expired. Request a new one.' } };
    }
    return { error: null };
  }, [pendingSignup]);

  const completeSignup = useCallback(async (usernameOverride?: string): Promise<Result> => {
    if (!pendingSignup) return { error: { message: 'No signup in progress.' } };
    const username = (usernameOverride ?? pendingSignup.username).trim();

    // Password first: if the handle turns out to be taken, the account is still
    // usable and the user only has to pick another name.
    const { error: pwError } = await supabase.auth.updateUser({ password: pendingSignup.password });
    if (pwError) return { error: { message: pwError.message } };

    const { error: claimError } = await supabase.rpc('claim_identity', { p_username: username });

    if (claimError) {
      const raw = claimError.message ?? '';
      if (raw.includes('USERNAME_TAKEN')) {
        // The verified session is left intact so the user can pick another handle
        // without redoing SMS verification.
        return { error: { message: 'That username was just taken. Try another.', field: 'username' } };
      }
      if (raw.includes('PHONE_TAKEN')) {
        return { error: { message: 'That number is already linked to another account.', field: 'phone' } };
      }
      if (raw.includes('PHONE_NOT_VERIFIED')) {
        return { error: { message: 'Your number is not verified yet. Enter the code we sent you.' } };
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

    setPendingSignup(null);
    return { error: null };
  }, [pendingSignup]);

  const cancelSignup = useCallback(() => setPendingSignup(null), []);

  // ── Login ───────────────────────────────────────────────────────────────────

  const signIn = useCallback(async (
    identifier: string,
    password: string,
    defaultCountry = 'US',
  ): Promise<Result> => {
    const { data, status, message } = await invokeJson<{
      session: { access_token: string; refresh_token: string };
    }>('login-with-username', { identifier, password, defaultCountry });

    if (!data?.session) {
      // 429 is about the caller's own behaviour and says nothing about whether
      // the account exists, so it is the one case worth surfacing distinctly.
      if (status === 429) {
        return { error: { message: message ?? 'Too many attempts. Please try again shortly.' } };
      }
      return { error: { message: GENERIC_SIGNIN_ERROR } };
    }

    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) return { error: { message: GENERIC_SIGNIN_ERROR } };

    return { error: null };
  }, []);

  // ── Password reset ──────────────────────────────────────────────────────────

  const requestPasswordReset = useCallback(async (
    identifier: string,
    defaultCountry = 'US',
  ): Promise<Result> => {
    const { data, status, message } = await invokeJson<{ ok: boolean }>('resolve-for-reset', {
      identifier,
      defaultCountry,
    });

    if (status === 429) {
      return { error: { message: message ?? 'Too many requests. Please try again later.' } };
    }
    // Anything else non-ok is a genuine fault, not "no such user" — the function
    // returns { ok: true } for unknown accounts on purpose.
    if (!data?.ok) {
      return { error: { message: message ?? 'Something went wrong. Please try again.' } };
    }

    resetIdentifier.current = identifier;
    resetCountry.current = defaultCountry;
    return { error: null };
  }, []);

  const resendResetCode = useCallback(async (): Promise<Result> => {
    if (!resetIdentifier.current) return { error: { message: 'No reset in progress.' } };
    return requestPasswordReset(resetIdentifier.current, resetCountry.current);
  }, [requestPasswordReset]);

  const verifyResetOtp = useCallback(async (token: string): Promise<Result> => {
    const identifier = resetIdentifier.current;
    if (!identifier) return { error: { message: 'No reset in progress.' } };

    const { data, status, message } = await invokeJson<{
      session: { access_token: string; refresh_token: string };
    }>('verify-reset-code', { identifier, token, defaultCountry: resetCountry.current });

    if (!data?.session) {
      if (status === 429) {
        return { error: { message: message ?? 'Too many attempts. Please try again shortly.' } };
      }
      return {
        error: { message: message ?? 'That code is incorrect or has expired. Request a new one.' },
      };
    }

    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) return { error: { message: 'Could not verify that code. Please try again.' } };

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
    resetIdentifier.current = null;

    // Revoke every session, this one included. A reset must invalidate whatever
    // an attacker may already hold, and must not double as a way into the app.
    await supabase.auth.signOut({ scope: 'global' });
    return { error: null };
  }, []);

  // ── Sign out ────────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    try {
      setUser(null);
      setSession(null);
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      logger.error('Signout error', { error });
      setUser(null);
      setSession(null);
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    pendingSignup,
    resetPending,
    checkUsername,
    startSignup,
    resendSignupCode,
    verifyPhoneOtp,
    completeSignup,
    cancelSignup,
    signIn,
    requestPasswordReset,
    verifyResetOtp,
    resendResetCode,
    setNewPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
