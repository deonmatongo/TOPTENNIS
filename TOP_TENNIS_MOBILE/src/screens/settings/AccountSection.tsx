import React, { useEffect, useState } from 'react';
import {
  View, Text, Alert, ActivityIndicator, StyleSheet,
  ScrollView, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { Colors, Radius, Spacing, FontSize, Font } from '@/theme/colors';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard,
  NavRow, sharedContent,
} from './_shared';

/**
 * Account settings for email + username auth.
 *
 * "Reset password" here is signed-in-user password change, not the
 * forgotten-password flow. The user is signed in, so they can set a password
 * directly — and because the session already proves identity, no security
 * question is needed. Current password is still required so that a borrowed
 * unlocked phone cannot be used to take the account over.
 */

export const AccountSection: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();

  const [username, setUsername] = useState<string | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);

  const [pwModal, setPwModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoadingIdentity(false); return; }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setUsername(data?.username ?? null);
        setLoadingIdentity(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwModal(true);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Your new password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Re-enter your new password.');
      return;
    }
    if (!currentPassword) {
      Alert.alert('Current password required', 'Enter your current password to confirm.');
      return;
    }

    setSavingPassword(true);
    try {
      // Re-authenticate first. updateUser({ password }) alone would let anyone
      // holding an unlocked phone change the password without knowing the old
      // one, which is an account-takeover path.
      if (!user?.email) {
        Alert.alert(
          'Could not verify',
          'We could not confirm your identity. Please sign out and use "Forgot password".',
        );
        return;
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        Alert.alert('Incorrect password', 'Your current password is not correct.');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPwModal(false);
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (e: any) {
      Alert.alert(
        'Could not change password',
        e?.message ?? 'Please try again, or contact support@toptennis.app.',
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SettingsSafeScreen>
      <SectionPageHeader title="Account" subtitle="Profile & security" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={sharedContent.scroll}>
        <SectionCard>
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
            icon="at-outline"
            label="Username"
            desc={loadingIdentity ? 'Loading…' : (username ?? 'Not set')}
            color={Colors.textSecondary}
            onPress={() => navigation.navigate('Profile')}
          />
          <NavRow
            icon="mail-outline"
            label="Email"
            desc={`${user?.email ?? '—'} · contact support to change`}
            color={Colors.textSecondary}
            onPress={() =>
              Alert.alert(
                'Change email',
                'For security, changing the email on your account has to be verified. Contact support@toptennis.app and we will help.',
              )
            }
          />
          <NavRow
            icon="shield-checkmark-outline"
            label="Change Password"
            desc="Requires your current password"
            color="#8b5cf6"
            onPress={openPasswordModal}
            last
          />
        </SectionCard>
      </ScrollView>

      <Modal visible={pwModal} transparent animationType="fade" onRequestClose={() => setPwModal(false)}>
        <KeyboardAvoidingView style={em.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={em.card}>
            <Text style={em.title}>Change Password</Text>
            <Text style={em.sub}>Signed in as {username ?? '—'}</Text>

            <TextInput
              style={em.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              editable={!savingPassword}
              autoFocus
            />
            <TextInput
              style={em.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (at least 8 characters)"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!savingPassword}
            />
            <TextInput
              style={em.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!savingPassword}
            />

            <Text style={em.hint}>
              Your other devices stay signed in. Use “Forgot password” from the sign-in screen if
              you want to sign out everywhere.
            </Text>

            <View style={em.actions}>
              <TouchableOpacity
                style={[em.btn, em.btnGhost]}
                onPress={() => setPwModal(false)}
                disabled={savingPassword}
              >
                <Text style={em.btnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[em.btn, em.btnPrimary, savingPassword && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={em.btnPrimaryTxt}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SettingsSafeScreen>
  );
};

const em = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  card: { width: '100%', maxWidth: 420, backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  title: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  input: { marginTop: Spacing.sm, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.background },
  hint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  btn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: Colors.backgroundAlt, borderWidth: 1, borderColor: Colors.border },
  btnGhostTxt: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryTxt: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: '#fff' },
});
