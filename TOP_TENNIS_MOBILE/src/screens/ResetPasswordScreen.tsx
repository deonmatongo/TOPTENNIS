import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '@/theme/colors';

const getPasswordStrength = (pw: string) => {
  if (!pw) return { score: 0, label: '', color: Colors.border, suggestions: [] as string[] };
  let score = 0;
  const suggestions: string[] = [];
  if (pw.length >= 8) score++; else suggestions.push('At least 8 characters');
  if (/[A-Z]/.test(pw)) score++; else suggestions.push('Add uppercase letters');
  if (/[a-z]/.test(pw)) score++; else suggestions.push('Add lowercase letters');
  if (/[0-9]/.test(pw)) score++; else suggestions.push('Add numbers');
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++; else suggestions.push('Add special characters');
  if (pw.length >= 12) score = Math.min(score + 1, 5);
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const pwColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a', '#15803d'];
  return { score, label: labels[Math.min(score, 5)], color: pwColors[Math.min(score, 5)], suggestions };
};

export const ResetPasswordScreen: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pwStrength = getPasswordStrength(password);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string, hasError?: boolean) => [
    styles.input,
    focusedField === field && styles.inputFocused,
    hasError && styles.inputError,
  ];

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneContainer}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
          </View>
          <Text style={styles.doneTitle}>Password Updated!</Text>
          <Text style={styles.doneSub}>
            Your password has been changed successfully. You can now sign in with your new password.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="lock-open-outline" size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              Choose a strong password for your account.
            </Text>
          </View>

          <View style={styles.card}>
            {/* New Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>New Password *</Text>
              <View style={inputStyle('password', !!errors.password)}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Minimum 8 characters"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={v => { setPassword(v); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
              {password.length > 0 && (
                <View style={styles.strengthWrapper}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: i <= pwStrength.score ? pwStrength.color : Colors.borderLight },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
                  {pwStrength.suggestions.length > 0 && (
                    <Text style={styles.strengthHint}>{pwStrength.suggestions[0]}</Text>
                  )}
                </View>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Confirm Password *</Text>
              <View style={inputStyle('confirm', !!errors.confirmPassword)}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirm your new password"
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPassword}
                  onChangeText={v => { setConfirmPassword(v); if (errors.confirmPassword) setErrors(p => ({ ...p, confirmPassword: '' })); }}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                />
                <TouchableOpacity onPress={() => setShowConfirm(s => !s)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              {!!errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.submitText}>UPDATE PASSWORD</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.xl },

  header: { alignItems: 'center', marginBottom: Spacing.xl, paddingTop: Spacing.xl },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  inputWrapper: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text, marginBottom: Spacing.xs },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
    backgroundColor: Colors.background,
  },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.surface },
  inputError: { borderColor: '#ef4444' },
  icon: { marginRight: Spacing.sm },
  textInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  eyeBtn: { padding: Spacing.xs },

  fieldError: { fontSize: FontSize.xs, color: '#ef4444', marginTop: 4 },

  strengthWrapper: { marginTop: Spacing.sm },
  strengthBars: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  strengthHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: Colors.textInverse, fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  doneIcon: { marginBottom: Spacing.xl },
  doneTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md, textAlign: 'center' },
  doneSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
});
