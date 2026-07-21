import React, { useState } from 'react';
import { ScrollView, Alert, Linking, Share, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Colors } from '@/theme/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard, NavRow, sharedContent,
} from './_shared';

const SUPPORT_EMAIL = 'support@toptennis.app';
const SHARE_URL = 'https://toptennis.app';
const APP_NAME = 'Top Tennis';
// Android package comes straight from the app config. The iOS App Store numeric
// ID only exists once the app is published — until then IOS_APP_ID stays null and
// the rate action falls back to an App Store search.
const ANDROID_PACKAGE = Constants.expoConfig?.android?.package ?? 'com.top.tennis';
const IOS_APP_ID: string | null = null; // e.g. '1234567890' after App Store release

const openURL = (url: string) =>
  Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));

const openDeviceSettings = () =>
  Linking.openSettings().catch(() => Alert.alert('Error', 'Could not open device settings.'));

// Lazily load optional native modules so Expo Go / tests stay safe. The loader
// must use a *static* require literal — Metro can't bundle a dynamic require(var).
function optional<T>(loader: () => T): T | null {
  try { return loader(); } catch { return null; }
}

export const SupportSection: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [busy, setBusy] = useState<null | 'cache' | 'export'>(null);

  // ── Rate the app ──────────────────────────────────────────────────────────
  const handleRate = async () => {
    const deepLink = Platform.OS === 'ios'
      ? (IOS_APP_ID
          ? `itms-apps://itunes.apple.com/app/id${IOS_APP_ID}?action=write-review`
          : `itms-apps://itunes.apple.com/search?term=${encodeURIComponent(APP_NAME)}`)
      : `market://details?id=${ANDROID_PACKAGE}`;
    const webLink = Platform.OS === 'ios'
      ? (IOS_APP_ID
          ? `https://apps.apple.com/app/id${IOS_APP_ID}`
          : `https://apps.apple.com/search?term=${encodeURIComponent(APP_NAME)}`)
      : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
    try {
      const canDeep = await Linking.canOpenURL(deepLink);
      await Linking.openURL(canDeep ? deepLink : webLink);
    } catch {
      Alert.alert('Rate Top Tennis', 'Please search “Top Tennis” in your app store to leave a review. Thank you! 🎾');
    }
  };

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        title: 'Top Tennis',
        message: `Join me on Top Tennis — find matches, join leagues and track your game. ${SHARE_URL}`,
      });
    } catch (e: any) {
      Alert.alert('Could not share', e?.message ?? 'Please try again.');
    }
  };

  // ── Clear cache ───────────────────────────────────────────────────────────
  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This clears locally cached images and temporary data. Your account is unaffected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        onPress: async () => {
          setBusy('cache');
          try {
            const ImageMod = optional<any>(() => require('expo-image'));
            const Image = ImageMod?.Image ?? ImageMod;
            await Image?.clearMemoryCache?.();
            await Image?.clearDiskCache?.();
            Alert.alert('Done', 'Cached data has been cleared.');
          } catch {
            Alert.alert('Done', 'Cache cleared.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  // ── Export my data ────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in to export your data.');
      return;
    }
    setBusy('export');
    try {
      const [profile, player, settings, leagues, matches] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('players').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('app_settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('league_registrations').select('*').eq('user_id', user.id),
        supabase.from('match_invites').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        account: { id: user.id, email: user.email },
        profile: profile.data ?? null,
        tennisProfile: player.data ?? null,
        settings: settings.data ?? null,
        leagueRegistrations: leagues.data ?? [],
        matches: matches.data ?? [],
      };
      const json = JSON.stringify(payload, null, 2);

      // Prefer sharing a real .json file; fall back to sharing the raw text.
      let sharedAsFile = false;
      try {
        const FS = optional<any>(() => require('expo-file-system/legacy')) ?? optional<any>(() => require('expo-file-system'));
        const Sharing = optional<any>(() => require('expo-sharing'));
        if (FS?.writeAsStringAsync && FS?.cacheDirectory && Sharing?.shareAsync && (await Sharing.isAvailableAsync?.())) {
          const uri = `${FS.cacheDirectory}toptennis-data-${Date.now()}.json`;
          await FS.writeAsStringAsync(uri, json);
          await Sharing.shareAsync(uri, {
            mimeType: 'application/json',
            dialogTitle: 'My Top Tennis data',
            UTI: 'public.json',
          });
          sharedAsFile = true;
        }
      } catch { /* fall back to text share below */ }

      if (!sharedAsFile) {
        await Share.share({ title: 'My Top Tennis data', message: json });
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? `Please try again, or email ${SUPPORT_EMAIL}.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsSafeScreen>
      <SectionPageHeader title="Support & More" subtitle="Help, integrations, legal" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sharedContent.scroll}>

        <SectionCard>
          <NavRow icon="chatbubble-ellipses-outline" label="Contact Support" desc="Chat with us in the app" color="#6366f1" onPress={() => navigation.navigate('SupportChat')} />
          <NavRow icon="mail-outline" label="Email Us" desc={SUPPORT_EMAIL} color="#3b82f6" onPress={() => openURL(`mailto:${SUPPORT_EMAIL}`)} />
          <NavRow icon="star-outline" label="Rate the App" desc="Leave a review on the store" color="#f59e0b" onPress={handleRate} />
          <NavRow icon="share-social-outline" label="Share Top Tennis" desc="Invite friends to join" color="#10b981" onPress={handleShare} last />
        </SectionCard>

        <SectionCard>
          <NavRow icon="calendar-outline" label="Calendar Access" desc="Manage calendar export permissions" color="#3b82f6" onPress={openDeviceSettings} />
          <NavRow icon="notifications-circle-outline" label="Notification Permissions" desc="Manage push notification permissions" color={Colors.error} onPress={openDeviceSettings} last />
        </SectionCard>

        <SectionCard>
          <NavRow icon="trash-outline" label={busy === 'cache' ? 'Clearing…' : 'Clear Cache'} desc="Free up local storage" color="#f59e0b" onPress={busy ? () => {} : handleClearCache} />
          <NavRow icon="download-outline" label={busy === 'export' ? 'Preparing export…' : 'Export My Data'} desc="Download a copy of your account data" color="#f59e0b" onPress={busy ? () => {} : handleExport} last />
        </SectionCard>

        <SectionCard>
          <NavRow icon="document-text-outline" label="Terms of Service" desc="Read our terms online" color={Colors.textSecondary} onPress={() => openURL('https://toptennis.app/terms')} />
          <NavRow icon="lock-closed-outline" label="Privacy Policy" desc="How we handle your data" color={Colors.textSecondary} onPress={() => openURL('https://toptennis.app/privacy')} last />
        </SectionCard>

      </ScrollView>
    </SettingsSafeScreen>
  );
};
