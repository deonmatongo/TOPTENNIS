import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SettingsScreen } from '@/screens/SettingsScreen';

const mockSignOut = jest.fn().mockResolvedValue(undefined);
let mockUser: any = { id: 'u1', email: 'player@example.com' };

/**
 * Admin status now comes from the has_role() RPC rather than an email allowlist,
 * so these tests drive the RPC. The old allowlist would have stripped admin from
 * everyone the moment accounts stopped having email addresses.
 */
const setAdmin = (isAdmin: boolean) => {
  jest
    .requireMock('@/services/supabase')
    .supabase.rpc.mockResolvedValue({ data: isAdmin, error: null });
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, signOut: mockSignOut }),
}));

let mockPlayer: any = { first_name: 'Alex', last_name: 'Smith' };
jest.mock('@/hooks/usePlayerProfile', () => ({
  usePlayerProfile: () => ({ player: mockPlayer }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const getSupabase = () => jest.requireMock('@/services/supabase').supabase;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'player@example.com' };
  mockPlayer = { first_name: 'Alex', last_name: 'Smith' };
  navigation.navigate.mockReset();
  setAdmin(false);
});

/** Switch the segmented control to the Settings tab. */
const goToSettingsTab = (getByText: (text: string) => any) => {
  // The SegControl renders a "Profile" and a "Settings" option.
  // The "Settings" option is the second tab in the control.
  fireEvent.press(getByText('Settings'));
};

describe('SettingsScreen', () => {
  it('renders without crashing', async () => {
    render(<SettingsScreen navigation={navigation} />);
    await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
  });

  describe('displayName', () => {
    it('shows full name from player profile', async () => {
      const { getAllByText } = render(<SettingsScreen navigation={navigation} />);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      expect(getAllByText('Alex Smith').length).toBeGreaterThan(0);
    });

    it('falls back to "Player" when profile is null', async () => {
      mockPlayer = null;
      const { getAllByText } = render(<SettingsScreen navigation={navigation} />);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      expect(getAllByText('Player').length).toBeGreaterThan(0);
    });

    it('shows partial name when only first name exists', async () => {
      mockPlayer = { first_name: 'Jordan', last_name: '' };
      const { getAllByText } = render(<SettingsScreen navigation={navigation} />);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      expect(getAllByText('Jordan').length).toBeGreaterThan(0);
    });
  });

  describe('Admin panel', () => {
    it('is hidden when has_role returns false', async () => {
      setAdmin(false);
      const { queryByText, getByText } = render(<SettingsScreen navigation={navigation} />);
      goToSettingsTab(getByText);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      expect(queryByText('Admin Panel')).toBeNull();
    });

    it('is visible when has_role returns true', async () => {
      setAdmin(true);
      const { findByText, getByText } = render(<SettingsScreen navigation={navigation} />);
      goToSettingsTab(getByText);
      expect(await findByText('Admin Panel')).toBeTruthy();
    });

    it('queries has_role with the signed-in user id and the admin role', async () => {
      setAdmin(true);
      render(<SettingsScreen navigation={navigation} />);
      await waitFor(() =>
        expect(getSupabase().rpc).toHaveBeenCalledWith('has_role', {
          _user_id: 'u1',
          _role: 'admin',
        }),
      );
    });

    it('fails closed when the has_role lookup errors', async () => {
      // A lookup failure must never grant admin.
      getSupabase().rpc.mockResolvedValue({ data: null, error: new Error('boom') });
      const { queryByText, getByText } = render(<SettingsScreen navigation={navigation} />);
      goToSettingsTab(getByText);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      expect(queryByText('Admin Panel')).toBeNull();
    });
  });

  describe('handleSignOut()', () => {
    it('shows a confirmation Alert when Sign Out is pressed', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      goToSettingsTab(getByText);
      fireEvent.press(getByText('Sign Out'));
      expect(alertSpy).toHaveBeenCalledWith(
        'Sign Out',
        'Are you sure you want to sign out?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Sign Out' }),
        ]),
      );
      alertSpy.mockRestore();
    });

    it('calls signOut when the destructive button is pressed', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons: any) => {
        const btn = buttons?.find((b: any) => b.style === 'destructive');
        btn?.onPress?.();
      });
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      goToSettingsTab(getByText);
      fireEvent.press(getByText('Sign Out'));
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('handleDeleteAccount()', () => {
    it('shows a confirmation Alert when Delete Account is pressed', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      goToSettingsTab(getByText);
      fireEvent.press(getByText('Delete Account'));
      expect(alertSpy).toHaveBeenCalledWith(
        'Delete Account',
        expect.stringContaining('permanently delete'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Delete Account' }),
        ]),
      );
      alertSpy.mockRestore();
    });

    it('calls supabase.functions.invoke with userId on confirm', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons: any) => {
        const btn = buttons?.find((b: any) => b.style === 'destructive');
        btn?.onPress?.();
      });
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      goToSettingsTab(getByText);
      fireEvent.press(getByText('Delete Account'));
      await Promise.resolve(); // flush microtasks
      expect(getSupabase().functions.invoke).toHaveBeenCalledWith(
        'delete-account',
        { body: { userId: 'u1' } },
      );
    });

    it('shows error Alert when functions.invoke fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert')
        .mockImplementationOnce((_t, _m, buttons: any) => {
          // confirm the delete
          const btn = buttons?.find((b: any) => b.style === 'destructive');
          btn?.onPress?.();
        })
        .mockImplementation(() => {});
      getSupabase().functions.invoke.mockResolvedValueOnce({ data: null, error: new Error('server error') });

      const { getByText } = render(<SettingsScreen navigation={navigation} />);
      await waitFor(() => expect(getSupabase().rpc).toHaveBeenCalled());
      goToSettingsTab(getByText);
      fireEvent.press(getByText('Delete Account'));
      await Promise.resolve();
      await Promise.resolve();

      expect(alertSpy).toHaveBeenCalledWith('Deletion Failed', 'server error');
      alertSpy.mockRestore();
    });
  });

  describe('handleAdminReset()', () => {
    it('shows first confirmation alert when admin presses Admin Panel', async () => {
      setAdmin(true);
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { findByText, getByText } = render(<SettingsScreen navigation={navigation} />);
      goToSettingsTab(getByText);
      fireEvent.press(await findByText('Admin Panel'));
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reset All User Data'),
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Yes, I Understand' }),
        ]),
      );
      alertSpy.mockRestore();
    });
  });
});
