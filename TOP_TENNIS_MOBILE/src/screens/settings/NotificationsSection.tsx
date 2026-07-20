import React from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { Colors } from '@/theme/colors';
import { useAppSettings } from '@/hooks/useAppSettings';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard,
  SettingRow, LabelRow, sharedContent,
} from './_shared';

export const NotificationsSection: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { settings, update, loading, saving } = useAppSettings();

  if (loading) {
    return (
      <SettingsSafeScreen>
        <SectionPageHeader title="Notifications" subtitle="Alerts & reminders" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </SettingsSafeScreen>
    );
  }

  const off = !settings.push_enabled;

  return (
    <SettingsSafeScreen>
      <SectionPageHeader title="Notifications" subtitle="Alerts & reminders" onBack={() => navigation.goBack()} saving={saving} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sharedContent.scroll}>

        <SectionCard>
          <SettingRow
            label="Push Notifications"
            desc="Receive alerts on this device"
            value={settings.push_enabled}
            onValueChange={v => update({ push_enabled: v })}
          />
          <SettingRow
            label="Email Notifications"
            desc="Receive a daily digest via email"
            value={settings.email_enabled}
            onValueChange={v => update({ email_enabled: v })}
            last
          />
        </SectionCard>

        <SectionCard>
          <LabelRow label="Match Alerts" />
          <SettingRow label="Match Invitations" desc="When someone invites you to a match" value={settings.match_invites} onValueChange={v => update({ match_invites: v })} disabled={off} />
          <SettingRow label="Match Reminders" desc="24h and 1h before your match" value={settings.match_reminders} onValueChange={v => update({ match_reminders: v })} disabled={off} />
          <SettingRow label="Match Accepted" desc="When your invitation is accepted" value={settings.match_accepted} onValueChange={v => update({ match_accepted: v })} disabled={off} />
          <SettingRow label="Match Declined" desc="When your invitation is declined" value={settings.match_declined} onValueChange={v => update({ match_declined: v })} disabled={off} last />
        </SectionCard>

        <SectionCard>
          <LabelRow label="League Alerts" />
          <SettingRow label="League Updates" desc="Division standings and league news" value={settings.league_updates} onValueChange={v => update({ league_updates: v })} disabled={off} />
          <SettingRow label="Score Submitted" desc="When your opponent reports a score" value={settings.score_submitted} onValueChange={v => update({ score_submitted: v })} disabled={off} />
          <SettingRow label="Score Confirmed" desc="When a reported score is confirmed" value={settings.score_confirmed} onValueChange={v => update({ score_confirmed: v })} disabled={off} last />
        </SectionCard>

        <SectionCard>
          <LabelRow label="Social Alerts" />
          <SettingRow label="Friend Requests" desc="New friend requests and acceptances" value={settings.friend_requests} onValueChange={v => update({ friend_requests: v })} disabled={off} />
          <SettingRow label="Messages" desc="New messages from other players" value={settings.messages} onValueChange={v => update({ messages: v })} disabled={off} />
          <SettingRow label="Achievements" desc="When you unlock a new achievement" value={settings.achievements} onValueChange={v => update({ achievements: v })} disabled={off} last />
        </SectionCard>

      </ScrollView>
    </SettingsSafeScreen>
  );
};
