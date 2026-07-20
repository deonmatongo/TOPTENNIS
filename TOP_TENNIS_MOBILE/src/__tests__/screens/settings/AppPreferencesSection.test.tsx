import React from 'react';
import { render } from '@testing-library/react-native';
import { Switch } from 'react-native';
import { AppPreferencesSection } from '@/screens/settings/AppPreferencesSection';
import { SETTINGS_DEFAULTS } from '@/hooks/useAppSettings';

const mockUpdate = jest.fn();
let mockLoading = false;

jest.mock('@/hooks/useAppSettings', () => ({
  ...jest.requireActual('@/hooks/useAppSettings'),
  useAppSettings: () => ({
    settings: { ...require('@/hooks/useAppSettings').SETTINGS_DEFAULTS },
    update: mockUpdate,
    loading: mockLoading,
    saving: false,
  }),
}));

const navigation = { goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockLoading = false;
  navigation.goBack.mockReset();
});

describe('AppPreferencesSection', () => {
  it('renders without crashing', () => {
    expect(() => render(<AppPreferencesSection navigation={navigation} />)).not.toThrow();
  });

  it('shows ActivityIndicator while loading', () => {
    mockLoading = true;
    const { UNSAFE_getByType } = render(<AppPreferencesSection navigation={navigation} />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders all 5 preference labels when loaded', () => {
    const { getByText } = render(<AppPreferencesSection navigation={navigation} />);
    expect(getByText('Haptic Feedback')).toBeTruthy();
    expect(getByText('Sound Effects')).toBeTruthy();
    expect(getByText('Auto-Confirm Scores')).toBeTruthy();
    expect(getByText('Show Match Tips')).toBeTruthy();
    expect(getByText('Compact Leaderboard')).toBeTruthy();
  });

  it('calls update with correct key when a switch is toggled', () => {
    const { UNSAFE_getAllByType } = render(<AppPreferencesSection navigation={navigation} />);
    const switches = UNSAFE_getAllByType(Switch);
    // First switch is haptics_enabled (true by default); toggle to false
    switches[0].props.onValueChange(false);
    expect(mockUpdate).toHaveBeenCalledWith({ haptics_enabled: false });
  });
});
