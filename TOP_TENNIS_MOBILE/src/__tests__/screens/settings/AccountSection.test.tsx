import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { AccountSection } from '@/screens/settings/AccountSection';

const supabaseMock = jest.requireMock('@/services/supabase').supabase;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'player@test.com' } }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
});

describe('AccountSection', () => {
  it('renders without crashing', () => {
    expect(() => render(<AccountSection navigation={navigation} />)).not.toThrow();
  });

  it('renders standard navigation rows', () => {
    const { getByText } = render(<AccountSection navigation={navigation} />);
    expect(getByText('Edit Profile')).toBeTruthy();
    expect(getByText('Tennis Profile')).toBeTruthy();
    expect(getByText('Reset Password')).toBeTruthy();
    expect(getByText('Email Address')).toBeTruthy();
  });

  describe('change email', () => {
    it('opens the change-email modal from the Email Address row', () => {
      const { getByText, getByPlaceholderText } = render(<AccountSection navigation={navigation} />);
      fireEvent.press(getByText(/tap to change/));
      expect(getByPlaceholderText('New email address')).toBeTruthy();
    });

    it('rejects an invalid email without calling supabase', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { getByText, getByPlaceholderText } = render(<AccountSection navigation={navigation} />);
      fireEvent.press(getByText(/tap to change/));
      fireEvent.changeText(getByPlaceholderText('New email address'), 'not-an-email');
      fireEvent.press(getByText('Send Confirmation'));
      expect(alertSpy).toHaveBeenCalledWith('Invalid email', expect.any(String));
      expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('calls supabase.auth.updateUser with a valid new email', async () => {
      supabaseMock.auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });
      const { getByText, getByPlaceholderText } = render(<AccountSection navigation={navigation} />);
      fireEvent.press(getByText(/tap to change/));
      fireEvent.changeText(getByPlaceholderText('New email address'), 'new@example.com');
      fireEvent.press(getByText('Send Confirmation'));
      await waitFor(() =>
        expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ email: 'new@example.com' })
      );
    });
  });
});
