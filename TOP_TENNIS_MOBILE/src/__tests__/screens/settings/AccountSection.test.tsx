import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AccountSection } from '@/screens/settings/AccountSection';

const supabaseMock = jest.requireMock('@/services/supabase').supabase;

// Phone-only user with no email at all, which is the normal case now.
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', phone: '15551230001' } }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
  supabaseMock.auth.updateUser.mockResolvedValue({ data: {}, error: null });
  supabaseMock.functions.invoke.mockResolvedValue({ data: { session: {} }, error: null });
  // The username lookup this screen performs on mount.
  supabaseMock.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { username: 'rallyking' }, error: null }),
  });
});

describe('AccountSection', () => {
  it('renders without crashing', () => {
    expect(() => render(<AccountSection navigation={navigation} />)).not.toThrow();
  });

  it('renders identity rows and no longer offers email', async () => {
    const { getByText, queryByText } = render(<AccountSection navigation={navigation} />);
    expect(getByText('Edit Profile')).toBeTruthy();
    expect(getByText('Tennis Profile')).toBeTruthy();
    expect(getByText('Username')).toBeTruthy();
    expect(getByText('Phone Number')).toBeTruthy();
    expect(getByText('Change Password')).toBeTruthy();

    // Email is neither an identifier nor a recovery channel any more, so it must
    // not appear here — a dead field would still look authoritative.
    expect(queryByText('Email Address')).toBeNull();

    await waitFor(() => expect(getByText('rallyking')).toBeTruthy());
  });

  it('masks the phone number to its last four digits', () => {
    // The full number never reaches a client; only the last 4 may be displayed.
    const { getByText, queryByText } = render(<AccountSection navigation={navigation} />);
    expect(getByText(/0001/)).toBeTruthy();
    expect(queryByText(/15551230001/)).toBeNull();
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
        expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('login-with-username', {
          body: { identifier: 'rallyking', password: 'oldpassword' },
        }),
      );
      await waitFor(() =>
        expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'brandnewpass' }),
      );
      alertSpy.mockRestore();
    });

    it('does not change the password when the current one is wrong', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      supabaseMock.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: new Error('FunctionsHttpError'),
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
