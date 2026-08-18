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

describe('AuthContext — email + password auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.signOut.mockResolvedValue({ error: null });
    supabase.auth.signUp.mockResolvedValue({ data: { session: SESSION, user: { id: 'u1' } }, error: null });
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null });
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

  it('signIn: calls signInWithPassword directly, no Edge Function', async () => {
    const result = await mount();

    await act(async () => { await result.current.signIn('player@example.com', 'hunter2xx'); });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.com',
      password: 'hunter2xx',
    });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('signIn: a failure produces one generic message', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    const result = await mount();

    await expectReject(() => result.current.signIn('ghost@example.com', 'whatever'), GENERIC_SIGNIN_ERROR);
  });

  // ── Signup ───────────────────────────────────────────────────────────────────

  it('signUp: creates the account and flips pendingClaim until claimProfile finishes', async () => {
    const result = await mount();

    await act(async () => { await result.current.signUp({ email: 'p@example.com', password: 'hunter2xx' }); });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'p@example.com', password: 'hunter2xx' });
    expect(result.current.pendingClaim).toBe(true);

    await act(async () => {
      await result.current.claimProfile({
        username: 'rallyking',
        securityQuestion: 'What was the name of your first pet?',
        securityAnswer: 'rex',
      });
    });

    expect(supabase.rpc).toHaveBeenCalledWith('claim_username', { p_username: 'rallyking' });
    expect(supabase.rpc).toHaveBeenCalledWith('set_security_answer', {
      p_question: 'What was the name of your first pet?',
      p_answer: 'rex',
    });
    expect(result.current.pendingClaim).toBe(false);
  });

  it('signUp: rejects a short password before any network call', async () => {
    const result = await mount();
    await expectReject(
      () => result.current.signUp({ email: 'p@example.com', password: 'short' }),
      /at least 8 characters/i,
    );
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('signUp: an already-registered email is reported as a field error', async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'u1', identities: [] }, session: null },
      error: null,
    });
    const result = await mount();
    await expectReject(
      () => result.current.signUp({ email: 'taken@example.com', password: 'hunter2xx' }),
      /already registered/i,
    );
  });

  it('claimProfile: a lost username race keeps the session so a retry works', async () => {
    const result = await mount();
    await act(async () => { await result.current.signUp({ email: 'p@example.com', password: 'hunter2xx' }); });

    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'USERNAME_TAKEN' } });
    await expectReject(
      () => result.current.claimProfile({
        username: 'rallyking',
        securityQuestion: 'q',
        securityAnswer: 'rex',
      }),
      /just taken/i,
    );
    expect(result.current.pendingClaim).toBe(true);

    supabase.rpc.mockResolvedValueOnce({ data: null, error: null }); // claim_username
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null }); // set_security_answer
    await act(async () => {
      await result.current.claimProfile({
        username: 'rallyking2',
        securityQuestion: 'q',
        securityAnswer: 'rex',
      });
    });

    expect(supabase.rpc).toHaveBeenLastCalledWith('set_security_answer', { p_question: 'q', p_answer: 'rex' });
    expect(result.current.pendingClaim).toBe(false);
  });

  // ── Password reset ───────────────────────────────────────────────────────────

  it('getSecurityQuestion: resolves to a question for any well-formed email', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({
      data: { question: 'What was the name of your first pet?' },
      error: null,
    });
    const result = await mount();

    let question = '';
    await act(async () => { question = await result.current.getSecurityQuestion('ghost@example.com'); });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('get-security-question', {
      body: { email: 'ghost@example.com' },
    });
    expect(question).toBe('What was the name of your first pet?');
  });

  it('verifySecurityAnswer: goes through the Edge Function and establishes a session', async () => {
    const result = await mount();
    supabase.functions.invoke.mockResolvedValueOnce({ data: { question: 'q' }, error: null });
    await act(async () => { await result.current.getSecurityQuestion('player@example.com'); });

    supabase.functions.invoke.mockResolvedValueOnce({ data: { session: SESSION }, error: null });
    await act(async () => { await result.current.verifySecurityAnswer('rex'); });

    expect(supabase.functions.invoke).toHaveBeenLastCalledWith('verify-security-answer', {
      body: { email: 'player@example.com', answer: 'rex' },
    });
    expect(supabase.auth.setSession).toHaveBeenCalledWith(SESSION);
    expect(result.current.resetPending).toBe(true);
  });

  it('verifySecurityAnswer: refuses when no reset was requested', async () => {
    const result = await mount();
    await expectReject(() => result.current.verifySecurityAnswer('rex'), /no reset in progress/i);
  });

  it('setNewPassword: revokes every session so the user must sign in again', async () => {
    const result = await mount();
    supabase.functions.invoke.mockResolvedValueOnce({ data: { question: 'q' }, error: null });
    await act(async () => { await result.current.getSecurityQuestion('player@example.com'); });
    supabase.functions.invoke.mockResolvedValueOnce({ data: { session: SESSION }, error: null });
    await act(async () => { await result.current.verifySecurityAnswer('rex'); });

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
    // through signup before claim_username rejected the handle.
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
