import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';

const mockUser = { id: 'user-123', email: 'player@test.com', user_metadata: {} };
let mockAuthUser: any = mockUser;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

const { supabase } = jest.requireMock('@/services/supabase');
// Convenience: get the shared chain mock
const chain = () => (supabase.from as jest.Mock)();

describe('usePlayerProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = mockUser;
  });

  it('returns null player and loading=false immediately when there is no user', async () => {
    mockAuthUser = null;
    const { result } = renderHook(() => usePlayerProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.player).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('createPlayerProfile: inserts into players with wins:0, losses:0, and the user_id', async () => {
    // Initial fetchPlayer: no player yet
    chain().maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const createdRow = { id: 'p1', user_id: 'user-123', wins: 0, losses: 0 };
    chain().single.mockResolvedValueOnce({ data: createdRow, error: null });

    // fetchPlayer called after create
    chain().maybeSingle
      .mockResolvedValueOnce({ data: createdRow, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => usePlayerProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createPlayerProfile({
        name: 'Test Player',
        email: 'player@test.com',
        skill_level: 5,
        gender: 'male',
        city: 'Atlanta',
      });
    });

    const insertCall = chain().insert.mock.calls[0]?.[0];
    expect(insertCall).toMatchObject({
      user_id: 'user-123',
      email: 'player@test.com',
      wins: 0,
      losses: 0,
    });
  });

  it('createPlayerProfile: marks profile_completed=true in the profiles table', async () => {
    chain().maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    chain().single.mockResolvedValueOnce({
      data: { id: 'p1', user_id: 'user-123' },
      error: null,
    });
    chain().maybeSingle
      .mockResolvedValueOnce({ data: { id: 'p1', user_id: 'user-123' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => usePlayerProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createPlayerProfile({ name: 'Test', email: 'p@test.com' });
    });

    const updateCalls = chain().update.mock.calls;
    const profilesUpdate = updateCalls.find((args: any[]) =>
      args[0] && args[0].profile_completed === true
    );
    expect(profilesUpdate).toBeDefined();
  });

  it('updatePlayerProfile: routes city to BOTH players and profiles tables', async () => {
    const existingPlayer = { id: 'p1', user_id: 'user-123', name: 'Test', wins: 0, losses: 0 };

    // Initial load: player found
    chain().maybeSingle
      .mockResolvedValueOnce({ data: existingPlayer, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => usePlayerProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.player).not.toBeNull();

    // fetchPlayer after update
    chain().maybeSingle
      .mockResolvedValueOnce({ data: { ...existingPlayer, city: 'Atlanta' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await act(async () => {
      await result.current.updatePlayerProfile({ city: 'Atlanta' });
    });

    // city is in both PLAYERS_COLUMNS and PROFILES_COLUMNS — update must be called twice
    const updateCalls = chain().update.mock.calls;
    expect(updateCalls.length).toBe(2);
    expect(updateCalls[0][0]).toEqual({ city: 'Atlanta' });
    expect(updateCalls[1][0]).toEqual({ city: 'Atlanta' });
  });

  it('updatePlayerProfile: only writes to players when the field is players-only (not profiles)', async () => {
    const existingPlayer = { id: 'p1', user_id: 'user-123', name: 'Test', wins: 0, losses: 0 };

    chain().maybeSingle
      .mockResolvedValueOnce({ data: existingPlayer, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => usePlayerProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));

    chain().maybeSingle
      .mockResolvedValueOnce({ data: { ...existingPlayer, skill_level: 7 }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await act(async () => {
      await result.current.updatePlayerProfile({ skill_level: 7 });
    });

    // skill_level is players-only — profiles must NOT be updated
    const updateCalls = chain().update.mock.calls;
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0][0]).toEqual({ skill_level: 7 });
  });
});
