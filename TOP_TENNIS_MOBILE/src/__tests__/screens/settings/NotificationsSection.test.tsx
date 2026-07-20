import React from 'react';
import { render } from '@testing-library/react-native';
import { Switch } from 'react-native';
import { NotificationsSection } from '@/screens/settings/NotificationsSection';
import { SETTINGS_DEFAULTS } from '@/hooks/useAppSettings';

const mockUpdate = jest.fn();
let mockSettings = { ...SETTINGS_DEFAULTS };
let mockLoading = false;

jest.mock('@/hooks/useAppSettings', () => ({
  ...jest.requireActual('@/hooks/useAppSettings'),
  useAppSettings: () => ({
    settings: mockSettings,
    update: mockUpdate,
    loading: mockLoading,
    saving: false,
  }),
}));

const navigation = { goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = { ...SETTINGS_DEFAULTS };
  mockLoading = false;
});

describe('NotificationsSection', () => {
  it('renders without crashing', () => {
    expect(() => render(<NotificationsSection navigation={navigation} />)).not.toThrow();
  });

  it('shows ActivityIndicator while loading', () => {
    mockLoading = true;
    const { UNSAFE_getByType } = render(<NotificationsSection navigation={navigation} />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders all notification category labels', () => {
    const { getByText } = render(<NotificationsSection navigation={navigation} />);
    expect(getByText('Push Notifications')).toBeTruthy();
    expect(getByText('Email Notifications')).toBeTruthy();
    expect(getByText('Match Invitations')).toBeTruthy();
    expect(getByText('Match Reminders')).toBeTruthy();
    expect(getByText('League Updates')).toBeTruthy();
    expect(getByText('Friend Requests')).toBeTruthy();
    expect(getByText('Messages')).toBeTruthy();
    expect(getByText('Achievements')).toBeTruthy();
  });

  it('disables match/social switches when push_enabled is false', () => {
    mockSettings = { ...SETTINGS_DEFAULTS, push_enabled: false };
    const { UNSAFE_getAllByType } = render(<NotificationsSection navigation={navigation} />);
    const switches = UNSAFE_getAllByType(Switch);
    // Index 0 = push_enabled (not disabled), index 1 = email_enabled (not disabled)
    // Indices 2+ are match/social alerts that should be disabled
    const disabledSwitches = switches.filter((s: any) => s.props.disabled === true);
    expect(disabledSwitches.length).toBeGreaterThan(0);
  });

  it('enables all switches when push_enabled is true', () => {
    mockSettings = { ...SETTINGS_DEFAULTS, push_enabled: true };
    const { UNSAFE_getAllByType } = render(<NotificationsSection navigation={navigation} />);
    const switches = UNSAFE_getAllByType(Switch);
    const disabledSwitches = switches.filter((s: any) => s.props.disabled === true);
    expect(disabledSwitches.length).toBe(0);
  });

  it('calls update with push_enabled when push switch is toggled', () => {
    const { UNSAFE_getAllByType } = render(<NotificationsSection navigation={navigation} />);
    const switches = UNSAFE_getAllByType(Switch);
    switches[0].props.onValueChange(false);
    expect(mockUpdate).toHaveBeenCalledWith({ push_enabled: false });
  });
});
