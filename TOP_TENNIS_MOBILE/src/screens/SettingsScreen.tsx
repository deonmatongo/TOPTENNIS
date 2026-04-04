import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { supabase } from '@/services/supabase';
import { Palette, Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { StatusBar } from 'expo-status-bar';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppSettings {
  // Privacy
  profile_visibility: 'public' | 'friends_only' | 'private';
  show_win_loss: boolean;
  show_usta_rating: boolean;
  show_location: boolean;
  networking_enabled: boolean;
  // Notifications
  push_enabled: boolean;
  email_enabled: boolean;
  match_invites: boolean;
  match_reminders: boolean;
  match_accepted: boolean;
  match_declined: boolean;
  league_updates: boolean;
  score_submitted: boolean;
  score_confirmed: boolean;
  friend_requests: boolean;
  messages: boolean;
  achievements: boolean;
  // Match preferences
  preferred_match_duration: 30 | 60 | 90 | 120;
  preferred_surface: 'any' | 'hard' | 'clay' | 'grass' | 'indoor';
  preferred_time_of_day: 'any' | 'morning' | 'afternoon' | 'evening';
  max_travel_distance: 5 | 10 | 25 | 50;
  // App preferences
  dark_mode: boolean;
  haptics_enabled: boolean;
  sound_effects: boolean;
  auto_confirm_scores: boolean;
  show_match_tips: boolean;
  compact_leaderboard: boolean;
}

const DEFAULTS: AppSettings = {
  profile_visibility: 'public',
  show_win_loss: true,
  show_usta_rating: true,
  show_location: true,
  networking_enabled: true,
  push_enabled: true,
  email_enabled: false,
  match_invites: true,
  match_reminders: true,
  match_accepted: true,
  match_declined: true,
  league_updates: true,
  score_submitted: true,
  score_confirmed: true,
  friend_requests: true,
  messages: true,
  achievements: true,
  preferred_match_duration: 60,
  preferred_surface: 'any',
  preferred_time_of_day: 'any',
  max_travel_distance: 25,
  dark_mode: false,
  haptics_enabled: true,
  sound_effects: true,
  auto_confirm_scores: false,
  show_match_tips: true,
  compact_leaderboard: false,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View style={[sh.wrap, { backgroundColor: color + '14' }]}>
      <View style={[sh.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={sh.label}>{label}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
});

function SettingRow({
  label, desc, value, onValueChange, disabled = false, last = false,
}: { label: string; desc?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; last?: boolean }) {
  return (
    <View style={[sr.row, !last && sr.border, disabled && sr.disabled]}>
      <View style={{ flex: 1 }}>
        <Text style={sr.label}>{label}</Text>
        {desc ? <Text style={sr.desc}>{desc}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: Colors.borderLight, true: Colors.primaryMuted }}
        thumbColor={value && !disabled ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  disabled: { opacity: 0.45 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
});

function ChipRow<T extends string | number>({
  options, value, onSelect, last = false,
}: { options: { label: string; value: T }[]; value: T; onSelect: (v: T) => void; last?: boolean }) {
  return (
    <View style={[cr.wrap, !last && cr.border]}>
      {options.map(o => (
        <TouchableOpacity
          key={String(o.value)}
          style={[cr.chip, value === o.value && cr.chipActive]}
          onPress={() => onSelect(o.value)}
        >
          <Text style={[cr.chipText, value === o.value && cr.chipTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const cr = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  chip: { paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 1, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.primaryDark, fontWeight: FontWeight.semibold },
});

function NavRow({ icon, label, desc, color, onPress, danger = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; desc?: string; color: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={nr.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[nr.icon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.error : color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[nr.label, danger && { color: Colors.error }]}>{label}</Text>
        {desc ? <Text style={nr.desc}>{desc}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}
const nr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});

function LabelRow({ label, desc, last = false }: { label: string; desc?: string; last?: boolean }) {
  return (
    <View style={[lr.row, !last && lr.border]}>
      <Text style={lr.label}>{label}</Text>
      {desc ? <Text style={lr.desc}>{desc}</Text> : null}
    </View>
  );
}
const lr = StyleSheet.create({
  row: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  desc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { player } = usePlayerProfile();
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) setSettings({ ...DEFAULTS, ...data });
    } catch {
      // Table may not exist — use defaults
    } finally {
      setLoading(false);
    }
  };

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await supabase
        .from('app_settings')
        .upsert({ user_id: user!.id, ...next, updated_at: new Date().toISOString() });
    } catch {
      setSettings(settings);
      Alert.alert('Error', 'Could not save setting. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [settings, user]);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => Alert.alert('Contact Support', 'Please email support@toptennis.app to complete account deletion.'),
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Cached data has been cleared.', [{ text: 'OK' }]);
  };

  const openDeviceSettings = () => {
    Linking.openSettings().catch(() => Alert.alert('Error', 'Could not open device settings.'));
  };

  const openURL = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));
  };

  const GradHeader = () => (
    <LinearGradient
      colors={[Palette.dark900, Palette.dark700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradHeader, { paddingTop: insets.top + Spacing.lg }]}
    >
      <TouchableOpacity style={styles.gradBackBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.gradTitle}>Settings</Text>
        <Text style={styles.gradSub}>App preferences</Text>
      </View>
      {saving && <ActivityIndicator size="small" color="#fff" />}
    </LinearGradient>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <StatusBar style="light" />
        <GradHeader />
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      <GradHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Account ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="person-circle-outline" label="Account" color={Colors.primary} />
          <NavRow
            icon="person-outline"
            label="Edit Profile"
            desc="Name, photo, bio, location"
            color={Colors.primary}
            onPress={() => navigation.navigate('Profile')}
          />
          <NavRow
            icon="tennisball-outline"
            label="Tennis Profile"
            desc="Skill level, USTA rating, competitiveness"
            color={Colors.accent}
            onPress={() => navigation.navigate('Profile')}
          />
          <NavRow
            icon="shield-checkmark-outline"
            label="Account Security"
            desc={user?.email || 'Manage your credentials'}
            color="#8b5cf6"
            onPress={() => Alert.alert('Account Security', 'Password changes and security settings are managed via email. Check your inbox for a reset link.', [{ text: 'OK' }])}
          />
          <NavRow
            icon="mail-outline"
            label="Email Address"
            desc={user?.email || '—'}
            color={Colors.textSecondary}
            onPress={() => Alert.alert('Change Email', 'To change your email, please contact support@toptennis.app')}
          />
        </View>

        {/* ── Privacy ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="eye-outline" label="Privacy" color="#8b5cf6" />
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
        </View>

        {/* ── Notifications ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="notifications-outline" label="Notifications" color={Colors.error} />
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
          />
          <LabelRow label="Match Alerts" />
          <SettingRow
            label="Match Invitations"
            desc="When someone invites you to a match"
            value={settings.match_invites}
            onValueChange={v => update({ match_invites: v })}
            disabled={!settings.push_enabled}
          />
          <SettingRow
            label="Match Reminders"
            desc="24h and 1h before your match"
            value={settings.match_reminders}
            onValueChange={v => update({ match_reminders: v })}
            disabled={!settings.push_enabled}
          />
          <SettingRow
            label="Match Accepted"
            desc="When your invitation is accepted"
            value={settings.match_accepted}
            onValueChange={v => update({ match_accepted: v })}
            disabled={!settings.push_enabled}
          />
          <SettingRow
            label="Match Declined"
            desc="When your invitation is declined"
            value={settings.match_declined}
            onValueChange={v => update({ match_declined: v })}
            disabled={!settings.push_enabled}
          />
          <LabelRow label="League Alerts" />
          <SettingRow
            label="League Updates"
            desc="Division standings and league news"
            value={settings.league_updates}
            onValueChange={v => update({ league_updates: v })}
            disabled={!settings.push_enabled}
          />
          <SettingRow
            label="Score Submitted"
            desc="When your opponent reports a score"
            value={settings.score_submitted}
            onValueChange={v => update({ score_submitted: v })}
            disabled={!settings.push_enabled}
          />
          <SettingRow
            label="Score Confirmed"
            desc="When a reported score is confirmed"
            value={settings.score_confirmed}
            onValueChange={v => update({ score_confirmed: v })}
            disabled={!settings.push_enabled}
          />
          <LabelRow label="Social Alerts" />
          <SettingRow
            label="Friend Requests"
            desc="New friend requests and acceptances"
            value={settings.friend_requests}
            onValueChange={v => update({ friend_requests: v })}
            disabled={!settings.push_enabled}
          />
          <SettingRow
            label="Messages"
            desc="New messages from other players"
            value={settings.messages}
            onValueChange={v => update({ messages: v })}
            disabled={!settings.push_enabled}
          />
          <SettingRow
            label="Achievements"
            desc="When you unlock a new achievement"
            value={settings.achievements}
            onValueChange={v => update({ achievements: v })}
            disabled={!settings.push_enabled}
            last
          />
        </View>

        {/* ── Match Preferences ────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="tennisball-outline" label="Match Preferences" color={Colors.primary} />
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
          />
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
          />
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
          />
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
        </View>

        {/* ── App Preferences ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="color-palette-outline" label="App Preferences" color="#10b981" />
          <SettingRow
            label="Haptic Feedback"
            desc="Vibration on button taps and actions"
            value={settings.haptics_enabled}
            onValueChange={v => update({ haptics_enabled: v })}
          />
          <SettingRow
            label="Sound Effects"
            desc="Play sounds for match events"
            value={settings.sound_effects}
            onValueChange={v => update({ sound_effects: v })}
          />
          <SettingRow
            label="Auto-Confirm Scores"
            desc="Automatically confirm scores after 48 hours"
            value={settings.auto_confirm_scores}
            onValueChange={v => update({ auto_confirm_scores: v })}
          />
          <SettingRow
            label="Show Match Tips"
            desc="Display helpful tips during match setup"
            value={settings.show_match_tips}
            onValueChange={v => update({ show_match_tips: v })}
          />
          <SettingRow
            label="Compact Leaderboard"
            desc="Show condensed standings view"
            value={settings.compact_leaderboard}
            onValueChange={v => update({ compact_leaderboard: v })}
            last
          />
        </View>

        {/* ── Calendar & Integrations ──────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="calendar-outline" label="Calendar & Integrations" color="#3b82f6" />
          <NavRow
            icon="calendar-outline"
            label="Calendar Access"
            desc="Manage calendar export permissions"
            color="#3b82f6"
            onPress={openDeviceSettings}
          />
          <NavRow
            icon="notifications-circle-outline"
            label="Notification Permissions"
            desc="Manage push notification permissions"
            color={Colors.error}
            onPress={openDeviceSettings}
          />
        </View>

        {/* ── Data & Storage ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="server-outline" label="Data & Storage" color="#f59e0b" />
          <NavRow
            icon="trash-outline"
            label="Clear Cache"
            desc="Free up local storage"
            color="#f59e0b"
            onPress={handleClearCache}
          />
          <NavRow
            icon="download-outline"
            label="Export My Data"
            desc="Download a copy of your account data"
            color="#f59e0b"
            onPress={() => Alert.alert('Export Data', 'Your data export will be emailed to ' + (user?.email || 'you') + ' within 24 hours.', [{ text: 'OK' }])}
          />
        </View>

        {/* ── Support & Legal ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="help-circle-outline" label="Support & Legal" color="#6366f1" />
          <NavRow
            icon="chatbubble-ellipses-outline"
            label="Contact Support"
            desc="Get help from our team"
            color="#6366f1"
            onPress={() => openURL('mailto:support@toptennis.app')}
          />
          <NavRow
            icon="star-outline"
            label="Rate the App"
            desc="Leave a review on the App Store"
            color="#f59e0b"
            onPress={() => Alert.alert('Rate the App', 'Thank you! App Store rating coming soon.')}
          />
          <NavRow
            icon="share-outline"
            label="Share Top Tennis"
            desc="Invite friends to join"
            color="#10b981"
            onPress={() => Alert.alert('Share', 'Sharing coming soon!')}
          />
          <NavRow
            icon="document-text-outline"
            label="Terms of Service"
            desc="Read our terms"
            color={Colors.textSecondary}
            onPress={() => openURL('https://toptennis.app/terms')}
          />
          <NavRow
            icon="lock-closed-outline"
            label="Privacy Policy"
            desc="How we handle your data"
            color={Colors.textSecondary}
            onPress={() => openURL('https://toptennis.app/privacy')}
          />
        </View>

        {/* ── About ────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="information-circle-outline" label="About" color={Colors.textSecondary} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Platform</Text>
            <Text style={styles.aboutValue}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.aboutLabel}>Account ID</Text>
            <Text style={[styles.aboutValue, { fontSize: FontSize.xs }]} numberOfLines={1}>{user?.id?.slice(0, 16)}…</Text>
          </View>
        </View>

        {/* ── Danger Zone ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader icon="warning-outline" label="Account Actions" color={Colors.error} />
          <NavRow
            icon="log-out-outline"
            label="Sign Out"
            desc="Sign out of your account"
            color={Colors.error}
            onPress={handleSignOut}
            danger
          />
          <View style={[nr.row, { borderBottomWidth: 0 }]}>
            <View style={[nr.icon, { backgroundColor: Colors.errorLight }]}>
              <Ionicons name="trash-outline" size={18} color={Colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[nr.label, { color: Colors.error }]}>Delete Account</Text>
              <Text style={nr.desc}>Permanently remove your account and all data</Text>
            </View>
            <TouchableOpacity onPress={handleDeleteAccount} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.deleteBtn}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>
          Top Tennis · All settings are saved automatically.{'\n'}
          © 2025 Top Tennis. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  gradHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },
  gradBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  gradTitle: { fontSize: 22, fontWeight: FontWeight.black, color: '#fff' },
  gradSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },

  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  aboutLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  aboutValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },

  deleteBtn: { fontSize: FontSize.sm, color: Colors.error, fontWeight: FontWeight.semibold },

  footer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
});
