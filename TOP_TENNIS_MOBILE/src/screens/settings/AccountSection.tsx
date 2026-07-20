import React from 'react';
import { View, Text, Switch, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useBiometrics } from '@/hooks/useBiometrics';
import { Colors, Spacing, FontSize, Font } from '@/theme/colors';
import {
  SettingsSafeScreen, SectionPageHeader, SectionCard,
  NavRow, sharedContent,
} from './_shared';

const nr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.md },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  desc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});

export const AccountSection: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const { available, biometricLabel, credentialsStored, clearCredentials, authenticate } = useBiometrics();

  const handleToggleBiometrics = () => {
    if (credentialsStored) {
      Alert.alert(
        `Disable ${biometricLabel}`,
        `You will no longer be able to sign in with ${biometricLabel}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disable', style: 'destructive', onPress: clearCredentials },
        ],
      );
    } else {
      Alert.alert(
        `Enable ${biometricLabel}`,
        `To enable ${biometricLabel} sign-in, please sign out and back in from the login screen.`,
        [{ text: 'OK' }],
      );
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
            icon="shield-checkmark-outline"
            label="Account Security"
            desc={user?.email || 'Manage your credentials'}
            color="#8b5cf6"
            onPress={() => Alert.alert('Account Security', 'Password changes are managed via email. Check your inbox for a reset link.', [{ text: 'OK' }])}
          />
          {available && (
            <View style={[nr.row, { borderBottomWidth: 1, borderBottomColor: Colors.borderLight }]}>
              <View style={[nr.icon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name={biometricLabel === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} size={18} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={nr.label}>{biometricLabel} Sign-In</Text>
                <Text style={nr.desc}>{credentialsStored ? `${biometricLabel} is enabled` : `Sign in faster with ${biometricLabel}`}</Text>
              </View>
              <Switch
                value={credentialsStored}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: Colors.borderLight, true: '#93c5fd' }}
                thumbColor={credentialsStored ? '#3b82f6' : Colors.textMuted}
              />
            </View>
          )}
          <NavRow
            icon="mail-outline"
            label="Email Address"
            desc={user?.email || '—'}
            color={Colors.textSecondary}
            onPress={() => Alert.alert('Change Email', 'To change your email, please contact support@toptennis.app')}
            last
          />
        </SectionCard>
      </ScrollView>
    </SettingsSafeScreen>
  );
};
