import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth, GENERIC_SIGNIN_ERROR } from '@/contexts/AuthContext';

const { supabase } = jest.requireMock('@/services/supabase');

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

/**
 * Builds the error shape supabase.functions.invoke produces for a non-2xx: the
 * body is only reachable through error.context.json(), which is exactly the trap
 * invokeJson exists to handle.
 */
const fnError = (status: number, body: Record<string, unknown>) => ({
  data: null,
  error: Object.assign(new Error('FunctionsHttpError'), {
    context: { status, json: async () => body },
  }),
});

const SESSION = { access_token: 'at', refresh_token: 'rt' };

describe('AuthContext — phone + username auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.signOut.mockResolvedValue({ error: null });
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    supabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    supabase.auth.setSession.mockResolvedValue({ data: {}, error: null });
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  const mount = async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    return result;
  };

  /**
   * Assert a rejection with the expect INSIDE act, not act inside expect.
   * Wrapping a rejecting promise in act() opens an act scope that never closes
   * cleanly, which unmounts the renderer and fails every later test in the file.
   */
  const expectReject = async (call: () => Promise<unknown>, matcher: RegExp | string) => {
    await act(async () => {
      await expect(call()).rejects.toThrow(matcher as never);
    });
  };

  it('restores a persisted session on mount without signing out', async () => {
    const result = await mount();
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  // ── Login ────────────────────────────────────────────────────────────────────

  it('signIn: routes through the Edge Function and never resolves a username locally', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({ data: { session: SESSION }, error: null });
    const result = await mount();

    await act(async () => { await result.current.signIn('rallyking', 'hunter2xx'); });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('login-with-username', {
      body: { identifier: 'rallyking', password: 'hunter2xx', defaultCountry: 'US' },
    });
    // The phone path must NOT shortcut to a direct client sign-in: that would
    // give it a different latency profile and leak account existence by timing.
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(supabase.auth.setSession).toHaveBeenCalledWith(SESSION);
  });

  it('signIn: forwards only the two tokens, even if the server returns a fat session', async () => {
    // Regression guard. login-with-username originally returned GoTrue's session
    // object wholesale, whose nested `user` carries phone, email and metadata —
    // defeating the point of resolving the username server-side. The server was
    // fixed to trim it; this asserts the client never relays the extra fields
    // even if something upstream starts sending them again.
    supabase.functions.invoke.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'at',
          refresh_token: 'rt',
          token_type: 'bearer',
          expires_in: 3600,
          weak_password: null,
          user: { id: 'u1', phone: '14155550100', email: 'leak@example.com' },
        },
      },
      error: null,
    });
    const result = await mount();

    await act(async () => { await result.current.signIn('rallyking', 'hunter2xx'); });

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'at',
      refresh_token: 'rt',
    });
    const forwarded = JSON.stringify(supabase.auth.setSession.mock.calls[0][0]);
    expect(forwarded).not.toContain('14155550100');
    expect(forwarded).not.toContain('leak@example.com');
  });

  it('signIn: a phone number identifier also goes through the Edge Function', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({ data: { session: SESSION }, error: null });
    const result = await mount();

    await act(async () => { await result.current.signIn('+15551230001', 'hunter2xx'); });

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'login-with-username',
      expect.objectContaining({ body: expect.objectContaining({ identifier: '+15551230001' }) }),
    );
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signIn: unknown account produces the same generic error as a wrong password', async () => {
    supabase.functions.invoke.mockResolvedValueOnce(
      fnError(401, { error: 'Incorrect username or password.' }),
    );
    const result = await mount();

    await expectReject(() => result.current.signIn('ghost', 'whatever'), GENERIC_SIGNIN_ERROR);

    supabase.functions.invoke.mockResolvedValueOnce(
      fnError(401, { error: 'Incorrect username or password.' }),
    );
    await expectReject(() => result.current.signIn('rallyking', 'wrongpass'), GENERIC_SIGNIN_ERROR);
  });

  it('signIn: a rate-limit trip is surfaced distinctly from a credential failure', async () => {
    supabase.functions.invoke.mockResolvedValueOnce(
      fnError(429, { error: 'Too many attempts. Please try again shortly.' }),
    );
    const result = await mount();

    // 429 is about the caller's own behaviour, so it reveals nothing about the
    // account and should not be flattened into the generic message.
    await expectReject(() => result.current.signIn('rallyking', 'hunter2xx'), 'Too many attempts. Please try again shortly.');
  });

  // ── Signup ───────────────────────────────────────────────────────────────────

  const startSignup = async (result: any) => {
    supabase.functions.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await act(async () => {
      await result.current.startSignup({
        phone: '5551230001',
        username: 'rallyking',
        password: 'hunter2xx',
      });
    });
  };

  it('startSignup: never sends the password to the pre-auth endpoint', async () => {
    const result = await mount();
    await startSignup(result);

    const [fn, opts] = supabase.functions.invoke.mock.calls[0];
    expect(fn).toBe('start-signup');
    expect(opts.body).not.toHaveProperty('password');
    expect(JSON.stringify(opts.body)).not.toContain('hunter2xx');
    // The pending phone is normalised to E.164 so completeSignup's verifyOtp
    // uses the same string GoTrue issued the OTP against. This response has no
    // `phone`, so it comes from the local libphonenumber fallback.
    expect(result.current.pendingSignup).toEqual({
      phone: '+15551230001',
      username: 'rallyking',
      password: 'hunter2xx',
    });
  });

  it('startSignup: prefers the canonical phone returned by start-signup', async () => {
    const result = await mount();
    supabase.functions.invoke.mockResolvedValueOnce({
      data: { ok: true, phone: '+15551230001' },
      error: null,
    });
    await act(async () => {
      await result.current.startSignup({
        phone: '(555) 123-0001',
        username: 'rallyking',
        password: 'hunter2xx',
      });
    });

    expect(result.current.pendingSignup.phone).toBe('+15551230001');
  });

  it('startSignup: rejects a short password before any network call', async () => {
    const result = await mount();
    await expectReject(
      () => result.current.startSignup({ phone: '5551230001', username: 'x_1', password: 'short' }),
      /at least 8 characters/i,
    );
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('verifyPhoneOtp: a wrong code does not distinguish itself from an expired one', async () => {
    const result = await mount();
    await startSignup(result);

    supabase.auth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    });
    await expectReject(() => result.current.verifyPhoneOtp('000000'), 'That code is incorrect or has expired. Request a new one.');

    // Same message for a plain wrong code — an attacker must not learn whether a
    // code was ever valid.
    supabase.auth.verifyOtp.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid token' },
    });
    await expectReject(() => result.current.verifyPhoneOtp('111111'), 'That code is incorrect or has expired. Request a new one.');
  });

  it('completeSignup: sets the password then claims the username', async () => {
    const result = await mount();
    await startSignup(result);

    await act(async () => { await result.current.completeSignup(); });

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'hunter2xx' });
    expect(supabase.rpc).toHaveBeenCalledWith('claim_identity', { p_username: 'rallyking' });
    expect(result.current.pendingSignup).toBeNull();
  });

  it('completeSignup: a lost username race keeps the verified session so a retry works', async () => {
    const result = await mount();
    await startSignup(result);

    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'USERNAME_TAKEN' },
    });

    await expectReject(() => result.current.completeSignup(), /just taken/i);

    // The pending signup survives, so the user picks another handle instead of
    // redoing SMS verification for someone else's timing.
    expect(result.current.pendingSignup).not.toBeNull();

    supabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => { await result.current.completeSignup('rallyking2'); });

    expect(supabase.rpc).toHaveBeenLastCalledWith('claim_identity', { p_username: 'rallyking2' });
    expect(result.current.pendingSignup).toBeNull();
  });

  it('completeSignup: an unverified phone is rejected', async () => {
    const result = await mount();
    await startSignup(result);
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'PHONE_NOT_VERIFIED' },
    });
    await expectReject(() => result.current.completeSignup(), /not verified/i);
  });

  // ── Password reset ───────────────────────────────────────────────────────────

  it('requestPasswordReset: resolves normally for an unknown account', async () => {
    // The Edge Function answers { ok: true } either way, so the client must not
    // invent a "no such user" branch — that would rebuild the enumeration oracle.
    supabase.functions.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await mount();

    await act(async () => { await result.current.requestPasswordReset('ghost'); });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('resolve-for-reset', {
      body: { identifier: 'ghost', defaultCountry: 'US' },
    });
  });

  it('verifyResetOtp: goes through the Edge Function, not a local verifyOtp', async () => {
    const result = await mount();
    supabase.functions.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await act(async () => { await result.current.requestPasswordReset('rallyking'); });

    supabase.functions.invoke.mockResolvedValueOnce({ data: { session: SESSION }, error: null });
    await act(async () => { await result.current.verifyResetOtp('123456'); });

    // A local verifyOtp is impossible on the username path: the client is never
    // told which number the code went to.
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(supabase.functions.invoke).toHaveBeenLastCalledWith('verify-reset-code', {
      body: { identifier: 'rallyking', token: '123456', defaultCountry: 'US' },
    });
    expect(result.current.resetPending).toBe(true);
  });

  it('verifyResetOtp: refuses when no reset was requested', async () => {
    const result = await mount();
    await expectReject(() => result.current.verifyResetOtp('123456'), /no reset in progress/i);
  });

  it('setNewPassword: revokes every session so the user must sign in again', async () => {
    const result = await mount();
    supabase.functions.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await act(async () => { await result.current.requestPasswordReset('rallyking'); });
    supabase.functions.invoke.mockResolvedValueOnce({ data: { session: SESSION }, error: null });
    await act(async () => { await result.current.verifyResetOtp('123456'); });

    await act(async () => { await result.current.setNewPassword('brandnewpass'); });

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'brandnewpass' });
    // scope 'global' invalidates this session too — a reset must not double as a
    // way into the app, and must kill any session an attacker already holds.
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(result.current.resetPending).toBe(false);
  });

  it('setNewPassword: enforces the minimum length before calling out', async () => {
    const result = await mount();
    await expectReject(() => result.current.setNewPassword('short'), /at least 8 characters/i);
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  // ── Username availability ────────────────────────────────────────────────────

  it('checkUsername: a failed check reports unavailable rather than free', async () => {
    supabase.functions.invoke.mockResolvedValueOnce(
      fnError(500, { error: 'Could not check that username. Try again.' }),
    );
    const result = await mount();

    // Reporting "available" on a failure would let the user get all the way
    // through SMS verification before claim_identity rejected the handle.
    const check = await result.current.checkUsername('rallyking');
    expect(check.available).toBe(false);
  });

  // ── Sign out ─────────────────────────────────────────────────────────────────

  it('signOut: clears push_token from profiles then calls auth.signOut', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-123' }, access_token: 'at' } },
    });
    const result = await mount();

    await act(async () => { await result.current.signOut(); });

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
