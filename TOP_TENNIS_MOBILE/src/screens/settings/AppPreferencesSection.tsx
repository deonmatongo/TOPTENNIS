import React from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '@/theme/colors';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard,
  SettingRow, LabelRow, ChipRow, sharedContent,
} from './_shared';

export const AppPreferencesSection: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settings, update, loading, saving } = useAppSettings();
  const { mode, setMode } = useTheme();

  if (loading) {
    return (
      <SettingsSafeScreen>
        <SectionPageHeader title="App Preferences" subtitle="Look & feel" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </SettingsSafeScreen>
    );
  }

  return (
    <SettingsSafeScreen>
      <SectionPageHeader title="App Preferences" subtitle="Look & feel" onBack={() => navigation.goBack()} saving={saving} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sharedContent.scroll}>

        {/* Appearance */}
        <SectionCard>
          <LabelRow label="Appearance" desc="Choose your preferred color scheme" />
          <ChipRow
            options={[
              { label: 'Auto',  value: 'system' as ThemeMode },
              { label: 'Light', value: 'light'  as ThemeMode },
              { label: 'Dark',  value: 'dark'   as ThemeMode },
            ]}
            value={mode}
            onSelect={v => setMode(v as ThemeMode)}
            last
          />
        </SectionCard>

        {/* Behaviour */}
        <SectionCard>
          <SettingRow label="Haptic Feedback" desc="Vibration on button taps and actions" value={settings.haptics_enabled} onValueChange={v => update({ haptics_enabled: v })} />
          <SettingRow label="Sound Effects" desc="Play a subtle sound on key actions" value={settings.sound_effects} onValueChange={v => update({ sound_effects: v })} />
          <SettingRow label="Auto-Confirm Scores" desc="Automatically confirm scores after 48 hours" value={settings.auto_confirm_scores} onValueChange={v => update({ auto_confirm_scores: v })} />
          <SettingRow label="Show Match Tips" desc="Display helpful tips during match setup" value={settings.show_match_tips} onValueChange={v => update({ show_match_tips: v })} />
          <SettingRow label="Compact Leaderboard" desc="Show condensed standings view" value={settings.compact_leaderboard} onValueChange={v => update({ compact_leaderboard: v })} last />
        </SectionCard>

      </ScrollView>
    </SettingsSafeScreen>
  );
};
