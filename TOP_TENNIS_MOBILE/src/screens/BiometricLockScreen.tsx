import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { useBiometrics } from '@/hooks/useBiometrics';

interface Props {
  onUnlock: () => void;
  onSignOut: () => Promise<void>;
}

export const BiometricLockScreen: React.FC<Props> = ({ onUnlock, onSignOut }) => {
  const { available, biometricType, biometricLabel, verifyIdentity } = useBiometrics();
  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleUnlock = async () => {
    if (verifying) return;
    setVerifying(true);
    setFailed(false);
    try {
      const ok = await verifyIdentity();
      if (ok) {
        onUnlock();
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setVerifying(false);
    }
  };

  // Auto-trigger as soon as biometrics are confirmed available
  useEffect(() => {
    if (!available) return;
    const t = setTimeout(handleUnlock, 300);
    return () => clearTimeout(t);
  }, [available]);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'You will need to sign in again to use TopTennis.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try { await onSignOut(); } finally { setSigningOut(false); }
          },
        },
      ],
    );
  };

  const iconName = biometricType === 'faceid' ? 'scan' : 'finger-print';

  return (
    <LinearGradient
      colors={[Palette.dark900, Palette.dark800]}
      style={StyleSheet.absoluteFill}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoLetter}>T</Text>
          </View>
          <Text style={styles.logoName}>opTennis</Text>
        </View>

        {/* Lock content */}
        <View style={styles.center}>
          <TouchableOpacity
            style={[styles.lockRing, failed && styles.lockRingFailed]}
            onPress={available ? handleUnlock : undefined}
            activeOpacity={available ? 0.7 : 1}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator size="large" color="rgba(255,255,255,0.6)" />
            ) : (
              <Ionicons
                name={failed ? iconName as any : 'lock-closed'}
                size={52}
                color={failed ? Palette.orange500 : 'rgba(255,255,255,0.18)'}
              />
            )}
          </TouchableOpacity>

          <Text style={styles.lockTitle}>{failed ? 'Try Again' : 'App Locked'}</Text>
          <Text style={styles.lockSub}>
            {verifying
              ? `Verifying with ${biometricLabel}…`
              : failed
              ? `Tap the icon or the button below to retry ${biometricLabel}`
              : 'Authenticate to continue where you left off'}
          </Text>

          {available ? (
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={handleUnlock}
              disabled={verifying}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Palette.orange500, Palette.orange700]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.unlockGrad}
              >
                {verifying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name={iconName as any} size={24} color="#fff" />
                    <Text style={styles.unlockText}>
                      {failed ? `Retry ${biometricLabel}` : `Unlock with ${biometricLabel}`}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.noBioCard}>
              <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.40)" />
              <Text style={styles.noBioText}>
                Biometrics unavailable.{'\n'}Sign out and sign in again to access the app.
              </Text>
            </View>
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={signingOut || verifying}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>
            {signingOut ? 'Signing out…' : 'Sign Out Instead'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xxxl,
  },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: {
    width: 42, height: 42, borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.black },
  logoName: { color: '#fff', fontSize: 28, fontWeight: FontWeight.black, letterSpacing: -0.5 },

  center: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xxxl,
    width: '100%',
  },

  lockRing: {
    width: 128, height: 128, borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  lockRingFailed: {
    borderColor: Palette.orange500,
    backgroundColor: 'rgba(249,115,22,0.08)',
  },

  lockTitle: {
    color: '#fff',
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    letterSpacing: -0.4,
  },
  lockSub: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },

  unlockBtn: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginTop: Spacing.lg,
    width: '100%',
  },
  unlockGrad: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  unlockText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },

  noBioCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  noBioText: {
    flex: 1,
    color: 'rgba(255,255,255,0.45)',
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  signOutBtn: { paddingVertical: Spacing.md },
  signOutText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
