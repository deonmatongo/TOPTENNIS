import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Linking, Share } from 'react-native';
import { SupportSection } from '@/screens/settings/SupportSection';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'player@test.com' } }),
}));

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  navigation.goBack.mockReset();
  navigation.navigate.mockReset();
});

describe('SupportSection', () => {
  it('renders without crashing', () => {
    expect(() => render(<SupportSection navigation={navigation} />)).not.toThrow();
  });

  it('renders all section item labels', () => {
    const { getByText } = render(<SupportSection navigation={navigation} />);
    expect(getByText('Contact Support')).toBeTruthy();
    expect(getByText('Email Us')).toBeTruthy();
    expect(getByText('Rate the App')).toBeTruthy();
    expect(getByText('Share Top Tennis')).toBeTruthy();
    expect(getByText('Calendar Access')).toBeTruthy();
    expect(getByText('Notification Permissions')).toBeTruthy();
    expect(getByText('Clear Cache')).toBeTruthy();
    expect(getByText('Export My Data')).toBeTruthy();
    expect(getByText('Terms of Service')).toBeTruthy();
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  it('opens the in-app chat when Contact Support is pressed', () => {
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Contact Support'));
    expect(navigation.navigate).toHaveBeenCalledWith('SupportChat');
  });

  it('opens a mailto link when Email Us is pressed', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Email Us'));
    expect(openURLSpy).toHaveBeenCalledWith('mailto:support@toptennis.app');
    openURLSpy.mockRestore();
  });

  it('opens the Terms of Service website', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Terms of Service'));
    expect(openURLSpy).toHaveBeenCalledWith('https://toptennis.app/terms');
    openURLSpy.mockRestore();
  });

  it('opens the Privacy Policy website', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Privacy Policy'));
    expect(openURLSpy).toHaveBeenCalledWith('https://toptennis.app/privacy');
    openURLSpy.mockRestore();
  });

  it('opens the store when Rate the App is pressed', async () => {
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(false);
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Rate the App'));
    await waitFor(() => expect(openURLSpy).toHaveBeenCalled());
    openURLSpy.mockRestore();
  });

  it('opens the share sheet when Share Top Tennis is pressed', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Share Top Tennis'));
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(shareSpy.mock.calls[0][0].message).toContain('Top Tennis');
    shareSpy.mockRestore();
  });

  it('confirms before clearing the cache', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Clear Cache'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Clear Cache',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Clear' }),
      ]),
    );
    alertSpy.mockRestore();
  });

  it('gathers account data and opens the share sheet on Export My Data', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    const { getByText } = render(<SupportSection navigation={navigation} />);
    fireEvent.press(getByText('Export My Data'));
    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(shareSpy.mock.calls[0][0].message).toContain('exportedAt');
    shareSpy.mockRestore();
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
});
