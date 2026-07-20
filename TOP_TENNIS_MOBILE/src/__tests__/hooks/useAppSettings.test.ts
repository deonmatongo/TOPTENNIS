import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAppSettings, SETTINGS_DEFAULTS } from '@/hooks/useAppSettings';

const mockUser = { id: 'user-123', email: 'player@test.com' };
let mockAuthUser: any = mockUser;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

const getDB = () => (jest.requireMock('@/services/supabase').supabase.from as jest.Mock)();

describe('useAppSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = mockUser;
  });

  it('sets loading=false and returns defaults when there is no user', async () => {
    mockAuthUser = null;
    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings).toEqual(SETTINGS_DEFAULTS);
    expect(result.current.saving).toBe(false);
  });

  it('loads settings from supabase when user exists', async () => {
    const dbData = { ...SETTINGS_DEFAULTS, haptics_enabled: false };
    getDB().single.mockResolvedValueOnce({ data: dbData, error: null });

    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings.haptics_enabled).toBe(false);
    expect(result.current.settings.sound_effects).toBe(true);
  });

  it('skips null values from DB and preserves defaults', async () => {
    getDB().single.mockResolvedValueOnce({
      data: { haptics_enabled: false, sound_effects: null },
      error: null,
    });

    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings.haptics_enabled).toBe(false);
    expect(result.current.settings.sound_effects).toBe(SETTINGS_DEFAULTS.sound_effects);
  });

  it('uses defaults when DB returns no data', async () => {
    getDB().single.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('uses defaults when DB fetch throws', async () => {
    getDB().single.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings).toEqual(SETTINGS_DEFAULTS);
  });

  it('update() applies patch optimistically and calls upsert', async () => {
    getDB().single.mockResolvedValueOnce({ data: null, error: null });

    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update({ haptics_enabled: false });
    });

    expect(result.current.settings.haptics_enabled).toBe(false);
    expect(getDB().upsert).toHaveBeenCalledWith(
      expect.objectContaining({ haptics_enabled: false, user_id: mockUser.id }),
      { onConflict: 'user_id' },
    );
  });

  it('update() reverts to previous settings and shows Alert when upsert throws', async () => {
    getDB().single.mockResolvedValueOnce({ data: null, error: null });
    getDB().upsert.mockRejectedValueOnce(new Error('save failed'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const original = result.current.settings.haptics_enabled;

    await act(async () => {
      await result.current.update({ haptics_enabled: !original });
    });

    expect(result.current.settings.haptics_enabled).toBe(original);
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not save setting. Please try again.');
    alertSpy.mockRestore();
  });

  it('saving flag is true during upsert and false after', async () => {
    getDB().single.mockResolvedValueOnce({ data: null, error: null });
    let resolveFn: (v: any) => void;
    getDB().upsert.mockReturnValueOnce(new Promise(r => { resolveFn = r; }));

    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.update({ sound_effects: false }); });
    await waitFor(() => expect(result.current.saving).toBe(true));

    await act(async () => { resolveFn!({ error: null }); });
    await waitFor(() => expect(result.current.saving).toBe(false));
  });
});
