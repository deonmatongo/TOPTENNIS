import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { supabase } from '@/services/supabase';
import { Palette, Colors, FontSize, Font, FontWeight, Spacing, Radius } from '@/theme/colors';

// ─── Admin config ─────────────────────────────────────────────────────────────
const ADMIN_EMAILS = ['admin@toptennis.app', 'deon@toptennis.app'];

// App version from the build config (falls back for safety).
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// ─── Section menu config ──────────────────────────────────────────────────────
const SECTIONS = [
  {
    screen: 'AccountSection',
    icon: 'person-circle-outline' as const,
    label: 'Account',
    desc: 'Profile, security, biometrics',
    color: Colors.primary,
  },
  {
    screen: 'PrivacySection',
    icon: 'eye-outline' as const,
    label: 'Privacy',
    desc: 'Visibility, data sharing',
    color: '#8b5cf6',
  },
  {
    screen: 'NotificationsSection',
    icon: 'notifications-outline' as const,
    label: 'Notifications',
    desc: 'Push, email, match & social alerts',
    color: Colors.error,
  },
  {
    screen: 'MatchPreferencesSection',
    icon: 'tennisball-outline' as const,
    label: 'Match Preferences',
    desc: 'Duration, surface, time, distance',
    color: Colors.primary,
  },
  {
    screen: 'AppPreferencesSection',
    icon: 'color-palette-outline' as const,
    label: 'App Preferences',
    desc: 'Haptics, sounds, display',
    color: '#10b981',
  },
  {
    screen: 'SupportSection',
    icon: 'help-circle-outline' as const,
    label: 'Support & More',
    desc: 'Help, integrations, legal, data',
    color: '#6366f1',
  },
] as const;

// ─── Section row ──────────────────────────────────────────────────────────────
function SectionRow({
  icon, label, desc, color, onPress, last = false,
}: { icon: keyof typeof Ionicons.glyphMap; label: string; desc: string; color: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      style={[s.sectionRow, !last && s.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={desc ? `${label}. ${desc}` : label}
    >
      <View style={[s.iconBox, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { player } = usePlayerProfile();

  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke('delete-account', {
                body: { userId: user!.id },
              });
              if (error) throw error;
              await signOut();
            } catch (e: any) {
              Alert.alert('Deletion Failed', e?.message ?? 'Please contact support@toptennis.app.');
            }
          },
        },
      ]
    );
  };

  const handleAdminReset = () => {
    Alert.alert(
      '⚠️ Reset All User Data',
      'This will permanently clear stats and match history for ALL accounts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I Understand',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Final Confirmation', 'Are you absolutely sure?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'RESET ALL DATA',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await Promise.all([
                      supabase.from('players').update({ wins: 0, losses: 0, current_streak: 0, best_streak: 0 }).neq('id', '00000000-0000-0000-0000-000000000000'),
                      supabase.from('match_invites').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                      supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                    ]);
                    Alert.alert('Done', 'All user data has been reset.');
                  } catch {
                    Alert.alert('Error', 'Reset failed. Check admin permissions.');
                  }
                },
              },
            ]),
        },
      ]
    );
  };

  const displayName = player
    ? [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Player'
    : 'Player';

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient
        colors={[Palette.navy, '#0f1e38']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <View>
          <Text style={s.headerTitle}>Settings</Text>
          <Text style={s.headerSub}>App preferences</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* Profile card */}
        <TouchableOpacity
          style={s.profileCard}
          onPress={() => navigation.navigate('AccountSection')}
          activeOpacity={0.8}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{displayName}</Text>
            <Text style={s.profileEmail}>{user?.email || '—'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Section rows */}
        <View style={s.card}>
          {SECTIONS.map((sec, i) => (
            <SectionRow
              key={sec.screen}
              icon={sec.icon}
              label={sec.label}
              desc={sec.desc}
              color={sec.color}
              onPress={() => navigation.navigate(sec.screen)}
              last={i === SECTIONS.length - 1}
            />
          ))}
        </View>

        {/* Admin panel */}
        {isAdmin && (
          <View style={s.card}>
            <SectionRow
              icon="shield-outline"
              label="Admin Panel"
              desc="Reset all user data"
              color="#7c3aed"
              onPress={handleAdminReset}
              last
            />
          </View>
        )}

        {/* About */}
        <View style={s.card}>
          <View style={s.aboutRow}>
            <Text style={s.aboutLabel}>Version</Text>
            <Text style={s.aboutValue}>{APP_VERSION}</Text>
          </View>
          <View style={s.aboutRow}>
            <Text style={s.aboutLabel}>Platform</Text>
            <Text style={s.aboutValue}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
          </View>
          <View style={[s.aboutRow, { borderBottomWidth: 0 }]}>
            <Text style={s.aboutLabel}>Account ID</Text>
            <Text style={[s.aboutValue, { fontSize: FontSize.xs }]} numberOfLines={1}>
              {user?.id?.slice(0, 16)}…
            </Text>
          </View>
        </View>

        {/* Danger zone */}
        <View style={s.card}>
          <TouchableOpacity style={[s.sectionRow, s.rowBorder]} onPress={handleSignOut} activeOpacity={0.7}>
            <View style={[s.iconBox, { backgroundColor: Colors.error }]}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
            </View>
            <Text style={[s.rowLabel, { color: Colors.error, flex: 1 }]}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.sectionRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <View style={[s.iconBox, { backgroundColor: Colors.error }]}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: Colors.error }]}>Delete Account</Text>
              <Text style={s.rowDesc}>Permanently remove your account and all data</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>
          Top Tennis · Settings are saved automatically.{'\n'}© 2025 Top Tennis.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontSize: FontSize.xxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.xl, fontFamily: Font.bold, color: '#fff' },
  profileName: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  profileEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Section card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Section row
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowLabel: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  rowDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // About rows
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
  aboutValue: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },

  footer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
});
