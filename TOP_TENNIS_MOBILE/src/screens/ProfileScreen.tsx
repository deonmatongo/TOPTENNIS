import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

const SKILL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const COMPETITIVENESS = ['casual', 'competitive', 'serious'];
const AGE_RANGES = ['18-25', '26-35', '36-45', '46-55', '55+'];

const skillLabel = (level?: number) => {
  if (!level) return 'Unrated';
  if (level <= 3) return 'Beginner';
  if (level <= 6) return 'Intermediate';
  return 'Advanced';
};

const skillColor = (level?: number): 'success' | 'warning' | 'error' | 'default' => {
  if (!level) return 'default';
  if (level <= 3) return 'success';
  if (level <= 6) return 'warning';
  return 'error';
};

export const ProfileScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { player: profile, loading, updatePlayerProfile: updateProfile } = usePlayerProfile();
  const { uploading: uploadingPic, showPicker } = useProfilePicture();
  const fullName = profile?.name || user?.email?.split('@')[0] || 'Player';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [localPicUrl, setLocalPicUrl] = useState<string | null>(null);

  const startEdit = () => {
    const nameParts = (profile?.name || '').split(' ');
    setForm({
      first_name: profile?.first_name || nameParts[0] || '',
      last_name: profile?.last_name || nameParts.slice(1).join(' ') || '',
      phone: profile?.phone || '',
      city: profile?.city || '',
      zip_code: profile?.zip_code || '',
      usta_rating: profile?.usta_rating || '',
      skill_level: profile?.skill_level,
      competitiveness: profile?.competitiveness || '',
      age_range: profile?.age_range || '',
      bio: profile?.bio || '',
      networking_enabled: profile?.networking_enabled ?? true,
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
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const displayName = fullName;

  const editBtn = (
    <TouchableOpacity
      onPress={editing ? handleSave : startEdit}
      disabled={saving}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {saving
        ? <ActivityIndicator size="small" color="#fff" />
        : <Text style={styles.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="My Profile" subtitle="Personal settings & stats" navigation={navigation} showBack rightElement={editBtn} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Hero */}
        <Card elevated style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.avatarWrap}>
              <TouchableOpacity
                onPress={() => showPicker(url => { setLocalPicUrl(url); })}
                activeOpacity={0.75}
                disabled={uploadingPic}
              >
                <Avatar
                  name={displayName}
                  size={80}
                  imageUrl={localPicUrl || profile?.profile_picture_url}
                />
                <View style={styles.avatarOverlay}>
                  {uploadingPic
                    ? <ActivityIndicator size={16} color="#fff" />
                    : <Ionicons name="camera" size={18} color="#fff" />
                  }
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={() => showPicker(url => { setLocalPicUrl(url); })}
                disabled={uploadingPic}
              >
                <Text style={styles.changePhotoText}>
                  {uploadingPic ? 'Uploading...' : 'Change Photo'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{displayName}</Text>
              <Text style={styles.heroEmail}>{user?.email}</Text>
              <View style={styles.heroBadges}>
                <Badge label={skillLabel(profile?.skill_level)} variant={skillColor(profile?.skill_level)} />
                {profile?.usta_rating && <Badge label={`USTA ${profile.usta_rating}`} variant="info" />}
              </View>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.wins ?? 0}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.losses ?? 0}</Text>
              <Text style={styles.statLabel}>Losses</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {profile?.wins && profile?.losses
                  ? `${Math.round((profile.wins / (profile.wins + profile.losses)) * 100)}%`
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>
        </Card>

        {/* Personal Info */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <Card style={styles.infoCard}>
          {editing ? (
            <>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: Spacing.sm }]}>
                  <Text style={styles.formLabel}>First Name</Text>
                  <TextInput style={styles.formInput} value={form.first_name} onChangeText={v => setForm(f => ({ ...f, first_name: v }))} placeholder="First name" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Last Name</Text>
                  <TextInput style={styles.formInput} value={form.last_name} onChangeText={v => setForm(f => ({ ...f, last_name: v }))} placeholder="Last name" placeholderTextColor={Colors.textMuted} />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone</Text>
                <TextInput style={styles.formInput} value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} placeholder="+1 (555) 000-0000" placeholderTextColor={Colors.textMuted} keyboardType="phone-pad" />
              </View>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 2, marginRight: Spacing.sm }]}>
                  <Text style={styles.formLabel}>City</Text>
                  <TextInput style={styles.formInput} value={form.city} onChangeText={v => setForm(f => ({ ...f, city: v }))} placeholder="City" placeholderTextColor={Colors.textMuted} />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>ZIP</Text>
                  <TextInput style={styles.formInput} value={form.zip_code} onChangeText={v => setForm(f => ({ ...f, zip_code: v }))} placeholder="ZIP" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Bio</Text>
                <TextInput style={[styles.formInput, styles.textArea]} value={form.bio} onChangeText={v => setForm(f => ({ ...f, bio: v }))} placeholder="Tell others about yourself..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} />
              </View>
            </>
          ) : (
            <>
              <InfoRow icon="person-outline" label="Name" value={displayName} />
              <InfoRow icon="mail-outline" label="Email" value={user?.email || '—'} />
              <InfoRow icon="call-outline" label="Phone" value={profile?.phone || '—'} />
              <InfoRow icon="location-outline" label="Location" value={profile?.city && profile?.zip_code ? `${profile.city}, ${profile.zip_code}` : profile?.city || '—'} />
              {profile?.bio && <InfoRow icon="document-text-outline" label="Bio" value={profile.bio} />}
            </>
          )}
        </Card>

        {/* Tennis Profile */}
        <Text style={styles.sectionTitle}>Tennis Profile</Text>
        <Card style={styles.infoCard}>
          {editing ? (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Skill Level (1–10)</Text>
                <View style={styles.skillGrid}>
                  {SKILL_LEVELS.map(l => (
                    <TouchableOpacity key={l} style={[styles.skillBtn, form.skill_level === l && styles.skillBtnActive]} onPress={() => setForm(f => ({ ...f, skill_level: l }))}>
                      <Text style={[styles.skillBtnText, form.skill_level === l && styles.skillBtnTextActive]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>USTA Rating</Text>
                <TextInput style={styles.formInput} value={form.usta_rating} onChangeText={v => setForm(f => ({ ...f, usta_rating: v }))} placeholder="e.g. 3.5" placeholderTextColor={Colors.textMuted} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Competitiveness</Text>
                <View style={styles.chipRow}>
                  {COMPETITIVENESS.map(c => (
                    <TouchableOpacity key={c} style={[styles.chip, form.competitiveness === c && styles.chipActive]} onPress={() => setForm(f => ({ ...f, competitiveness: c }))}>
                      <Text style={[styles.chipText, form.competitiveness === c && styles.chipTextActive]} >{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Age Range</Text>
                <View style={styles.chipRow}>
                  {AGE_RANGES.map(a => (
                    <TouchableOpacity key={a} style={[styles.chip, form.age_range === a && styles.chipActive]} onPress={() => setForm(f => ({ ...f, age_range: a }))}>
                      <Text style={[styles.chipText, form.age_range === a && styles.chipTextActive]}>{a}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Open to Networking</Text>
                  <Text style={styles.switchSub}>Allow others to find and contact you</Text>
                </View>
                <Switch value={form.networking_enabled} onValueChange={v => setForm(f => ({ ...f, networking_enabled: v }))} trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.surface} />
              </View>
            </>
          ) : (
            <>
              <InfoRow icon="tennisball-outline" label="Skill Level" value={profile?.skill_level ? `${profile.skill_level}/10 — ${skillLabel(profile.skill_level)}` : '—'} />
              <InfoRow icon="ribbon-outline" label="USTA Rating" value={profile?.usta_rating || '—'} />
              <InfoRow icon="flame-outline" label="Competitiveness" value={profile?.competitiveness ? profile.competitiveness.charAt(0).toUpperCase() + profile.competitiveness.slice(1) : '—'} />
              <InfoRow icon="people-outline" label="Age Range" value={profile?.age_range || '—'} />
              <InfoRow icon="wifi-outline" label="Networking" value={profile?.networking_enabled ? 'Enabled' : 'Disabled'} />
            </>
          )}
        </Card>

        {/* Settings */}
        {navigation && (
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.settingsBtnText}>App Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const InfoRow: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={infoStyles.row}>
    <Ionicons name={icon} size={16} color={Colors.textMuted} style={infoStyles.icon} />
    <View style={infoStyles.content}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  </View>
);

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  icon: { marginRight: Spacing.md, marginTop: 2 },
  content: { flex: 1 },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium, marginBottom: 2 },
  value: { fontSize: FontSize.md, color: Colors.text },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  scroll: { flex: 1 },
  content: { paddingBottom: Spacing.xxxl },

  heroCard: { margin: Spacing.lg, marginBottom: Spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
  avatarWrap: { alignItems: 'center', gap: 6 },
  avatarOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' },
  changePhotoBtn: { paddingHorizontal: Spacing.xs, paddingVertical: 2 },
  changePhotoText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  heroInfo: { flex: 1 },
  heroName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 2 },
  heroEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  heroBadges: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  statDivider: { width: 1, backgroundColor: Colors.borderLight },

  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  infoCard: { marginHorizontal: Spacing.lg },

  formRow: { flexDirection: 'row' },
  formGroup: { marginBottom: Spacing.md },
  formLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: Spacing.xs },
  formInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  textArea: { height: 80, textAlignVertical: 'top' },

  skillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  skillBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  skillBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  skillBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  skillBtnTextActive: { color: Colors.textInverse },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  switchInfo: { flex: 1 },
  switchLabel: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.text },
  switchSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },

  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  settingsBtnText: { fontSize: FontSize.md, color: Colors.text, fontWeight: FontWeight.medium },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  signOutText: { fontSize: FontSize.md, color: Colors.error, fontWeight: FontWeight.semibold },
});
