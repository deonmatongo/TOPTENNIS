import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SettingsScreen } from '@/screens/SettingsScreen';

const mockSignOut = jest.fn().mockResolvedValue(undefined);
let mockUser: any = { id: 'u1', email: 'player@test.com' };

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
  mockUser = { id: 'u1', email: 'player@test.com' };
  mockPlayer = { first_name: 'Alex', last_name: 'Smith' };
  navigation.navigate.mockReset();
});

describe('SettingsScreen', () => {
  it('renders without crashing', () => {
    expect(() => render(<SettingsScreen navigation={navigation} />)).not.toThrow();
  });

  describe('displayName', () => {
    it('shows full name from player profile', () => {
      const { getAllByText } = render(<SettingsScreen navigation={navigation} />);
      expect(getAllByText('Alex Smith').length).toBeGreaterThan(0);
    });

    it('falls back to "Player" when profile is null', () => {
      mockPlayer = null;
      const { getAllByText } = render(<SettingsScreen navigation={navigation} />);
      expect(getAllByText('Player').length).toBeGreaterThan(0);
    });

    it('shows partial name when only first name exists', () => {
      mockPlayer = { first_name: 'Jordan', last_name: '' };
      const { getAllByText } = render(<SettingsScreen navigation={navigation} />);
      expect(getAllByText('Jordan').length).toBeGreaterThan(0);
    });
  });

  describe('Admin panel', () => {
    it('is hidden for non-admin users', () => {
      mockUser = { id: 'u1', email: 'regular@example.com' };
      const { queryByText } = render(<SettingsScreen navigation={navigation} />);
      expect(queryByText('Admin Panel')).toBeNull();
    });

    it('is visible for admin@toptennis.app', () => {
      mockUser = { id: 'u1', email: 'admin@toptennis.app' };
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
      expect(getByText('Admin Panel')).toBeTruthy();
    });

    it('is visible for deon@toptennis.app', () => {
      mockUser = { id: 'u1', email: 'deon@toptennis.app' };
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
      expect(getByText('Admin Panel')).toBeTruthy();
    });
  });

  describe('handleSignOut()', () => {
    it('shows a confirmation Alert when Sign Out is pressed', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
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
      fireEvent.press(getByText('Sign Out'));
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('handleDeleteAccount()', () => {
    it('shows a confirmation Alert when Delete Account is pressed', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
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
      fireEvent.press(getByText('Delete Account'));
      await Promise.resolve();
      await Promise.resolve();

      expect(alertSpy).toHaveBeenCalledWith('Deletion Failed', 'server error');
      alertSpy.mockRestore();
    });
  });

  describe('handleAdminReset()', () => {
    it('shows first confirmation alert when admin presses Admin Panel', () => {
      mockUser = { id: 'u1', email: 'admin@toptennis.app' };
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByText } = render(<SettingsScreen navigation={navigation} />);
      fireEvent.press(getByText('Admin Panel'));
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
