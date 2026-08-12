import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { supabase } from '@/services/supabase';
import { Palette, Colors, FontSize, Font, Spacing, Radius } from '@/theme/colors';
import { TAB_BAR_HEIGHT } from '@/components/navigation/TabBar';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// ─── Deterministic avatar tint per name ───────────────────────────────────────
const AVATAR_TINTS = ['#8E6FB8', '#5A8FBF', '#4F9E86', '#B0803F', '#B06A6A', '#6E7FB8', '#57967E', '#A0708F'];
function avatarTintFor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_TINTS.length;
  return AVATAR_TINTS[Math.abs(hash)];
}

// ─── Skill level labels ────────────────────────────────────────────────────────
function skillLabel(level?: number): string | null {
  if (!level) return null;
  if (level <= 2) return 'Beginner';
  if (level === 3) return 'Intermediate';
  return 'Advanced';
}
function skillColor(level?: number): string {
  if (!level) return Colors.textMuted;
  if (level <= 2) return Colors.success;
  if (level === 3) return Colors.warning;
  return Colors.error;
}

// ─── Settings sections config ─────────────────────────────────────────────────
const SETTINGS_SECTIONS = [
  {
    screen: 'AccountSection',
    icon: 'person-circle' as const,
    label: 'Account',
    desc: 'Profile & security',
    tint: Colors.primary,
    bg:   'rgba(234,88,12,0.12)',
  },
  {
    screen: 'PrivacySection',
    icon: 'shield-checkmark' as const,
    label: 'Privacy',
    desc: 'Visibility, data sharing',
    tint: Colors.info,
    bg:   'rgba(59,130,246,0.12)',
  },
  {
    screen: 'NotificationsSection',
    icon: 'notifications' as const,
    label: 'Notifications',
    desc: 'Push, email, match & social alerts',
    tint: Colors.warning,
    bg:   'rgba(245,158,11,0.12)',
  },
  {
    screen: 'MatchPreferencesSection',
    icon: 'tennisball' as const,
    label: 'Match Preferences',
    desc: 'Duration, surface, time, distance',
    tint: Colors.success,
    bg:   'rgba(16,185,129,0.12)',
  },
  {
    screen: 'AppPreferencesSection',
    icon: 'color-palette' as const,
    label: 'App Preferences',
    desc: 'Haptics, sounds, display',
    tint: Colors.primary,
    bg:   'rgba(234,88,12,0.12)',
  },
  {
    screen: 'SupportSection',
    icon: 'help-circle' as const,
    label: 'Support & More',
    desc: 'Help, integrations, legal, data',
    tint: Colors.info,
    bg:   'rgba(59,130,246,0.12)',
  },
];

// ─── Profile completeness steps ───────────────────────────────────────────────
type CheckStep = { label: string; done: boolean; startEditing?: boolean };
function completenessSteps(player: ReturnType<typeof usePlayerProfile>['player'], phone?: string): CheckStep[] {
  return [
    { label: 'Phone number verified', done: !!phone },
    { label: 'Add your full name',    done: !!(player?.first_name && player?.last_name), startEditing: true },
    { label: 'Add profile photo',     done: !!player?.profile_picture_url,               startEditing: false },
    { label: 'Set your skill level',  done: !!player?.skill_level,                       startEditing: true },
  ];
}

function stepOnPress(step: CheckStep, navigation: any) {
  if (step.done) return undefined;
  if (step.label === 'Phone number verified') {
    return () =>
      Alert.alert('Phone verified', 'Your number was verified when you signed up. No action needed.');
  }
  return () => navigation.navigate('Profile', step.startEditing ? { startEditing: true } : undefined);
}

