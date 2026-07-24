import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSendMatchInvite } from '@/hooks/useSendMatchInvite';

const mockUser = { id: 'sender-111', email: 'sender@test.com' };
let mockAuthUser: any = mockUser;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

const { supabase } = jest.requireMock('@/services/supabase');

const validPayload = {
  receiver_id: 'receiver-222',
  date: '2025-08-10',
  start_time: '10:00',
  end_time: '11:30',
  court_location: 'Centennial Tennis Center',
};

describe('useSendMatchInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = mockUser;
    // supabase.rpc is not in the shared setup mock — add it here
    supabase.rpc = jest.fn().mockResolvedValue({ error: null });
    // insert must resolve (chain's then handles it, but set insert explicitly)
    (supabase.from as jest.Mock)().insert.mockResolvedValue({ error: null });
  });

  it('throws "Not authenticated" immediately when there is no signed-in user', async () => {
    mockAuthUser = null;
    const { result } = renderHook(() => useSendMatchInvite());

    await expect(
      act(async () => result.current.sendInvite(validPayload))
    ).rejects.toThrow('Not authenticated');

    const tablesWritten = (supabase.from as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(tablesWritten).not.toContain('match_invites');
  });

  it('inserts into match_invites with status "pending" and correct sender/receiver', async () => {
    const { result } = renderHook(() => useSendMatchInvite());

    await act(async () => result.current.sendInvite(validPayload));

    expect(supabase.from).toHaveBeenCalledWith('match_invites');
    const insertCall = (supabase.from as jest.Mock)().insert.mock.calls[0]?.[0];
    expect(insertCall).toMatchObject({
      sender_id: 'sender-111',
      receiver_id: 'receiver-222',
      date: '2025-08-10',
      start_time: '10:00',
      end_time: '11:30',
      status: 'pending',
    });
  });

  it('calls the notification RPC after a successful insert', async () => {
    const { result } = renderHook(() => useSendMatchInvite());

    await act(async () => result.current.sendInvite(validPayload));

    expect(supabase.rpc).toHaveBeenCalledWith(
      'insert_notification_safe',
      expect.objectContaining({
        p_user_id: 'receiver-222',
        p_type: 'match_invite',
      })
    );
  });

  it('throws and resets sending=false when the insert fails', async () => {
    (supabase.from as jest.Mock)().insert.mockResolvedValueOnce({
      error: new Error('DB write failed'),
    });

    const { result } = renderHook(() => useSendMatchInvite());

    await expect(
      act(async () => result.current.sendInvite(validPayload))
    ).rejects.toThrow('DB write failed');

    expect(result.current.sending).toBe(false);
  });
});
