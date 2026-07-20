import React from 'react';
import { ScrollView, ActivityIndicator, View } from 'react-native';
import { Colors, Spacing } from '@/theme/colors';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard,
  SettingRow, ChipRow, LabelRow, sharedContent,
} from './_shared';

export const PrivacySection: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settings, update, loading, saving } = useAppSettings();

  if (loading) {
    return (
      <SettingsSafeScreen>
        <SectionPageHeader title="Privacy" subtitle="Who sees your data" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </SettingsSafeScreen>
    );
  }

  return (
    <SettingsSafeScreen>
      <SectionPageHeader title="Privacy" subtitle="Who sees your data" onBack={() => navigation.goBack()} saving={saving} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sharedContent.scroll}>
        <SectionCard>
          <LabelRow label="Profile Visibility" desc="Who can see your profile" />
          <ChipRow
            options={[
              { label: 'Public', value: 'public' as const },
              { label: 'Friends Only', value: 'friends_only' as const },
              { label: 'Private', value: 'private' as const },
            ]}
            value={settings.profile_visibility}
            onSelect={v => update({ profile_visibility: v })}
          />
          <SettingRow
            label="Show Win/Loss Record"
            desc="Display your match record on your profile"
            value={settings.show_win_loss}
            onValueChange={v => update({ show_win_loss: v })}
          />
          <SettingRow
            label="Show USTA Rating"
            desc="Display your USTA rating publicly"
            value={settings.show_usta_rating}
            onValueChange={v => update({ show_usta_rating: v })}
          />
          <SettingRow
            label="Show Location"
            desc="Show your city on your profile"
            value={settings.show_location}
            onValueChange={v => update({ show_location: v })}
          />
          <SettingRow
            label="Open to Networking"
            desc="Allow other players to find and message you"
            value={settings.networking_enabled}
            onValueChange={v => update({ networking_enabled: v })}
            last
          />
        </SectionCard>
      </ScrollView>
    </SettingsSafeScreen>
  );
};
