import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Switch } from 'react-native';
import { PrivacySection } from '@/screens/settings/PrivacySection';
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

describe('PrivacySection', () => {
  it('renders without crashing', () => {
    expect(() => render(<PrivacySection navigation={navigation} />)).not.toThrow();
  });

  it('shows ActivityIndicator while loading', () => {
    mockLoading = true;
    const { UNSAFE_getByType } = render(<PrivacySection navigation={navigation} />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders all privacy settings labels', () => {
    const { getByText } = render(<PrivacySection navigation={navigation} />);
    expect(getByText('Profile Visibility')).toBeTruthy();
    expect(getByText('Show Win/Loss Record')).toBeTruthy();
    expect(getByText('Show USTA Rating')).toBeTruthy();
    expect(getByText('Show Location')).toBeTruthy();
    expect(getByText('Open to Networking')).toBeTruthy();
  });

  it('renders visibility chip options', () => {
    const { getByText } = render(<PrivacySection navigation={navigation} />);
    expect(getByText('Public')).toBeTruthy();
    expect(getByText('Friends Only')).toBeTruthy();
    expect(getByText('Private')).toBeTruthy();
  });

  it('calls update with profile_visibility when a chip is pressed', () => {
    const { getByText } = render(<PrivacySection navigation={navigation} />);
    fireEvent.press(getByText('Private'));
    expect(mockUpdate).toHaveBeenCalledWith({ profile_visibility: 'private' });
  });

  it('calls update with friends_only when Friends Only chip is pressed', () => {
    const { getByText } = render(<PrivacySection navigation={navigation} />);
    fireEvent.press(getByText('Friends Only'));
    expect(mockUpdate).toHaveBeenCalledWith({ profile_visibility: 'friends_only' });
  });

  it('calls update with show_win_loss when toggle is changed', () => {
    const { UNSAFE_getAllByType } = render(<PrivacySection navigation={navigation} />);
    const switches = UNSAFE_getAllByType(Switch);
    switches[0].props.onValueChange(false);
    expect(mockUpdate).toHaveBeenCalledWith({ show_win_loss: false });
  });
});
