import React, { useState, useCallback, useEffect } from 'react';
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
import { Palette, Colors, FontSize, FontWeight, Radius, Spacing } from '@/theme/colors';
import { useBiometrics } from '@/hooks/useBiometrics';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Main Screen ────────────────────────────────────────────────────────────────

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
  const [biometricLoading, setBiometricLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { available, biometricType, biometricLabel, credentialsStored, authenticate, saveCredentials } = useBiometrics();

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

  const handleBiometricSignIn = useCallback(async () => {
    setBiometricLoading(true);
    try {
      const creds = await authenticate();
      if (!creds) return; // user cancelled or failed
      await signIn(creds.email, creds.password);
    } catch (e: any) {
      Alert.alert('Sign In Failed', e?.message || 'Could not sign in. Please use your password.');
    } finally {
      setBiometricLoading(false);
    }
  }, [authenticate, signIn]);

  // Auto-prompt biometrics on mount when credentials are stored
  useEffect(() => {
    if (available && credentialsStored && mode === 'signin') {
      const timer = setTimeout(() => handleBiometricSignIn(), 400);
      return () => clearTimeout(timer);
    }
  }, [available, credentialsStored]);

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
        // Offer biometrics setup after first successful password login
        if (available && !credentialsStored) {
          Alert.alert(
            `Enable ${biometricLabel}`,
            `Sign in faster next time using ${biometricLabel}.`,
            [
              { text: 'Not Now', style: 'cancel' },
              {
                text: `Enable ${biometricLabel}`,
                onPress: () => saveCredentials(email.trim(), password),
              },
            ],
          );
        }
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
    s.input,
    focusedField === field && s.inputFocused,
    hasError && s.inputError,
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <LinearGradient
            colors={[Palette.dark900, Palette.dark700]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            {/* Tennis ball watermark */}
            <View style={s.watermark}>
              <Ionicons name="tennisball" size={120} color="rgba(255,255,255,0.04)" />
            </View>
            <View style={s.wordmark}>
              <View style={s.wordmarkT}>
                <Text style={s.wordmarkTLetter}>T</Text>
              </View>
              <Text style={s.wordmarkRest}>opTennis</Text>
            </View>
            <Text style={s.tagline}>Your tennis community</Text>
          </LinearGradient>

          {/* ── Pill tab toggle ── */}
          <View style={s.modePill}>
            <TouchableOpacity
              style={[s.modePillBtn, mode === 'signin' && s.modePillBtnActive]}
              onPress={() => switchMode('signin')}
            >
              <Text style={[s.modePillTxt, mode === 'signin' && s.modePillTxtActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modePillBtn, mode === 'signup' && s.modePillBtnActive]}
              onPress={() => switchMode('signup')}
            >
              <Text style={[s.modePillTxt, mode === 'signup' && s.modePillTxtActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* ── Form ── */}
          <View style={s.form}>

            {/* Signup-only fields */}
            {mode === 'signup' && (
              <>
                <View style={s.nameRow}>
                  <View style={[s.fieldWrap, { flex: 1, marginRight: 8 }]}>
                    <Text style={s.label}>First Name</Text>
                    <View style={inputStyle('firstName', !!errors.firstName)}>
                      <TextInput
                        style={s.textInput}
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
                    {!!errors.firstName && <Text style={s.fieldErr}>{errors.firstName}</Text>}
                  </View>
                  <View style={[s.fieldWrap, { flex: 1 }]}>
                    <Text style={s.label}>Last Name</Text>
                    <View style={inputStyle('lastName', !!errors.lastName)}>
                      <TextInput
                        style={s.textInput}
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
                    {!!errors.lastName && <Text style={s.fieldErr}>{errors.lastName}</Text>}
                  </View>
                </View>

                <View style={s.fieldWrap}>
                  <Text style={s.label}>Phone Number</Text>
                  <View style={inputStyle('phone', !!errors.phone)}>
                    <Ionicons name="call-outline" size={16} color={focusedField === 'phone' ? Colors.primary : Colors.textMuted} style={s.icon} />
                    <TextInput
                      style={s.textInput}
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
                  {!!errors.phone && <Text style={s.fieldErr}>{errors.phone}</Text>}
                </View>
              </>
            )}

            {/* Email */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Email Address</Text>
              <View style={inputStyle('email', !!errors.email)}>
                <Ionicons name="mail-outline" size={16} color={focusedField === 'email' ? Colors.primary : Colors.textMuted} style={s.icon} />
                <TextInput
                  style={s.textInput}
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
              {!!errors.email && <Text style={s.fieldErr}>{errors.email}</Text>}
            </View>

            {/* Password */}
            <View style={s.fieldWrap}>
              <Text style={s.label}>Password</Text>
              <View style={inputStyle('password', !!errors.password)}>
                <Ionicons name="lock-closed-outline" size={16} color={focusedField === 'password' ? Colors.primary : Colors.textMuted} style={s.icon} />
                <TextInput
                  style={s.textInput}
                  placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••'}
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={v => { setPassword(v); clearError('password'); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              {!!errors.password && <Text style={s.fieldErr}>{errors.password}</Text>}
              {mode === 'signup' && password.length > 0 && pwStrength && (
                <View style={s.strengthWrap}>
                  <View style={s.strengthBars}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <View key={i} style={[s.strengthBar, { backgroundColor: i <= pwStrength.score ? pwStrength.color : Colors.borderLight }]} />
                    ))}
                  </View>
                  <Text style={[s.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
                  {pwStrength.suggestions.length > 0 && (
                    <Text style={s.strengthHint}>{pwStrength.suggestions[0]}</Text>
                  )}
                </View>
              )}
            </View>

            {/* Confirm password */}
            {mode === 'signup' && (
              <View style={s.fieldWrap}>
                <Text style={s.label}>Confirm Password</Text>
                <View style={inputStyle('confirmPassword', !!errors.confirmPassword)}>
                  <Ionicons name="lock-closed-outline" size={16} color={focusedField === 'confirmPassword' ? Colors.primary : Colors.textMuted} style={s.icon} />
                  <TextInput
                    style={s.textInput}
                    placeholder="Re-enter your password"
                    placeholderTextColor={Colors.textMuted}
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword'); }}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="new-password"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={s.eyeBtn}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {!!errors.confirmPassword && <Text style={s.fieldErr}>{errors.confirmPassword}</Text>}
              </View>
            )}

            {/* Terms */}
            {mode === 'signup' && (
              <>
                <TouchableOpacity
                  style={s.termsRow}
                  onPress={() => { setAgreeToTerms(v => !v); clearError('agreeToTerms'); }}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, agreeToTerms && s.checkboxOn]}>
                    {agreeToTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={s.termsTxt}>
                    I agree to the <Text style={s.termsLink}>Terms</Text> and <Text style={s.termsLink}>Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>
                {!!errors.agreeToTerms && <Text style={[s.fieldErr, { marginTop: -4 }]}>{errors.agreeToTerms}</Text>}
              </>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, (loading || googleLoading) && s.submitBtnDisabled]}
              onPress={handleAuth}
              disabled={loading || googleLoading}
              activeOpacity={0.87}
            >
              <LinearGradient
                colors={[Palette.orange500, Palette.orange700]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.submitGrad}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitTxt}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Forgot password */}
            {mode === 'signin' && (
              <TouchableOpacity style={s.forgotBtn} onPress={handleForgotPassword} disabled={loading}>
                <Text style={s.forgotTxt}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={s.divRow}>
              <View style={s.divLine} />
              <Text style={s.divTxt}>or</Text>
              <View style={s.divLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              style={[s.googleBtn, (loading || googleLoading) && s.submitBtnDisabled]}
              onPress={handleGoogleAuth}
              disabled={loading || googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading
                ? <ActivityIndicator color={Colors.text} />
                : (
                  <>
                    <View style={s.googleIcon}>
                      <Text style={s.googleIconTxt}>G</Text>
                    </View>
                    <Text style={s.googleTxt}>{mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}</Text>
                  </>
                )
              }
            </TouchableOpacity>

            {/* Biometric sign-in (only on sign-in mode when available + creds stored) */}
            {mode === 'signin' && available && credentialsStored && (
              <TouchableOpacity
                style={[s.biometricBtn, (loading || googleLoading || biometricLoading) && s.submitBtnDisabled]}
                onPress={handleBiometricSignIn}
                disabled={loading || googleLoading || biometricLoading}
                activeOpacity={0.85}
              >
                {biometricLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={biometricType === 'faceid' ? 'scan-outline' : 'finger-print-outline'}
                      size={22}
                      color={Colors.primary}
                    />
                    <Text style={s.biometricTxt}>Sign in with {biometricLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Switch mode */}
            <Text style={s.switchTxt}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={s.switchLink} onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                {mode === 'signin' ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  // ── Hero ──
  hero: { paddingTop: 56, paddingBottom: 40, alignItems: 'center', justifyContent: 'center', gap: 10, position: 'relative', overflow: 'hidden' },
  watermark: { position: 'absolute', bottom: -20, right: -20 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  wordmarkT: { width: 38, height: 38, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  wordmarkTLetter: { fontSize: 22, fontWeight: FontWeight.black, color: '#fff' },
  wordmarkRest: { fontSize: 28, fontWeight: FontWeight.black, color: '#fff', letterSpacing: -0.5 },
  tagline: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', fontWeight: FontWeight.medium },

  // ── Mode pill ──
  modePill: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.xl, backgroundColor: Colors.backgroundAlt, borderRadius: Radius.full, padding: 4, borderWidth: 1, borderColor: Colors.borderLight },
  modePillBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.full, alignItems: 'center' },
  modePillBtnActive: { backgroundColor: Colors.surface, ...{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 } },
  modePillTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textMuted },
  modePillTxtActive: { color: Colors.text },

  // ── Form ──
  form: { padding: Spacing.lg, gap: Spacing.md },
  nameRow: { flexDirection: 'row' },
  fieldWrap: { gap: 6 },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, minHeight: 50 },
  inputFocused: { borderColor: Colors.primary, borderWidth: 2 },
  inputError: { borderColor: Colors.error },
  icon: { marginRight: 8 },
  textInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 0 },
  eyeBtn: { padding: 4 },
  fieldErr: { fontSize: FontSize.xs, color: Colors.error, marginTop: -2 },

  // ── Password strength ──
  strengthWrap: { gap: 4 },
  strengthBars: { flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  strengthHint: { fontSize: FontSize.xs, color: Colors.textMuted },

  // ── Terms ──
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  termsLink: { color: Colors.primary, fontWeight: FontWeight.semibold },

  // ── Submit button ──
  submitBtn: { borderRadius: Radius.full, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.6 },
  submitGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff', letterSpacing: 0.3 },

  // ── Forgot ──
  forgotBtn: { alignItems: 'center' },
  forgotTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  // ── Divider ──
  divRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  divTxt: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },

  // ── Google ──
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, height: 52 },
  googleIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  googleIconTxt: { fontSize: 13, fontWeight: FontWeight.bold, color: '#4285F4', lineHeight: 17 },
  googleTxt: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },

  // ── Biometric ──
  biometricBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primaryLight, borderWidth: 1.5, borderColor: Colors.primaryMuted, borderRadius: Radius.full, height: 52 },
  biometricTxt: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.primary },

  // ── Switch mode ──
  switchTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  switchLink: { color: Colors.primary, fontWeight: FontWeight.bold },
});
