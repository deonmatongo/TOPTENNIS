import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '@/services/sentry';

/**
 * Phone + username authentication.
 *
 * Shape of the flows, and why:
 *
 *  Signup   startSignup -> verifyOtp -> completeSignup
 *           The password is NOT sent to start-signup. The account is created
 *           without one and the password is applied afterwards, on the session
 *           that verifyOtp returns — so a password never reaches an
 *           unauthenticated endpoint.
 *
 *  Login    signIn() always goes through the login-with-username Edge Function,
 *           for BOTH usernames and phone numbers. Resolving a username to a
 *           phone number client-side would be a PII leak; taking the phone path
 *           locally while usernames go server-side would give the two paths
 *           different response times and reintroduce the enumeration signal the
 *           function exists to remove.
 *
 *  Reset    requestPasswordReset -> verifyOtp -> setNewPassword
 *           setNewPassword revokes every session, including this one, so the
 *           user is returned to the login screen rather than dropped into the
 *           app from a recovery flow.
 *
 * The pending signup (phone, username, chosen password) is held in memory here
 * and never persisted, never written to SecureStore, and never passed as a
 * navigation param — navigation state can be serialised, which would put a
 * plaintext password on disk.
 */

type PendingSignup = { phone: string; username: string; password: string };

/**
 * `failed` distinguishes "we could not check" from "it is taken". Collapsing the
 * two tells the user their handle is unavailable when the truth is that the
 * lookup errored — which is both wrong and unactionable.
 */
type UsernameCheck = { available: boolean; reason?: string; failed?: boolean };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;

  /** In-memory only. Non-null between startSignup and completeSignup. */
  pendingSignup: PendingSignup | null;

  checkUsername: (username: string) => Promise<UsernameCheck>;

  startSignup: (args: {
    phone: string;
    username: string;
    password: string;
    defaultCountry?: string;
  }) => Promise<void>;
  resendSignupCode: () => Promise<void>;
  verifyPhoneOtp: (token: string) => Promise<void>;
  completeSignup: (usernameOverride?: string) => Promise<void>;
  cancelSignup: () => void;

  signIn: (identifier: string, password: string, defaultCountry?: string) => Promise<void>;

  /** Always resolves, whether or not the account exists. */
  requestPasswordReset: (identifier: string, defaultCountry?: string) => Promise<void>;
  verifyResetOtp: (token: string) => Promise<void>;
  resendResetCode: () => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  /** True between a verified reset code and the new password being saved. */
  resetPending: boolean;

  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/** The only message shown for a failed sign-in, whatever actually went wrong. */
export const GENERIC_SIGNIN_ERROR = 'Incorrect username or password.';

/**
 * supabase.functions.invoke puts the response body on `error.context` for any
 * non-2xx, so the server's message is unreachable without reading it back.
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
      /* non-JSON body — fall back to the generic message below */
    }
  }
  return { data: null, status, message, field };
}

