import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow, Palette } from '@/theme/colors';

const SKILL_LEVELS   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const COMPETITIVENESS = ['casual', 'competitive', 'serious'];
const AGE_RANGES     = ['18-25', '26-35', '36-45', '46-55', '55+'];

const skillLabel = (l?: number) => !l ? 'Unrated' : l <= 3 ? 'Beginner' : l <= 6 ? 'Intermediate' : 'Advanced';
const skillColor = (l?: number): string => !l ? Palette.gray400 : l <= 3 ? Palette.green500 : l <= 6 ? Palette.yellow500 : Palette.orange500;

// ─────────────────────────────────────────────────────────────────────────────

export const ProfileScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { player: profile, loading, updatePlayerProfile: updateProfile } = usePlayerProfile();
  const { uploading: uploadingPic, showPicker } = useProfilePicture();

  const fullName = profile?.name || user?.email?.split('@')[0] || 'Player';
  const wins   = profile?.wins   ?? 0;
  const losses = profile?.losses ?? 0;
  const total  = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState<Record<string, any>>({});
  const [localPicUrl, setLocalPicUrl] = useState<string | null>(null);

  const startEdit = () => {
    const parts = (profile?.name || '').split(' ');
    setForm({
      first_name:          profile?.first_name || parts[0] || '',
      last_name:           profile?.last_name  || parts.slice(1).join(' ') || '',
      phone:               profile?.phone || '',
      city:                profile?.city || '',
      zip_code:            profile?.zip_code || '',
      usta_rating:         profile?.usta_rating || '',
      skill_level:         profile?.skill_level,
      competitiveness:     profile?.competitiveness || '',
      age_range:           profile?.age_range || '',
      bio:                 profile?.bio || '',
      networking_enabled:  profile?.networking_enabled ?? true,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const name = `${form.first_name || ''} ${form.last_name || ''}`.trim();
      await updateProfile({ ...form, name: name || profile?.name });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        {navigation?.canGoBack?.() && (
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </TouchableOpacity>
        )}
        <Text style={s.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={[s.editBtn, editing && s.editBtnSave]}
          onPress={editing ? handleSave : startEdit}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[Palette.dark900, Palette.dark700, Palette.dark600]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          {/* Avatar */}
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={() => showPicker(url => setLocalPicUrl(url))}
            disabled={uploadingPic}
            activeOpacity={0.8}
          >
            <Avatar name={fullName} size={88} imageUrl={localPicUrl || profile?.profile_picture_url} />
            <View style={s.cameraOverlay}>
              {uploadingPic
                ? <ActivityIndicator size={16} color="#fff" />
                : <Ionicons name="camera" size={18} color="#fff" />
              }
            </View>
          </TouchableOpacity>

          <Text style={s.heroName}>{fullName}</Text>
          <Text style={s.heroEmail}>{user?.email}</Text>

          <View style={s.heroBadges}>
            <View style={[s.levelBadge, { backgroundColor: skillColor(profile?.skill_level) }]}>
              <Text style={s.levelBadgeText}>{skillLabel(profile?.skill_level)}</Text>
            </View>
            {profile?.usta_rating && (
              <View style={s.ustaBadge}>
                <Ionicons name="tennisball" size={11} color={Colors.primary} />
                <Text style={s.ustaBadgeText}>USTA {profile.usta_rating}</Text>
              </View>
            )}
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            {[
              { label: 'Wins',     value: wins   },
              { label: 'Losses',   value: losses  },
              { label: 'Win Rate', value: winRate != null ? `${winRate}%` : '—' },
              { label: 'Matches',  value: total   },
            ].map((st, i, arr) => (
              <React.Fragment key={st.label}>
                <View style={s.statCol}>
                  <Text style={s.statNum}>{st.value}</Text>
                  <Text style={s.statLbl}>{st.label}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.statDiv} />}
              </React.Fragment>
            ))}
          </View>
        </LinearGradient>

        {/* ── Personal Info ──────────────────────────────────────────────── */}
        <SectionLabel>Personal Information</SectionLabel>
        <View style={s.card}>
          {editing ? (
            <>
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>First Name</FieldLabel>
                  <TextInput style={s.input} value={form.first_name} onChangeText={v => setForm(f => ({ ...f, first_name: v }))} placeholder="First name" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Last Name</FieldLabel>
                  <TextInput style={s.input} value={form.last_name} onChangeText={v => setForm(f => ({ ...f, last_name: v }))} placeholder="Last name" placeholderTextColor={Colors.textMuted} />
                </View>
              </View>
              <FieldLabel>Phone</FieldLabel>
              <TextInput style={s.input} value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} placeholder="+1 (555) 000-0000" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
              <View style={s.twoCol}>
                <View style={{ flex: 2 }}>
                  <FieldLabel>City</FieldLabel>
                  <TextInput style={s.input} value={form.city} onChangeText={v => setForm(f => ({ ...f, city: v }))} placeholder="City" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>ZIP</FieldLabel>
                  <TextInput style={s.input} value={form.zip_code} onChangeText={v => setForm(f => ({ ...f, zip_code: v }))} placeholder="ZIP" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
                </View>
              </View>
              <FieldLabel>Bio</FieldLabel>
              <TextInput style={[s.input, s.textArea]} value={form.bio} onChangeText={v => setForm(f => ({ ...f, bio: v }))} placeholder="Tell others about yourself..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
            </>
          ) : (
            <>
              <InfoRow icon="person-outline"   label="Name"     value={fullName} />
              <InfoRow icon="mail-outline"      label="Email"    value={user?.email || '—'} />
              <InfoRow icon="call-outline"      label="Phone"    value={profile?.phone || '—'} />
              <InfoRow icon="location-outline"  label="Location" value={profile?.city && profile?.zip_code ? `${profile.city}, ${profile.zip_code}` : profile?.city || '—'} last={!profile?.bio} />
              {profile?.bio && <InfoRow icon="document-text-outline" label="Bio" value={profile.bio} last />}
            </>
          )}
        </View>

        {/* ── Tennis Profile ─────────────────────────────────────────────── */}
        <SectionLabel>Tennis Profile</SectionLabel>
        <View style={s.card}>
          {editing ? (
            <>
              <FieldLabel>Skill Level (1–10)</FieldLabel>
              <View style={s.skillGrid}>
                {SKILL_LEVELS.map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[s.skillBtn, form.skill_level === l && { backgroundColor: skillColor(l), borderColor: skillColor(l) }]}
                    onPress={() => setForm(f => ({ ...f, skill_level: l }))}
                  >
                    <Text style={[s.skillBtnText, form.skill_level === l && { color: '#fff' }]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FieldLabel>USTA Rating</FieldLabel>
              <TextInput style={s.input} value={form.usta_rating} onChangeText={v => setForm(f => ({ ...f, usta_rating: v }))} placeholder="e.g. 3.5" placeholderTextColor={Colors.textMuted} />
              <FieldLabel>Playing Style</FieldLabel>
              <View style={s.chips}>
                {COMPETITIVENESS.map(c => (
                  <TouchableOpacity key={c} style={[s.chip, form.competitiveness === c && s.chipActive]} onPress={() => setForm(f => ({ ...f, competitiveness: c }))}>
                    <Text style={[s.chipText, form.competitiveness === c && s.chipTextActive]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FieldLabel>Age Range</FieldLabel>
              <View style={s.chips}>
                {AGE_RANGES.map(a => (
                  <TouchableOpacity key={a} style={[s.chip, form.age_range === a && s.chipActive]} onPress={() => setForm(f => ({ ...f, age_range: a }))}>
                    <Text style={[s.chipText, form.age_range === a && s.chipTextActive]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchLabel}>Open to Networking</Text>
                  <Text style={s.switchSub}>Allow others to find and contact you</Text>
                </View>
                <Switch value={form.networking_enabled} onValueChange={v => setForm(f => ({ ...f, networking_enabled: v }))} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor="#fff" />
              </View>
            </>
          ) : (
            <>
              <InfoRow icon="tennisball-outline" label="Skill Level"     value={profile?.skill_level ? `${profile.skill_level}/10 — ${skillLabel(profile.skill_level)}` : '—'} />
              <InfoRow icon="ribbon-outline"     label="USTA Rating"     value={profile?.usta_rating || '—'} />
              <InfoRow icon="flame-outline"      label="Playing Style"   value={profile?.competitiveness ? profile.competitiveness.charAt(0).toUpperCase() + profile.competitiveness.slice(1) : '—'} />
              <InfoRow icon="people-outline"     label="Age Range"       value={profile?.age_range || '—'} />
              <InfoRow icon="wifi-outline"       label="Networking"      value={profile?.networking_enabled !== false ? 'Enabled' : 'Disabled'} last />
            </>
          )}
        </View>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <View style={s.actionsSection}>
          {navigation && (
            <TouchableOpacity style={s.actionRow} onPress={() => navigation.navigate('Settings')} activeOpacity={0.75}>
              <View style={[s.actionIcon, { backgroundColor: Palette.gray100 }]}>
                <Ionicons name="settings-outline" size={18} color={Palette.gray500} />
              </View>
              <Text style={s.actionLabel}>App Settings</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={handleSignOut} activeOpacity={0.75}>
            <View style={[s.actionIcon, { backgroundColor: Palette.redBg }]}>
              <Ionicons name="log-out-outline" size={18} color={Palette.red500} />
            </View>
            <Text style={[s.actionLabel, { color: Palette.red500 }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text style={sl.text}>{children}</Text>
);
const sl = StyleSheet.create({
  text: {
    fontSize: FontSize.xxs,
    fontWeight: FontWeight.black,
    color: Palette.gray400,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
});

const FieldLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text style={fl.text}>{children}</Text>
);
const fl = StyleSheet.create({
  text: {
    fontSize: FontSize.xxs,
    fontWeight: FontWeight.bold,
    color: Palette.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 5,
    marginTop: Spacing.md,
  },
});

const InfoRow: React.FC<{ icon: any; label: string; value: string; last?: boolean }> = ({ icon, label, value, last = false }) => (
  <View style={[ir.row, !last && ir.divider]}>
    <View style={ir.iconWrap}>
      <Ionicons name={icon} size={16} color={Palette.gray400} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value}>{value}</Text>
    </View>
  </View>
);
const ir = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: Spacing.md },
  divider:{ borderBottomWidth: 1, borderBottomColor: Colors.separator },
  iconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.backgroundAlt, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  label:  { fontSize: FontSize.xxs, fontWeight: FontWeight.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  value:  { fontSize: FontSize.md, color: Colors.text, fontWeight: FontWeight.medium },
});

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.black,
    color: Colors.text,
    letterSpacing: -1,
  },
  editBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editBtnSave: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadow.orange,
  },
  editBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },

  // Hero
  hero: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  cameraOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroName:  { fontSize: FontSize.xxl, fontWeight: FontWeight.black, color: '#fff', letterSpacing: -0.5, marginTop: 4 },
  heroEmail: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', fontWeight: FontWeight.medium },
  heroBadges:{ flexDirection: 'row', gap: 8, marginTop: 4 },
  levelBadge:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  levelBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  ustaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  ustaBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  statCol:  { flex: 1, alignItems: 'center', gap: 3 },
  statNum:  { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: '#fff', letterSpacing: -0.5 },
  statLbl:  { fontSize: FontSize.xxs, color: 'rgba(255,255,255,0.50)', fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.3 },
  statDiv:  { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 4 },

  // Card
  card: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.xs,
  },

  // Form
  twoCol: { flexDirection: 'row', gap: Spacing.md },
  input: {
    height: 46,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md, color: Colors.text,
    backgroundColor: Colors.surface,
    marginBottom: 2,
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: Spacing.sm },

  skillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  skillBtn: {
    width: 46, height: 46, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  skillBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textSecondary },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.primary },

  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.separator,
    marginTop: Spacing.sm,
  },
  switchLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  switchSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Actions section
  actionsSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.xs,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
  },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  actionDivider: { height: 1, backgroundColor: Colors.separator, marginHorizontal: Spacing.lg },
});