// ─── Row component ────────────────────────────────────────────────────────────
type RowProps = { icon: string; label: string; desc?: string; tint: string; bg: string; onPress: () => void; last?: boolean };
function SettingsRow({ icon, label, desc, tint, bg, onPress, last = false }: RowProps) {
  return (
    <TouchableOpacity
      style={[s.row, !last && s.rowBorder]}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={desc ? `${label}. ${desc}` : label}
    >
      <View style={[s.rowIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!desc && <Text style={s.rowDesc} numberOfLines={1}>{desc}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── About row ────────────────────────────────────────────────────────────────
function AboutRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.aboutRow, !last && s.rowBorder]}>
      <Text style={s.aboutLabel}>{label}</Text>
      <Text style={s.aboutValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────
function SegControl({ options, active, onChange }: { options: string[]; active: number; onChange: (i: number) => void }) {
  return (
    <View style={sg.wrap}>
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt}
          style={[sg.seg, i === active && sg.segActive]}
          onPress={() => onChange(i)}
          activeOpacity={0.75}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === active }}
        >
          <Text style={[sg.label, i === active && sg.labelActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets  = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { player } = usePlayerProfile();

  const [activeTab, setActiveTab]   = useState(0);   // 0 = Profile, 1 = Settings
  const [isAdmin, setIsAdmin]       = useState(false);
  const [imgError, setImgError]     = useState(false);
  const resetImgError = useCallback(() => setImgError(false), []);

  // Clear stale error state whenever the avatar URL changes (new upload).
  useEffect(() => { setImgError(false); }, [player?.profile_picture_url]);

  useEffect(() => {
    if (!user?.id) { setIsAdmin(false); return; }
    let cancelled = false;
    supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data, error }) => {
        if (cancelled) return;
        setIsAdmin(!error && data === true);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

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
              const { error } = await supabase.functions.invoke('delete-account', { body: { userId: user!.id } });
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
    Alert.alert('⚠️ Reset All User Data', 'This will permanently clear stats and match history for ALL accounts.', [
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
    ]);
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const firstName   = player?.first_name;
  const lastName    = player?.last_name;
  const fullName    = [firstName, lastName].filter(Boolean).join(' ');
  const displayName = fullName || player?.name || 'Player';
  const initials    = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : displayName.slice(0, 2).toUpperCase();
  const avatarColor = avatarTintFor(displayName);
  const skill       = skillLabel(player?.skill_level);
  const skillTint   = skillColor(player?.skill_level);
  const totalMatches = (player?.wins ?? 0) + (player?.losses ?? 0);
  const winRate      = totalMatches > 0 ? Math.round(((player?.wins ?? 0) / totalMatches) * 100) : 0;

  const steps   = completenessSteps(player, user?.phone);
  const doneCount = steps.filter(s => s.done).length;
  const progress = doneCount / steps.length;
  const nextStep = steps.find(s => !s.done);

  const username = player?.username;

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[
        s.content,
        { paddingTop: insets.top + Spacing.lg, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="dark" />

      {/* ── Identity hero ────────────────────────────────────────────────── */}
      <View style={s.hero}>
        <TouchableOpacity
          style={[s.avatarWrap, { backgroundColor: avatarColor }]}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.85}
        >
          {player?.profile_picture_url && !imgError
            ? <Image
                source={{ uri: player.profile_picture_url }}
                style={s.avatarImg}
                onLoad={resetImgError}
                onError={() => setImgError(true)}
              />
            : <Text style={s.avatarInitials}>{initials}</Text>
          }
          <View style={s.avatarEditBadge}>
            <Ionicons name="camera" size={10} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={s.heroName}>{displayName}</Text>
        {!!username && <Text style={s.heroUsername}>@{username}</Text>}
        {!username && !!user?.phone && (
          <Text style={s.heroUsername}>{user.phone}</Text>
        )}

        {!!skill && (
          <View style={[s.skillChip, { backgroundColor: `${skillTint}18` }]}>
            <View style={[s.skillDot, { backgroundColor: skillTint }]} />
            <Text style={[s.skillText, { color: skillTint }]}>{skill}</Text>
          </View>
        )}

        {/* Stats strip */}
        <View style={s.statsStrip}>
          <View style={s.statCell}>
            <Text style={s.statNum}>{player?.wins ?? 0}</Text>
            <Text style={s.statLbl}>Wins</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Text style={s.statNum}>{player?.losses ?? 0}</Text>
            <Text style={s.statLbl}>Losses</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Text style={s.statNum}>{winRate}%</Text>
            <Text style={s.statLbl}>Win Rate</Text>
          </View>
        </View>
      </View>

      {/* ── Segmented control ─────────────────────────────────────────────── */}
      <SegControl options={['Profile', 'Settings']} active={activeTab} onChange={setActiveTab} />

      {/* ── Profile tab ───────────────────────────────────────────────────── */}
      {activeTab === 0 && (
        <>
          {/* Completeness card */}
          {doneCount < steps.length && (
            <View style={s.card}>
              <View style={s.completenessHeader}>
                <Text style={s.completenessTitle}>Complete your profile</Text>
                <Text style={s.completenessCount}>{doneCount} of {steps.length}</Text>
              </View>
              <Text style={s.completenessDesc}>A complete profile helps you find better match opponents.</Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
              </View>
              {!!nextStep && (
                <TouchableOpacity
                  style={s.nextStepBtn}
                  onPress={stepOnPress(nextStep, navigation)}
                  activeOpacity={0.8}
                >
                  <Text style={s.nextStepBtnText}>{nextStep.label}</Text>
                  <Ionicons name="arrow-forward" size={13} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Checklist */}
          <View style={s.card}>
            {steps.map((step, i) => {
              const press = stepOnPress(step, navigation);
              const Row = press ? TouchableOpacity : View;
              return (
                <Row
                  key={step.label}
                  style={[s.checkRow, i < steps.length - 1 && s.rowBorder]}
                  {...(press ? { onPress: press, activeOpacity: 0.65 } : {})}
                >
                  <View style={[s.checkIcon, { backgroundColor: step.done ? 'rgba(249,115,22,0.12)' : Colors.backgroundAlt }]}>
                    <Ionicons
                      name={step.done ? 'checkmark-circle' : 'add-circle-outline'}
                      size={18}
                      color={step.done ? Palette.orange500 : Colors.textMuted}
                    />
                  </View>
                  <Text style={[s.checkLabel, step.done && s.checkLabelDone]}>{step.label}</Text>
                  {step.done
                    ? <View style={s.checkBadge}><Text style={s.checkBadgeText}>Done</Text></View>
                    : <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
                  }
                </Row>
              );
            })}
          </View>
        </>
      )}

      {/* ── Settings tab ──────────────────────────────────────────────────── */}
      {activeTab === 1 && (
        <>
          {/* Preferences */}
          <View style={s.groupHeader}>
            <Text style={s.groupLabel}>Preferences</Text>
          </View>
          <View style={s.card}>
            {SETTINGS_SECTIONS.map((sec, i) => (
              <SettingsRow
                key={sec.screen}
                icon={sec.icon}
                label={sec.label}
                desc={sec.desc}
                tint={sec.tint}
                bg={sec.bg}
                onPress={() => navigation.navigate(sec.screen)}
                last={i === SETTINGS_SECTIONS.length - 1}
              />
            ))}
          </View>

          {/* Admin */}
          {isAdmin && (
            <>
              <View style={s.groupHeader}>
                <Text style={s.groupLabel}>Admin</Text>
              </View>
              <View style={s.card}>
                <SettingsRow
                  icon="shield"
                  label="Admin Panel"
                  desc="Reset all user data"
                  tint="#7c3aed"
                  bg="rgba(124,58,237,0.12)"
                  onPress={handleAdminReset}
                  last
                />
              </View>
            </>
          )}

          {/* About */}
          <View style={s.groupHeader}>
            <Text style={s.groupLabel}>About</Text>
          </View>
          <View style={s.card}>
            <AboutRow label="Version" value={APP_VERSION} />
            <AboutRow label="Platform" value={Platform.OS === 'ios' ? 'iOS' : 'Android'} />
            <AboutRow label="Account ID" value={`${(user?.id ?? '').slice(0, 16)}…`} last />
          </View>

          {/* Danger */}
          <View style={s.groupHeader}>
            <Text style={[s.groupLabel, { color: Colors.error }]}>Danger Zone</Text>
          </View>
          <View style={s.card}>
            <TouchableOpacity
              style={[s.row, s.rowBorder]}
              onPress={handleSignOut}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel="Sign Out"
            >
              <View style={[s.rowIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name="log-out-outline" size={18} color={Colors.error} />
              </View>
              <Text style={[s.rowLabel, { flex: 1, color: Colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.row}
              onPress={handleDeleteAccount}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel="Delete Account"
            >
              <View style={[s.rowIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Ionicons name="trash" size={18} color={Colors.error} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.rowLabel, { color: Colors.error }]}>Delete Account</Text>
                <Text style={s.rowDesc}>Permanently removes your account and all data</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>
            Deletion is permanent and cannot be undone.{'\n'}Top Tennis · © 2025
          </Text>
        </>
      )}
    </ScrollView>
  );
};

// ─── Segmented control styles ──────────────────────────────────────────────────
const sg = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.sm,
    padding: 3,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  seg: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.xs,
    alignItems: 'center',
  },
  segActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontFamily: Font.medium,
    color: Colors.textSecondary,
  },
  labelActive: {
    fontFamily: Font.semibold,
    color: Colors.text,
  },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: 0,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarInitials: {
    fontSize: 26,
    fontFamily: Font.bold,
    color: '#fff',
    letterSpacing: -0.5,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Palette.orange500,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  heroName: {
    fontSize: FontSize.xl,
    fontFamily: Font.bold,
    color: Colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroUsername: {
    fontSize: FontSize.sm,
    fontFamily: Font.regular,
    color: Colors.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  skillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  skillText: {
    fontSize: FontSize.xs,
    fontFamily: Font.semibold,
    letterSpacing: 0.1,
  },
  statsStrip: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    width: '100%',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  statNum: {
    fontSize: FontSize.xxl,
    fontFamily: Font.bold,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statLbl: {
    fontSize: FontSize.xxs,
    fontFamily: Font.regular,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Group header ─────────────────────────────────────────────────────────
  groupHeader: {
    paddingHorizontal: Spacing.xs,
    paddingBottom: 6,
    marginTop: Spacing.lg,
    marginBottom: 4,
  },
  groupLabel: {
    fontSize: FontSize.xs,
    fontFamily: Font.medium,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  // ── Shared card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },

  // ── Settings row ─────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 3,
    gap: Spacing.md,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowLabel: {
    fontSize: FontSize.sm,
    fontFamily: Font.semibold,
    color: Colors.text,
  },
  rowDesc: {
    fontSize: FontSize.xxs + 1,
    fontFamily: Font.regular,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  // ── Profile checklist ────────────────────────────────────────────────────
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.md,
    minHeight: 48,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Font.medium,
    color: Colors.text,
  },
  checkLabelDone: {
    color: Colors.textSecondary,
  },
  checkBadge: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  checkBadgeText: {
    fontSize: FontSize.xxs,
    fontFamily: Font.semibold,
    color: Palette.orange500,
  },

  // ── Completeness card ─────────────────────────────────────────────────────
  completenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  completenessTitle: {
    fontSize: FontSize.sm,
    fontFamily: Font.bold,
    color: Colors.text,
  },
  completenessCount: {
    fontSize: FontSize.xs,
    fontFamily: Font.semibold,
    color: Colors.textSecondary,
  },
  completenessDesc: {
    fontSize: FontSize.xs,
    fontFamily: Font.regular,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    lineHeight: 17,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 2,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Palette.orange500,
    borderRadius: 2,
  },
  nextStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Palette.orange500,
    borderRadius: Radius.md,
    paddingVertical: 10,
  },
  nextStepBtnText: {
    fontSize: FontSize.sm,
    fontFamily: Font.semibold,
    color: '#fff',
  },

  // ── About row ─────────────────────────────────────────────────────────────
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 44,
  },
  aboutLabel: {
    fontSize: FontSize.sm,
    fontFamily: Font.regular,
    color: Colors.textSecondary,
  },
  aboutValue: {
    fontSize: FontSize.sm,
    fontFamily: Font.semibold,
    color: Colors.text,
    maxWidth: '60%',
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    fontSize: FontSize.xxs,
    fontFamily: Font.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
});
