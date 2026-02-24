import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
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
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a', '#15803d'];
  return { score, label: labels[Math.min(score, 5)], color: colors[Math.min(score, 5)], suggestions };
};

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

function GoogleIcon() {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#4285F4', lineHeight: 18 }}>G</Text>
    </View>
  );
}

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Google Sign-In Failed', e?.message || 'Could not sign in with Google. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const pwStrength = mode === 'signup' ? getPasswordStrength(password) : null;

  const clearError = (field: string) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateSignup = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim()) e.lastName = 'Last name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    const digits = phone.replace(/\D/g, '');
    if (!phone.trim()) e.phone = 'Phone number is required';
    else if (digits.length !== 10) e.phone = 'Enter a valid 10-digit phone number';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!agreeToTerms) e.agreeToTerms = 'You must agree to the Terms and Privacy Policy';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [firstName, lastName, email, phone, password, confirmPassword, agreeToTerms]);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please enter your email address above, then tap Forgot Password.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'toptennis://reset-password',
      });
      if (error) throw error;
      Alert.alert('Check your email', `A password reset link has been sent to ${email.trim()}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (mode === 'signup') {
      if (!validateSignup()) return;
      setLoading(true);
      try {
        await signUp(email.trim(), password, firstName.trim(), lastName.trim(), phone);
      } catch (e: any) {
        Alert.alert('Registration Failed', e?.message || 'Could not create account. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!email.trim() || !password.trim()) {
        Alert.alert('Missing fields', 'Please enter your email and password.');
        return;
      }
      setLoading(true);
      try {
        await signIn(email.trim(), password);
      } catch (e: any) {
        Alert.alert('Sign In Failed', e?.message || 'Incorrect email or password.');
      } finally {
        setLoading(false);
      }
    }
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setAgreeToTerms(false);
  };

  const inputStyle = (field: string, hasError?: boolean) => [
    styles.input,
    focusedField === field && styles.inputFocused,
    hasError && styles.inputError,
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            style={styles.header}
          >
            <View style={styles.logoCircle}>
              <Ionicons name="tennisball" size={36} color={Colors.textInverse} />
            </View>
            <Text style={styles.appName}>TOP TENNIS</Text>
            <Text style={styles.tagline}>Find your perfect match</Text>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Tab Toggle */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, mode === 'signin' && styles.tabActive]}
                onPress={() => switchMode('signin')}
              >
                <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'signup' && styles.tabActive]}
                onPress={() => switchMode('signup')}
              >
                <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {/* ── SIGNUP-ONLY FIELDS ── */}
            {mode === 'signup' && (
              <>
                {/* First + Last Name */}
                <View style={styles.row}>
                  <View style={[styles.inputWrapper, { flex: 1, marginRight: Spacing.sm }]}>
                    <Text style={styles.label}>First Name *</Text>
                    <View style={inputStyle('firstName', !!errors.firstName)}>
                      <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={styles.icon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="John"
                        placeholderTextColor={Colors.textMuted}
                        value={firstName}
                        onChangeText={v => { setFirstName(v); clearError('firstName'); }}
                        onFocus={() => setFocusedField('firstName')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="words"
                        autoComplete="given-name"
                      />
                    </View>
                    {!!errors.firstName && <Text style={styles.fieldError}>{errors.firstName}</Text>}
                  </View>
                  <View style={[styles.inputWrapper, { flex: 1 }]}>
                    <Text style={styles.label}>Last Name *</Text>
                    <View style={inputStyle('lastName', !!errors.lastName)}>
                      <Ionicons name="person-outline" size={16} color={Colors.textMuted} style={styles.icon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Doe"
                        placeholderTextColor={Colors.textMuted}
                        value={lastName}
                        onChangeText={v => { setLastName(v); clearError('lastName'); }}
                        onFocus={() => setFocusedField('lastName')}
                        onBlur={() => setFocusedField(null)}
                        autoCapitalize="words"
                        autoComplete="family-name"
                      />
                    </View>
                    {!!errors.lastName && <Text style={styles.fieldError}>{errors.lastName}</Text>}
                  </View>
                </View>

                {/* Phone */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Phone Number *</Text>
                  <View style={inputStyle('phone', !!errors.phone)}>
                    <Ionicons name="call-outline" size={16} color={Colors.textMuted} style={styles.icon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="(555) 123-4567"
                      placeholderTextColor={Colors.textMuted}
                      value={phone}
                      onChangeText={v => { setPhone(formatPhone(v)); clearError('phone'); }}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                    />
                  </View>
                  {!!errors.phone && <Text style={styles.fieldError}>{errors.phone}</Text>}
                </View>
              </>
            )}

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email Address *</Text>
              <View style={inputStyle('email', !!errors.email)}>
                <Ionicons name="mail-outline" size={16} color={Colors.textMuted} style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={v => { setEmail(v); clearError('email'); }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
              {!!errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{mode === 'signup' ? 'Create your Password *' : 'Password'}</Text>
              <View style={inputStyle('password', !!errors.password)}>
                <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••'}
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={v => { setPassword(v); clearError('password'); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              {!!errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
              {/* Password strength (signup only) */}
              {mode === 'signup' && password.length > 0 && pwStrength && (
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

            {/* Confirm Password (signup only) */}
            {mode === 'signup' && (
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>Confirm Password *</Text>
                <View style={inputStyle('confirmPassword', !!errors.confirmPassword)}>
                  <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} style={styles.icon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Confirm your password"
                    placeholderTextColor={Colors.textMuted}
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword'); }}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="new-password"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(s => !s)} style={styles.eyeBtn}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {!!errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}
              </View>
            )}

            {/* Terms & Conditions (signup only) */}
            {mode === 'signup' && (
              <View style={styles.termsRow}>
                <TouchableOpacity
                  style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}
                  onPress={() => { setAgreeToTerms(v => !v); clearError('agreeToTerms'); }}
                  activeOpacity={0.7}
                >
                  {agreeToTerms && <Ionicons name="checkmark" size={14} color={Colors.textInverse} />}
                </TouchableOpacity>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink}>Terms and Conditions</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </View>
            )}
            {!!errors.agreeToTerms && mode === 'signup' && (
              <Text style={[styles.fieldError, { marginTop: -Spacing.sm, marginBottom: Spacing.sm }]}>{errors.agreeToTerms}</Text>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, (loading || googleLoading) && styles.submitBtnDisabled]}
              onPress={handleAuth}
              disabled={loading || googleLoading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={[styles.googleBtn, (loading || googleLoading) && styles.submitBtnDisabled]}
              onPress={handleGoogleAuth}
              disabled={loading || googleLoading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <>
                  <GoogleIcon />
                  <Text style={styles.googleText}>
                    {mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Forgot Password (sign-in only) */}
            {mode === 'signin' && (
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Footer */}
            <Text style={styles.footerText}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.footerLink} onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },

  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl + 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textInverse,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.8)',
    marginTop: Spacing.xs,
  },

  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
  },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabActive: { backgroundColor: Colors.surface, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2 },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  tabTextActive: { color: Colors.text, fontWeight: FontWeight.semibold },

  row: { flexDirection: 'row' },
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

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  termsLink: { color: Colors.primary, fontWeight: FontWeight.semibold },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: Colors.textInverse, fontSize: FontSize.lg, fontWeight: FontWeight.bold },

  footerText: { textAlign: 'center', fontSize: FontSize.sm, color: Colors.textSecondary },
  footerLink: { color: Colors.primary, fontWeight: FontWeight.semibold },

  forgotBtn: { alignItems: 'center', paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  forgotText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  dividerText: { marginHorizontal: Spacing.md, fontSize: FontSize.sm, color: Colors.textMuted },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  googleText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
});
