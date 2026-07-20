import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { SupportSection } from '@/screens/settings/SupportSection';

const navigation = { goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  navigation.goBack.mockReset();
});

describe('SupportSection', () => {
  it('renders without crashing', () => {
    expect(() => render(<SupportSection navigation={navigation} />)).not.toThrow();
  });

  it('renders all section item labels', () => {
    const { getByText } = render(<SupportSection navigation={navigation} />);
    expect(getByText('Contact Support')).toBeTruthy();
    expect(getByText('Rate the App')).toBeTruthy();
    expect(getByText('Share Top Tennis')).toBeTruthy();
    expect(getByText('Calendar Access')).toBeTruthy();
    expect(getByText('Notification Permissions')).toBeTruthy();
    expect(getByText('Clear Cache')).toBeTruthy();
    expect(getByText('Export My Data')).toBeTruthy();
    expect(getByText('Terms of Service')).toBeTruthy();
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  it('calls Linking.openURL with support email when Contact Support is pressed', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Contact Support'));
    expect(openURLSpy).toHaveBeenCalledWith('mailto:support@toptennis.app');
    openURLSpy.mockRestore();
  });

  it('calls Linking.openURL for Terms of Service', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Terms of Service'));
    expect(openURLSpy).toHaveBeenCalledWith('https://toptennis.app/terms');
    openURLSpy.mockRestore();
  });

  it('calls Linking.openURL for Privacy Policy', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Privacy Policy'));
    expect(openURLSpy).toHaveBeenCalledWith('https://toptennis.app/privacy');
    openURLSpy.mockRestore();
  });

  it('calls Linking.openSettings for Calendar Access', () => {
    const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Calendar Access'));
    expect(openSettingsSpy).toHaveBeenCalled();
    openSettingsSpy.mockRestore();
  });

  it('calls Linking.openSettings for Notification Permissions', () => {
    const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Notification Permissions'));
    expect(openSettingsSpy).toHaveBeenCalled();
    openSettingsSpy.mockRestore();
  });

  it('shows Alert when Rate the App is pressed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Rate the App'));
    expect(alertSpy).toHaveBeenCalledWith('Rate the App', expect.any(String));
    alertSpy.mockRestore();
  });

  it('shows Alert when Clear Cache is pressed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Clear Cache'));
    expect(alertSpy).toHaveBeenCalledWith('Clear Cache', expect.any(String), expect.any(Array));
    alertSpy.mockRestore();
  });

  it('falls back to an Alert when Linking.openURL rejects', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Contact Support'));
    await Promise.resolve(); // flush rejection handler
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not open link.');
    openURLSpy.mockRestore();
    alertSpy.mockRestore();
  });
});
