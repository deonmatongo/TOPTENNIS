import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { LightColors, DarkColors } from '@/theme/colors';

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

describe('ThemeContext', () => {
  it('defaults to the light palette', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);
    expect(result.current.colors).toBe(LightColors);
  });

  it('switches to the dark palette when mode is set to dark', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => { result.current.setMode('dark'); });
    await waitFor(() => expect(result.current.isDark).toBe(true));
    expect(result.current.colors).toBe(DarkColors);
    expect(result.current.mode).toBe('dark');
  });

  it('returns to light when set back', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => { result.current.setMode('dark'); });
    await waitFor(() => expect(result.current.isDark).toBe(true));
    act(() => { result.current.setMode('light'); });
    await waitFor(() => expect(result.current.isDark).toBe(false));
    expect(result.current.colors).toBe(LightColors);
  });
});
