import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '@/services/sentry';

/**
 * Email + password authentication, with a security question for password reset.
 *
 * Shape of the flows, and why:
 *
 *  Signup   signUp -> claimProfile
 *           signUp() calls supabase.auth.signUp({ email, password }) directly —
 *           email confirmations are disabled project-wide, so this returns a
 *           real session immediately, no OTP/confirmation step. That session
 *           creation flips `user` truthy right away, which would otherwise let
 *           the navigator swap out of the signup screen before the username and
 *           security question are claimed. `pendingClaim` keeps the auth stack
 *           mounted in between, the same way `pendingSignup` used to bridge the
 *           old OTP wait — claimProfile() is a separate call so a username
 *           collision can be retried without recreating the account.
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
 */

type UsernameCheck = { available: boolean; reason?: string; failed?: boolean };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;

  /** True between signUp() creating the account and claimProfile() finishing. */
  pendingClaim: boolean;

  checkUsername: (username: string) => Promise<UsernameCheck>;

  signUp: (args: { email: string; password: string }) => Promise<void>;
  claimProfile: (args: {
    username: string;
    securityQuestion: string;
    securityAnswer: string;
  }) => Promise<void>;

  signIn: (email: string, password: string) => Promise<void>;

  /** Always resolves, whether or not the account exists. Returns the question to show. */
  getSecurityQuestion: (email: string) => Promise<string>;
  verifySecurityAnswer: (answer: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  /** True between a verified security answer and the new password being saved. */
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
export const GENERIC_SIGNIN_ERROR = 'Incorrect email or password.';

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
  const [pendingClaim, setPendingClaim] = useState(false);

  // The email the user typed on the "forgot password" screen. Kept so the
  // verify step can be resolved server-side.
  const resetEmail = useRef<string | null>(null);

  // True between a verified security answer and the new password being saved.
  const [resetPending, setResetPending] = useState(false);

  useEffect(() => {
    // Restore any persisted session on mount — users stay signed in until they
    // manually sign out. getSession() reads from SecureStore and resolves
    // before the first auth-dependent render.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) setSentryUser(session.user.id);
        else clearSentryUser();
      })
      .catch(() => { /* network unavailable — stay signed out */ })
      .finally(() => setLoading(false));

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
      // Never claim a name is free when the check failed — claim_username would
      // reject it later, after the account already exists. Flag it as a
      // failure so the UI does not say "taken".
      return {
        available: false,
        failed: true,
        reason: message ?? "Couldn't check that username. Check your connection and try again.",
      };
    }
    return data;
  };

  // ── Signup ──────────────────────────────────────────────────────────────────

  const signUp: AuthContextType['signUp'] = async ({ email, password }) => {
    if (password.length < 8) {
      throw new AuthFieldError('Password must be at least 8 characters long.', 'password');
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    // A duplicate, already-confirmed email returns no error but also no
    // session and an empty identities array — Supabase's own anti-enumeration
    // shape for "this account already exists".
    if (!error && data.user && !data.session && (data.user.identities ?? []).length === 0) {
      throw new AuthFieldError('That email is already registered.', 'email');
    }

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      const duplicate = msg.includes('already registered') || msg.includes('already exists');
      throw new AuthFieldError(
        duplicate ? 'That email is already registered.' : (error.message || 'Could not create your account.'),
        'email',
      );
    }

    if (!data.session) {
      throw new Error('Could not sign you in after creating your account. Please try signing in.');
    }

    // The session is now live, which flips `user` truthy. pendingClaim keeps
    // the navigator on the auth stack until claimProfile() finishes below.
    setPendingClaim(true);
  };

  const claimProfile: AuthContextType['claimProfile'] = async ({
    username,
    securityQuestion,
    securityAnswer,
  }) => {
    if (securityAnswer.trim().length < 2) {
      throw new AuthFieldError('Enter an answer at least 2 characters long.', 'securityAnswer');
    }

    const { error: claimError } = await supabase.rpc('claim_username', {
      p_username: username.trim(),
    });
    if (claimError) {
      const raw = claimError.message ?? '';
      if (raw.includes('USERNAME_TAKEN')) {
        // The session is intentionally left intact so the user can pick
        // another handle without recreating the account.
        throw new AuthFieldError('That username was just taken. Try another.', 'username');
      }
      if (raw.includes('INVALID_USERNAME')) {
        throw new AuthFieldError(
          '3–20 characters, letters, numbers and underscores only.',
          'username',
        );
      }
      throw new Error('Could not finish setting up your account. Please try again.');
    }

    const { error: answerError } = await supabase.rpc('set_security_answer', {
      p_question: securityQuestion,
      p_answer: securityAnswer.trim(),
    });
    if (answerError) {
      throw new Error('Could not save your security question. You can set it later from Settings.');
    }

    setPendingClaim(false);
  };

  // ── Login ───────────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(GENERIC_SIGNIN_ERROR);
  };

  // ── Password reset ──────────────────────────────────────────────────────────

  const getSecurityQuestion = async (email: string): Promise<string> => {
    const { data, status, message } = await invokeJson<{ question: string }>('get-security-question', {
      email,
    });

    if (status === 429) {
      throw new Error(message ?? 'Too many requests. Please try again later.');
    }
    if (!data?.question) {
      throw new Error(message ?? 'Something went wrong. Please try again.');
    }

    resetEmail.current = email;
    return data.question;
  };

  /**
   * Verify the answer via verify-security-answer, which mints a short-lived
   * session server-side. Establishes the session that setNewPassword then acts
   * on — same contract the old OTP-based reset used.
   */
  const verifySecurityAnswer = async (answer: string) => {
    const email = resetEmail.current;
    if (!email) throw new Error('No reset in progress.');

    const { data, status, message } = await invokeJson<{
      session: { access_token: string; refresh_token: string };
    }>('verify-security-answer', { email, answer });

    if (!data?.session) {
      if (status === 429) {
        throw new Error(message ?? 'Too many attempts. Please try again shortly.');
      }
      throw new Error(message ?? 'That answer is incorrect. Try again.');
    }

    const { error } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (error) throw new Error('Could not verify that answer. Please try again.');

    setResetPending(true);
  };

  const setNewPassword = async (password: string) => {
    if (password.length < 8) {
      throw new AuthFieldError('Password must be at least 8 characters long.', 'password');
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);

    setResetPending(false);
    resetEmail.current = null;

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
    // Otherwise a signup abandoned mid-claim would leave the next sign-in
    // permanently stuck on the auth stack — pendingClaim is in-memory only.
    setPendingClaim(false);
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    pendingClaim,
    checkUsername,
    signUp,
    claimProfile,
    signIn,
    getSecurityQuestion,
    verifySecurityAnswer,
    setNewPassword,
    resetPending,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