/** Error carrying the field a validation failure belongs to, for inline display. */
export class AuthFieldError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'AuthFieldError';
    this.field = field;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);

  // The identifier the user typed on the "forgot password" screen. Kept so the
  // verify step can be resolved server-side — the phone number is never known
  // to this client on the username path, by design.
  const resetIdentifier = useRef<string | null>(null);
  const resetCountry = useRef<string>('US');

  // True between a verified reset code and the new password being saved.
  const [resetPending, setResetPending] = useState(false);

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

  // ── Username availability ───────────────────────────────────────────────────

  const checkUsername = async (username: string): Promise<UsernameCheck> => {
    const { data, message } = await invokeJson<UsernameCheck>('check-username', { username });
    if (!data) {
      // Never claim a name is free when the check failed — claim_identity would
      // reject it later, after the user has already verified their number. But
      // flag it as a failure so the UI does not say "taken".
      return {
        available: false,
        failed: true,
        reason: message ?? "Couldn't check that username. Check your connection and try again.",
      };
    }
    return data;
  };

  // ── Signup ──────────────────────────────────────────────────────────────────

  const startSignup: AuthContextType['startSignup'] = async ({
    phone,
    username,
    password,
    defaultCountry = 'US',
  }) => {
    if (password.length < 8) {
      throw new AuthFieldError('Password must be at least 8 characters long.', 'password');
    }

    const { data, message, field } = await invokeJson<{ ok: boolean }>('start-signup', {
      phone,
      username,
      defaultCountry,
    });

    if (!data?.ok) {
      throw new AuthFieldError(message ?? 'Could not start signup. Please try again.', field);
    }

    // Held in memory only. completeSignup consumes it; cancelSignup clears it.
    setPendingSignup({ phone, username, password });
  };

  const resendSignupCode = async () => {
    if (!pendingSignup) throw new Error('No signup in progress.');
    const { data, message } = await invokeJson<{ ok: boolean }>('start-signup', {
      phone: pendingSignup.phone,
      username: pendingSignup.username,
    });
    if (!data?.ok) throw new Error(message ?? 'Could not resend your code.');
  };

  /**
   * Exchange an SMS code for a session. Used by signup and by password reset —
   * GoTrue treats both as the same 'sms' verification.
   */
  const verifyPhoneOtp = async (token: string) => {
    // Signup only. The user typed this number, so the client legitimately knows
    // it and can verify directly. The reset path cannot — see verifyResetOtp.
    const phone = pendingSignup?.phone;
    if (!phone) throw new Error('No signup in progress.');

    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) {
      // Twilio Verify owns expiry and the attempt cap; surface its outcome as a
      // single message rather than distinguishing wrong-from-expired, which
      // would tell an attacker whether a code was ever valid.
      throw new Error('That code is incorrect or has expired. Request a new one.');
    }
  };

  /**
   * Apply the chosen password and claim the username. Runs on the verified
   * session, so the phone number is already proven.
   */
  const completeSignup = async (usernameOverride?: string) => {
    if (!pendingSignup) throw new Error('No signup in progress.');
    const username = (usernameOverride ?? pendingSignup.username).trim();

    // Password first: if the handle turns out to be taken, the account is still
    // usable and the user only has to pick another name.
    const { error: pwError } = await supabase.auth.updateUser({
      password: pendingSignup.password,
    });
    if (pwError) throw new Error(pwError.message);

    const { error: claimError } = await supabase.rpc('claim_identity', {
      p_username: username,
    });

    if (claimError) {
      const raw = claimError.message ?? '';
      if (raw.includes('USERNAME_TAKEN')) {
        // The verified session is intentionally left intact so the user can pick
        // another handle without redoing SMS verification.
        throw new AuthFieldError('That username was just taken. Try another.', 'username');
      }
      if (raw.includes('PHONE_TAKEN')) {
        throw new AuthFieldError(
          'That number is already linked to another account.',
          'phone',
        );
      }
      if (raw.includes('PHONE_NOT_VERIFIED')) {
        throw new Error('Your number is not verified yet. Enter the code we sent you.');
      }
      if (raw.includes('INVALID_USERNAME')) {
        throw new AuthFieldError(
          '3–20 characters, letters, numbers and underscores only.',
          'username',
        );
      }
      throw new Error('Could not finish setting up your account. Please try again.');
    }

    setPendingSignup(null);
  };

  const cancelSignup = () => setPendingSignup(null);

  // ── Login ───────────────────────────────────────────────────────────────────

  const signIn = async (identifier: string, password: string, defaultCountry = 'US') => {
    const { data, status, message } = await invokeJson<{
      session: { access_token: string; refresh_token: string };
    }>('login-with-username', { identifier, password, defaultCountry });

    if (!data?.session) {
      // 429 is the one case worth distinguishing — it is about the caller's own
      // behaviour and says nothing about whether the account exists.
      if (status === 429) {
        throw new Error(message ?? 'Too many attempts. Please try again shortly.');
      }
      throw new Error(GENERIC_SIGNIN_ERROR);
    }

    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) throw new Error(GENERIC_SIGNIN_ERROR);
  };

  // ── Password reset ──────────────────────────────────────────────────────────

  const requestPasswordReset = async (identifier: string, defaultCountry = 'US') => {
    const { data, status, message } = await invokeJson<{ ok: boolean }>('resolve-for-reset', {
      identifier,
      defaultCountry,
    });

    // A 429 is about this caller's own rate, so surfacing it leaks nothing.
    if (status === 429) {
      throw new Error(message ?? 'Too many requests. Please try again later.');
    }
    // Any other non-ok is a genuine transport/server fault, not "no such user" —
    // the function returns { ok: true } for unknown accounts on purpose.
    if (!data?.ok) {
      throw new Error(message ?? 'Something went wrong. Please try again.');
    }

    // Remember what the user typed, not a phone number: on the username path the
    // number is never disclosed to this client.
    resetIdentifier.current = identifier;
    resetCountry.current = defaultCountry;
  };

  const resendResetCode = async () => {
    if (!resetIdentifier.current) throw new Error('No reset in progress.');
    await requestPasswordReset(resetIdentifier.current, resetCountry.current);
  };

  /**
   * Verify a reset code via verify-reset-code, which resolves the identifier and
   * calls verifyOtp server-side. Establishes the short-lived session that
   * setNewPassword then acts on.
   */
  const verifyResetOtp = async (token: string) => {
    const identifier = resetIdentifier.current;
    if (!identifier) throw new Error('No reset in progress.');

    const { data, status, message } = await invokeJson<{
      session: { access_token: string; refresh_token: string };
    }>('verify-reset-code', { identifier, token, defaultCountry: resetCountry.current });

    if (!data?.session) {
      if (status === 429) {
        throw new Error(message ?? 'Too many attempts. Please try again shortly.');
      }
      throw new Error(message ?? 'That code is incorrect or has expired. Request a new one.');
    }

    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) throw new Error('Could not verify that code. Please try again.');

    setResetPending(true);
  };

  const setNewPassword = async (password: string) => {
    if (password.length < 8) {
      throw new AuthFieldError('Password must be at least 8 characters long.', 'password');
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);

    setResetPending(false);
    resetIdentifier.current = null;

    // Revoke every session, this one included. A password reset must invalidate
    // whatever an attacker may already hold, and the user is deliberately sent
    // back to the login screen instead of being dropped into the app.
    await supabase.auth.signOut({ scope: 'global' });
  };

  // ── Sign out ────────────────────────────────────────────────────────────────

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

  const value: AuthContextType = {
    user,
    session,
    loading,
    pendingSignup,
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
    resetPending,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
