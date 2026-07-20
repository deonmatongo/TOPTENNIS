import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MatchPreferencesSection } from '@/screens/settings/MatchPreferencesSection';
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

describe('MatchPreferencesSection', () => {
  it('renders without crashing', () => {
    expect(() => render(<MatchPreferencesSection navigation={navigation} />)).not.toThrow();
  });

  it('shows ActivityIndicator while loading', () => {
    mockLoading = true;
    const { UNSAFE_getByType } = render(<MatchPreferencesSection navigation={navigation} />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders all section labels', () => {
    const { getByText } = render(<MatchPreferencesSection navigation={navigation} />);
    expect(getByText('Preferred Match Duration')).toBeTruthy();
    expect(getByText('Preferred Court Surface')).toBeTruthy();
    expect(getByText('Preferred Time of Day')).toBeTruthy();
    expect(getByText('Max Travel Distance')).toBeTruthy();
  });

  it('renders all duration chip options', () => {
    const { getByText } = render(<MatchPreferencesSection navigation={navigation} />);
    expect(getByText('30 min')).toBeTruthy();
    expect(getByText('1 hour')).toBeTruthy();
    expect(getByText('1.5 hours')).toBeTruthy();
    expect(getByText('2 hours')).toBeTruthy();
  });

  it('renders surface chip options', () => {
    const { getByText } = render(<MatchPreferencesSection navigation={navigation} />);
    expect(getByText('Hard')).toBeTruthy();
    expect(getByText('Clay')).toBeTruthy();
    expect(getByText('Grass')).toBeTruthy();
    expect(getByText('Indoor')).toBeTruthy();
  });

  it('calls update with preferred_match_duration when a duration chip is pressed', () => {
    const { getByText } = render(<MatchPreferencesSection navigation={navigation} />);
    fireEvent.press(getByText('30 min'));
    expect(mockUpdate).toHaveBeenCalledWith({ preferred_match_duration: 30 });
  });

  it('calls update with preferred_surface when a surface chip is pressed', () => {
    const { getByText } = render(<MatchPreferencesSection navigation={navigation} />);
    fireEvent.press(getByText('Clay'));
    expect(mockUpdate).toHaveBeenCalledWith({ preferred_surface: 'clay' });
  });

  it('calls update with preferred_time_of_day when a time chip is pressed', () => {
    const { getByText } = render(<MatchPreferencesSection navigation={navigation} />);
    fireEvent.press(getByText('Morning'));
    expect(mockUpdate).toHaveBeenCalledWith({ preferred_time_of_day: 'morning' });
  });

  it('calls update with max_travel_distance when a distance chip is pressed', () => {
    const { getByText } = render(<MatchPreferencesSection navigation={navigation} />);
    fireEvent.press(getByText('5 mi'));
    expect(mockUpdate).toHaveBeenCalledWith({ max_travel_distance: 5 });
  });
});
