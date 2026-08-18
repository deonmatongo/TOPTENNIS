import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AccountSection } from '@/screens/settings/AccountSection';

const supabaseMock = jest.requireMock('@/services/supabase').supabase;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'player@example.com' } }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
  supabaseMock.auth.updateUser.mockResolvedValue({ data: {}, error: null });
  supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  // The username lookup this screen performs on mount.
  supabaseMock.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { username: 'rallyking' }, error: null }),
  });
});

describe('AccountSection', () => {
  it('renders without crashing', async () => {
    render(<AccountSection navigation={navigation} />);
    await waitFor(() => expect(supabaseMock.from).toHaveBeenCalled());
  });

  it('renders identity rows including email', async () => {
    const { getByText } = render(<AccountSection navigation={navigation} />);
    expect(getByText('Edit Profile')).toBeTruthy();
    expect(getByText('Tennis Profile')).toBeTruthy();
    expect(getByText('Username')).toBeTruthy();
    expect(getByText('Email')).toBeTruthy();
    expect(getByText('Change Password')).toBeTruthy();

    await waitFor(() => expect(getByText('rallyking')).toBeTruthy());
  });

  it('shows the account email', async () => {
    const { getByText } = render(<AccountSection navigation={navigation} />);
    await waitFor(() => expect(supabaseMock.from).toHaveBeenCalled());
    expect(getByText(/player@example\.com/)).toBeTruthy();
  });

  describe('change password', () => {
    const openModal = async () => {
      const utils = render(<AccountSection navigation={navigation} />);
      await waitFor(() => expect(utils.getByText('rallyking')).toBeTruthy());
      fireEvent.press(utils.getByText('Change Password'));
      return utils;
    };

    it('rejects a short new password without calling supabase', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByPlaceholderText, getByText } = await openModal();

      fireEvent.changeText(getByPlaceholderText('Current password'), 'oldpassword');
      fireEvent.changeText(getByPlaceholderText(/New password/), 'short');
      fireEvent.changeText(getByPlaceholderText('Confirm new password'), 'short');
      fireEvent.press(getByText('Save'));

      expect(alertSpy).toHaveBeenCalledWith('Too short', expect.any(String));
      expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('rejects a mismatched confirmation', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByPlaceholderText, getByText } = await openModal();

      fireEvent.changeText(getByPlaceholderText('Current password'), 'oldpassword');
      fireEvent.changeText(getByPlaceholderText(/New password/), 'brandnewpass');
      fireEvent.changeText(getByPlaceholderText('Confirm new password'), 'differentpass');
      fireEvent.press(getByText('Save'));

      expect(alertSpy).toHaveBeenCalledWith('Passwords do not match', expect.any(String));
      expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('reauthenticates before changing the password', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByPlaceholderText, getByText } = await openModal();

      fireEvent.changeText(getByPlaceholderText('Current password'), 'oldpassword');
      fireEvent.changeText(getByPlaceholderText(/New password/), 'brandnewpass');
      fireEvent.changeText(getByPlaceholderText('Confirm new password'), 'brandnewpass');
      fireEvent.press(getByText('Save'));

      // Without the reauth step, anyone holding an unlocked phone could take the
      // account over without knowing the current password.
      await waitFor(() =>
        expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'player@example.com',
          password: 'oldpassword',
        }),
      );
      await waitFor(() =>
        expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'brandnewpass' }),
      );
      alertSpy.mockRestore();
    });

    it('does not change the password when the current one is wrong', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
        data: {},
        error: { message: 'Invalid login credentials' },
      });
      const { getByPlaceholderText, getByText } = await openModal();

      fireEvent.changeText(getByPlaceholderText('Current password'), 'wrongpassword');
      fireEvent.changeText(getByPlaceholderText(/New password/), 'brandnewpass');
      fireEvent.changeText(getByPlaceholderText('Confirm new password'), 'brandnewpass');
      fireEvent.press(getByText('Save'));

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith('Incorrect password', expect.any(String)),
      );
      expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });
  });
});
