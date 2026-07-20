import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert, Switch } from 'react-native';
import { AccountSection } from '@/screens/settings/AccountSection';

const mockClearCredentials = jest.fn();
const mockAuthenticate = jest.fn();
let mockBiometricsAvailable = false;
let mockCredentialsStored = false;
let mockBiometricLabel = 'Face ID';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'player@test.com' } }),
}));

jest.mock('@/hooks/useBiometrics', () => ({
  useBiometrics: () => ({
    available: mockBiometricsAvailable,
    biometricLabel: mockBiometricLabel,
    credentialsStored: mockCredentialsStored,
    clearCredentials: mockClearCredentials,
    authenticate: mockAuthenticate,
  }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockBiometricsAvailable = false;
  mockCredentialsStored = false;
  mockBiometricLabel = 'Face ID';
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
    expect(getByText('Account Security')).toBeTruthy();
    expect(getByText('Email Address')).toBeTruthy();
  });

  it('does not show biometric row when biometrics are unavailable', () => {
    mockBiometricsAvailable = false;
    const { queryByText } = render(<AccountSection navigation={navigation} />);
    expect(queryByText('Face ID Sign-In')).toBeNull();
  });

  it('shows biometric row when biometrics are available', () => {
    mockBiometricsAvailable = true;
    const { getByText } = render(<AccountSection navigation={navigation} />);
    expect(getByText('Face ID Sign-In')).toBeTruthy();
  });

  describe('handleToggleBiometrics()', () => {
    it('shows enable-instructions Alert when credentials are NOT stored', () => {
      mockBiometricsAvailable = true;
      mockCredentialsStored = false;
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { UNSAFE_getByType } = render(<AccountSection navigation={navigation} />);
      const sw = UNSAFE_getByType(Switch);
      sw.props.onValueChange(true);
      expect(alertSpy).toHaveBeenCalledWith(
        'Enable Face ID',
        expect.stringContaining('sign out and back in'),
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });

    it('shows disable-confirmation Alert when credentials ARE stored', () => {
      mockBiometricsAvailable = true;
      mockCredentialsStored = true;
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { UNSAFE_getByType } = render(<AccountSection navigation={navigation} />);
      const sw = UNSAFE_getByType(Switch);
      sw.props.onValueChange(false);
      expect(alertSpy).toHaveBeenCalledWith(
        'Disable Face ID',
        expect.stringContaining('no longer be able'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Disable' }),
        ]),
      );
      alertSpy.mockRestore();
    });

    it('calls clearCredentials when Disable is confirmed', () => {
      mockBiometricsAvailable = true;
      mockCredentialsStored = true;
      jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons: any) => {
        const btn = buttons?.find((b: any) => b.style === 'destructive');
        btn?.onPress?.();
      });
      const { UNSAFE_getByType } = render(<AccountSection navigation={navigation} />);
      const sw = UNSAFE_getByType(Switch);
      sw.props.onValueChange(false);
      expect(mockClearCredentials).toHaveBeenCalled();
    });

    it('works with Fingerprint label when biometric type is fingerprint', () => {
      mockBiometricsAvailable = true;
      mockBiometricLabel = 'Fingerprint';
      mockCredentialsStored = false;
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const { UNSAFE_getByType } = render(<AccountSection navigation={navigation} />);
      const sw = UNSAFE_getByType(Switch);
      sw.props.onValueChange(true);
      expect(alertSpy).toHaveBeenCalledWith(
        'Enable Fingerprint',
        expect.any(String),
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });
  });
});
