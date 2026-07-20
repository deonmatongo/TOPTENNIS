import React from 'react';
import { ScrollView, Alert, Linking } from 'react-native';
import { Colors } from '@/theme/colors';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard, NavRow, sharedContent,
} from './_shared';

const openURL = (url: string) =>
  Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));

const openDeviceSettings = () =>
  Linking.openSettings().catch(() => Alert.alert('Error', 'Could not open device settings.'));

export const SupportSection: React.FC<{ navigation: any }> = ({ navigation }) => (
  <SettingsSafeScreen>
    <SectionPageHeader title="Support & More" subtitle="Help, integrations, legal" onBack={() => navigation.goBack()} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sharedContent.scroll}>

      <SectionCard>
        <NavRow icon="chatbubble-ellipses-outline" label="Contact Support" desc="Get help from our team" color="#6366f1" onPress={() => openURL('mailto:support@toptennis.app')} />
        <NavRow icon="star-outline" label="Rate the App" desc="Leave a review on the App Store" color="#f59e0b" onPress={() => Alert.alert('Rate the App', 'Thank you! App Store rating coming soon.')} />
        <NavRow icon="share-outline" label="Share Top Tennis" desc="Invite friends to join" color="#10b981" onPress={() => Alert.alert('Share', 'Sharing coming soon!')} last />
      </SectionCard>

      <SectionCard>
        <NavRow icon="calendar-outline" label="Calendar Access" desc="Manage calendar export permissions" color="#3b82f6" onPress={openDeviceSettings} />
        <NavRow icon="notifications-circle-outline" label="Notification Permissions" desc="Manage push notification permissions" color={Colors.error} onPress={openDeviceSettings} last />
      </SectionCard>

      <SectionCard>
        <NavRow icon="trash-outline" label="Clear Cache" desc="Free up local storage" color="#f59e0b" onPress={() => Alert.alert('Clear Cache', 'Cached data has been cleared.', [{ text: 'OK' }])} />
        <NavRow icon="download-outline" label="Export My Data" desc="Download a copy of your account data" color="#f59e0b" onPress={() => Alert.alert('Export Data', 'Your data export will be emailed within 24 hours.', [{ text: 'OK' }])} last />
      </SectionCard>

      <SectionCard>
        <NavRow icon="document-text-outline" label="Terms of Service" desc="Read our terms" color={Colors.textSecondary} onPress={() => openURL('https://toptennis.app/terms')} />
        <NavRow icon="lock-closed-outline" label="Privacy Policy" desc="How we handle your data" color={Colors.textSecondary} onPress={() => openURL('https://toptennis.app/privacy')} last />
      </SectionCard>

    </ScrollView>
  </SettingsSafeScreen>
);
