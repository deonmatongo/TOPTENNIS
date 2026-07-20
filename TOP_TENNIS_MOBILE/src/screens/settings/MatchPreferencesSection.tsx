import React from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '@/theme/colors';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard,
  ChipRow, LabelRow, sharedContent,
} from './_shared';

export const MatchPreferencesSection: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settings, update, loading, saving } = useAppSettings();

  if (loading) {
    return (
      <SettingsSafeScreen>
        <SectionPageHeader title="Match Preferences" subtitle="Your default match settings" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </SettingsSafeScreen>
    );
  }

  return (
    <SettingsSafeScreen>
      <SectionPageHeader title="Match Preferences" subtitle="Your default match settings" onBack={() => navigation.goBack()} saving={saving} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sharedContent.scroll}>

        <SectionCard>
          <LabelRow label="Preferred Match Duration" />
          <ChipRow
            options={[
              { label: '30 min', value: 30 as const },
              { label: '1 hour', value: 60 as const },
              { label: '1.5 hours', value: 90 as const },
              { label: '2 hours', value: 120 as const },
            ]}
            value={settings.preferred_match_duration}
            onSelect={v => update({ preferred_match_duration: v })}
            last
          />
        </SectionCard>

        <SectionCard>
          <LabelRow label="Preferred Court Surface" />
          <ChipRow
            options={[
              { label: 'Any', value: 'any' as const },
              { label: 'Hard', value: 'hard' as const },
              { label: 'Clay', value: 'clay' as const },
              { label: 'Grass', value: 'grass' as const },
              { label: 'Indoor', value: 'indoor' as const },
            ]}
            value={settings.preferred_surface}
            onSelect={v => update({ preferred_surface: v })}
            last
          />
        </SectionCard>

        <SectionCard>
          <LabelRow label="Preferred Time of Day" />
          <ChipRow
            options={[
              { label: 'Any', value: 'any' as const },
              { label: 'Morning', value: 'morning' as const },
              { label: 'Afternoon', value: 'afternoon' as const },
              { label: 'Evening', value: 'evening' as const },
            ]}
            value={settings.preferred_time_of_day}
            onSelect={v => update({ preferred_time_of_day: v })}
            last
          />
        </SectionCard>

        <SectionCard>
          <LabelRow label="Max Travel Distance" />
          <ChipRow
            options={[
              { label: '5 mi', value: 5 as const },
              { label: '10 mi', value: 10 as const },
              { label: '25 mi', value: 25 as const },
              { label: '50 mi', value: 50 as const },
            ]}
            value={settings.max_travel_distance}
            onSelect={v => update({ max_travel_distance: v })}
            last
          />
        </SectionCard>

      </ScrollView>
    </SettingsSafeScreen>
  );
};
