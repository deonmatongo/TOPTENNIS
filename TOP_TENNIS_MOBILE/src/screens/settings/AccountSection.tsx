import React, { useState } from 'react';
import {
  View, Text, Alert, ActivityIndicator, StyleSheet,
  ScrollView, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { Colors, Radius, Spacing, FontSize, Font } from '@/theme/colors';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard,
  NavRow, sharedContent,
} from './_shared';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const nr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});

export const AccountSection: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [sendingReset, setSendingReset] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const openEmailModal = () => { setNewEmail(''); setEmailModal(true); };

  const handleChangeEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (email === (user?.email || '').toLowerCase()) {
      Alert.alert('Same email', 'That is already the email on your account.');
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      setEmailModal(false);
      Alert.alert(
        'Confirm your new email',
        `We've sent a confirmation link to ${email}. Your email address changes once you tap that link. Until then, keep signing in with your current email.`,
      );
    } catch (e: any) {
      Alert.alert('Could not change email', e?.message ?? 'Please try again, or contact support@toptennis.app.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordReset = () => {
    if (!user?.email) {
      Alert.alert('No email on file', 'We could not find an email address for your account. Please contact support@toptennis.app.');
      return;
    }
    Alert.alert(
      'Reset Password',
      `We'll email a secure password-reset link to ${user.email}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            setSendingReset(true);
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(user.email!, {
                redirectTo: 'toptennis://reset-password',
              });
              if (error) throw error;
              Alert.alert('Check your inbox', `A password-reset link is on its way to ${user.email}. It expires in 1 hour.`);
            } catch (e: any) {
              Alert.alert('Could not send link', e?.message ?? 'Please try again, or contact support@toptennis.app.');
            } finally {
              setSendingReset(false);
            }
          },
        },
      ],
    );
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
            icon="shield-checkmark-outline"
            label={sendingReset ? 'Sending reset link…' : 'Reset Password'}
            desc="Email yourself a secure reset link"
            color="#8b5cf6"
            onPress={sendingReset ? () => {} : handlePasswordReset}
          />
          <NavRow
            icon="mail-outline"
            label="Email Address"
            desc={`${user?.email || '—'} · tap to change`}
            color={Colors.textSecondary}
            onPress={openEmailModal}
            last
          />
        </SectionCard>
      </ScrollView>

      {/* Change email modal */}
      <Modal visible={emailModal} transparent animationType="fade" onRequestClose={() => setEmailModal(false)}>
        <KeyboardAvoidingView style={em.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={em.card}>
            <Text style={em.title}>Change Email</Text>
            <Text style={em.sub}>Current: {user?.email || '—'}</Text>
            <TextInput
              style={em.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="New email address"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoFocus
              editable={!savingEmail}
            />
            <Text style={em.hint}>We'll send a confirmation link to the new address. Your email changes only after you confirm it.</Text>
            <View style={em.actions}>
              <TouchableOpacity style={[em.btn, em.btnGhost]} onPress={() => setEmailModal(false)} disabled={savingEmail}>
                <Text style={em.btnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[em.btn, em.btnPrimary, savingEmail && { opacity: 0.6 }]} onPress={handleChangeEmail} disabled={savingEmail}>
                {savingEmail ? <ActivityIndicator size="small" color="#fff" /> : <Text style={em.btnPrimaryTxt}>Send Confirmation</Text>}
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
