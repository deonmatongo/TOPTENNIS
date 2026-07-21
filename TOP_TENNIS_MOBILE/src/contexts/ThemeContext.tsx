import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import { Appearance, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LightColors, DarkColors, AppColors } from '@/theme/colors';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORE_KEY = 'toptennis_theme_mode';

interface ThemeContextValue {
  /** The user's chosen mode. */
  mode: ThemeMode;
  /** Whether the resolved theme is dark right now. */
  isDark: boolean;
  /** The active palette — always use this in themed screens. */
  colors: AppColors;
  /** Persist a new mode. */
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [systemDark, setSystemDark] = useState(Appearance.getColorScheme() === 'dark');

  // Load the persisted preference once.
  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(STORE_KEY)
      .then(stored => {
        if (active && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setModeState(stored);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Track OS appearance so `system` mode stays in sync.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemDark(colorScheme === 'dark'));
    return () => sub.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    SecureStore.setItemAsync(STORE_KEY, next).catch(() => {});
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);
  const colors = isDark ? DarkColors : LightColors;

  const value = useMemo<ThemeContextValue>(() => ({ mode, isDark, colors, setMode }), [mode, isDark, colors, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/** Shorthand for the active palette. */
export function useThemeColors(): AppColors {
  return useTheme().colors;
}

/**
 * Build a StyleSheet from the active palette and rebuild it when the theme
 * changes. Use in screens being migrated to dark mode:
 *
 *   const s = useThemedStyles(c => StyleSheet.create({ box: { backgroundColor: c.surface } }));
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: AppColors) => T): T {
  const colors = useThemeColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
