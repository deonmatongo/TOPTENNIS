import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: 'cancel' }),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'toptennis://auth/callback'),
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const { supabase } = jest.requireMock('@/services/supabase');

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // auth.signOut needs to return a Promise for the manual sign-out tests
    supabase.auth.signOut.mockResolvedValue({ error: null });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  it('restores a persisted session on mount without signing out', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // getSession is called to restore the session; signOut is NOT called on mount
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    // Default mock returns null session, so user starts as null
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it('signIn: calls signInWithPassword with the provided credentials', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn('player@test.com', 'hunter2xx');
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@test.com',
      password: 'hunter2xx',
    });
  });

  it('signIn: throws when Supabase returns an error', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      error: new Error('Invalid login credentials'),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => result.current.signIn('bad@test.com', 'wrongpass'))
    ).rejects.toThrow('Invalid login credentials');
  });

  it('signUp: rejects without calling Supabase when password is under 8 characters', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => result.current.signUp('user@test.com', 'short', 'First', 'Last'))
    ).rejects.toThrow('Password must be at least 8 characters');

    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('signUp: converts "already registered" Supabase error into a user-readable message', async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      error: new Error('User already registered'),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () =>
        result.current.signUp('dup@test.com', 'password123', 'First', 'Last')
      )
    ).rejects.toThrow('An account with this email already exists');
  });

  it('signOut: clears push_token from profiles then calls auth.signOut', async () => {
    // Simulate a signed-in user arriving via onAuthStateChange
    supabase.auth.onAuthStateChange.mockImplementationOnce((cb: any) => {
      cb('SIGNED_IN', { user: { id: 'user-abc', email: 'player@test.com' } });
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.signOut());

    const tablesAccessed = (supabase.from as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(tablesAccessed).toContain('profiles');
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
