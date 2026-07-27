import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

const TOTAL_STEPS = 4;
const STEP_TITLES = ['Personal Information', 'Playing Preferences', 'Skill Level', 'Review & Submit'];
const USTA_RATINGS = ['2.5', '-3.0', '3.0', '-3.5', '3.5', '-4.0', '4.0', '-4.5', '4.5', '-5.0'];

interface Form {
  gender: string;
  age_range: string;
  age_competition_preference: string;
  travel_distance: string;
  city: string;
  zip_code: string;
  location: string;
  gender_preference: string;
  competitiveness: string;
  skill_level: string;
  usta_rating: string;
}

const LABEL_MAP: Record<string, string> = {
  male: 'Male', female: 'Female',
  '18-25': '18–25', '26-40': '26–40', '41-54': '41–54', '55-plus': '55+',
  'within-bracket': 'Within my age bracket', 'below-bracket': 'Below my age bracket',
  'no-preference': 'No preference', '0-5': 'Within 5 miles', '0-10': '0–10 miles',
  '0-20': '0–20 miles', '0-30': '0–30 miles', 'no-limit': "Doesn't matter",
  'same-gender': 'Prefer same gender',
  fun: 'Just for fun', casual: 'Casual but like to win', competitive: 'Very competitive',
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
};
const fmt = (v: string) => LABEL_MAP[v] || v;

function SelCard({ label, desc, icon, selected, onPress }: {
  label: string; desc?: string; icon: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.selCard, selected && styles.selCardActive]}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      activeOpacity={0.8}
    >
      <View style={[styles.selCardIcon, selected && styles.selCardIconActive]}>
        <Ionicons name={icon as any} size={20} color={selected ? Colors.primary : Colors.textSecondary} />
      </View>
      <View style={styles.selCardBody}>
        <Text style={[styles.selCardLabel, selected && styles.selCardLabelActive]}>{label}</Text>
        {desc ? <Text style={styles.selCardDesc}>{desc}</Text> : null}
      </View>
      {selected && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
    </TouchableOpacity>
  );
}

export const OnboardingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { user } = useAuth();
  const { createPlayerProfile } = usePlayerProfile();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<Form>({
    gender: '', age_range: '', age_competition_preference: '',
    travel_distance: '', city: '', zip_code: '', location: '',
    gender_preference: '', competitiveness: '',
    skill_level: '', usta_rating: '',
  });

  const set = (key: keyof Form, val: string) => setForm(f => ({ ...f, [key]: val }));

  const validateStep = (s: number): boolean => {
    switch (s) {
      case 1: return !!form.gender && !!form.age_range && !!form.age_competition_preference && !!form.travel_distance && !!form.city;
      case 2: return !!form.gender_preference && !!form.competitiveness;
      case 3: return !!form.skill_level;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!validateStep(step)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      Alert.alert('Required fields', 'Please complete all required fields before continuing.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const skillMap: Record<string, number> = { beginner: 3, intermediate: 6, advanced: 9 };
      const firstName = user?.user_metadata?.first_name || '';
      const lastName = user?.user_metadata?.last_name || '';
      const name = `${firstName} ${lastName}`.trim() || user?.email?.split('@')[0] || 'Player';
      await createPlayerProfile({
        name,
        email: user?.email || '',
        skill_level: skillMap[form.skill_level] || 5,
        age_range: form.age_range,
        age_competition_preference: form.age_competition_preference,
        travel_distance: form.travel_distance,
        gender_preference: form.gender_preference,
        competitiveness: form.competitiveness,
        usta_rating: form.usta_rating || undefined,
        gender: form.gender,
        location: form.location || form.city,
        city: form.city,
        zip_code: form.zip_code || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const progress = done ? 100 : step === TOTAL_STEPS ? 90 : ((step - 1) / TOTAL_STEPS) * 100;
  const progressSv = useSharedValue(progress);
  React.useEffect(() => {
    progressSv.value = withSpring(progress, { damping: 18, stiffness: 140 });
  }, [progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progressSv.value}%` as any }));

  // ── CELEBRATION ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.celebWrap}>
          <LinearGradient colors={Colors.gradientWarm} style={styles.celebGrad}>
            <Animated.View entering={ZoomIn.springify().damping(9).stiffness(160)} style={styles.celebBall}>
              <Ionicons name="trophy" size={64} color={Colors.primary} />
            </Animated.View>
            <Animated.Text entering={FadeInUp.delay(220).duration(500)} style={styles.celebEyebrow}>
              GAME · SET · MATCH
            </Animated.Text>
            <Animated.Text entering={FadeInUp.delay(320).duration(500)} style={styles.celebTitle}>
              You're On The Roster!
            </Animated.Text>
            <Animated.Text entering={FadeInUp.delay(440).duration(500)} style={styles.celebSub}>
              Your player profile is live.{'\n'}
              Set your availability and let's get you on court.
            </Animated.Text>
          </LinearGradient>
          <Animated.View entering={FadeInDown.delay(600).duration(450)}>
            <TouchableOpacity style={styles.celebBtn} onPress={onComplete}>
              <Ionicons name="tennisball" size={20} color="#fff" />
              <Text style={styles.celebBtnText}>Step On Court</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  const renderStep = () => {
    switch (step) {

      // ── STEP 1: Personal Information ────────────────────────────────────────
      case 1: return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Personal Information</Text>
          <Text style={styles.stepSub}>Help us match you with the right players.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Select Your Gender <Text style={styles.req}>*</Text></Text>
            <Text style={styles.fieldHint}>This helps us match you with the right players</Text>
            <View style={styles.twoCol}>
              {[{ value: 'male', label: 'Male', icon: 'person-outline' }, { value: 'female', label: 'Female', icon: 'person-outline' }].map(o => (
                <TouchableOpacity key={o.value} style={[styles.twoColCard, form.gender === o.value && styles.twoColCardActive]} onPress={() => set('gender', o.value)} activeOpacity={0.8}>
                  <Ionicons name={o.icon as any} size={24} color={form.gender === o.value ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.twoColLabel, form.gender === o.value && styles.twoColLabelActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Select Your Age Range <Text style={styles.req}>*</Text></Text>
            <View style={styles.fourCol}>
              {[{ value: '18-25', label: '18–25' }, { value: '26-40', label: '26–40' }, { value: '41-54', label: '41–54' }, { value: '55-plus', label: '55+' }].map(o => (
                <TouchableOpacity key={o.value} style={[styles.gridCard, form.age_range === o.value && styles.gridCardActive]}
                  onPress={() => { set('age_range', o.value); if (o.value === '18-25' && form.age_competition_preference === 'below-bracket') set('age_competition_preference', ''); }}
                  activeOpacity={0.8}>
                  <Text style={[styles.gridCardText, form.age_range === o.value && styles.gridCardTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {form.age_range !== '' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Competition Bracket <Text style={styles.req}>*</Text></Text>
              <View style={styles.infoBox}><Text style={styles.infoBoxText}>⚠️ Applies to Singles only. Players can go down up to 2 age brackets.</Text></View>
              {[
                { value: 'within-bracket', label: 'Within my age bracket', icon: 'people-outline', desc: 'Compete against players in the same age group' },
                ...(form.age_range !== '18-25' ? [{ value: 'below-bracket', label: 'Below my age bracket', icon: 'trending-down-outline', desc: 'Compete against younger players (up to 2 brackets down)' }] : []),
                { value: 'no-preference', label: 'No preference', icon: 'shuffle-outline', desc: 'Open to any age bracket' },
              ].map(o => <SelCard key={o.value} label={o.label} desc={o.desc} icon={o.icon} selected={form.age_competition_preference === o.value} onPress={() => set('age_competition_preference', o.value)} />)}
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Travel Distance <Text style={styles.req}>*</Text></Text>
            <Text style={styles.fieldHint}>How far are you willing to travel for a match?</Text>
            {[
              { value: '0-5', label: 'Within 5 miles', icon: 'walk-outline' },
              { value: '0-10', label: '0–10 miles', icon: 'bicycle-outline' },
              { value: '0-20', label: '0–20 miles', icon: 'car-outline' },
              { value: '0-30', label: '0–30 miles', icon: 'car-sport-outline' },
              { value: 'no-limit', label: "Doesn't matter", icon: 'globe-outline' },
            ].map(o => <SelCard key={o.value} label={o.label} icon={o.icon} selected={form.travel_distance === o.value} onPress={() => set('travel_distance', o.value)} />)}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>City <Text style={styles.req}>*</Text></Text>
            <TextInput style={styles.input} value={form.city} onChangeText={v => { set('city', v); set('location', v); }} placeholder="e.g. New York" placeholderTextColor={Colors.textMuted} autoCapitalize="words" />
            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>ZIP Code</Text>
            <TextInput style={styles.input} value={form.zip_code} onChangeText={v => set('zip_code', v)} placeholder="e.g. 10001" placeholderTextColor={Colors.textMuted} keyboardType="numeric" />
          </View>
        </View>
      );

      // ── STEP 2: Playing Preferences ─────────────────────────────────────────
      case 2: return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Playing Preferences</Text>
          <Text style={styles.stepSub}>Help us find the right matches for you.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Playing Preference <Text style={styles.req}>*</Text></Text>
            <Text style={styles.fieldHint}>Who would you prefer to play against? (Casual matches only)</Text>
            {[
              { value: 'same-gender', label: 'Prefer same gender', icon: 'person-outline', desc: 'More comfortable with same gender' },
              { value: 'no-preference', label: 'No preference', icon: 'people-outline', desc: 'Open to playing with anyone' },
            ].map(o => <SelCard key={o.value} label={o.label} desc={o.desc} icon={o.icon} selected={form.gender_preference === o.value} onPress={() => set('gender_preference', o.value)} />)}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Competitiveness Level <Text style={styles.req}>*</Text></Text>
            <Text style={styles.fieldHint}>This helps us match you with like-minded players</Text>
            {[
              { value: 'fun', label: 'Just for fun', icon: 'heart-outline', desc: 'Casual games, enjoying the sport' },
              { value: 'casual', label: 'Casual but like to win', icon: 'thumbs-up-outline', desc: 'Competitive spirit but relaxed atmosphere' },
              { value: 'competitive', label: 'Very competitive', icon: 'trophy-outline', desc: 'Serious matches, tournament-style play' },
            ].map(o => <SelCard key={o.value} label={o.label} desc={o.desc} icon={o.icon} selected={form.competitiveness === o.value} onPress={() => set('competitiveness', o.value)} />)}
          </View>
        </View>
      );

      // ── STEP 3: Skill Level ──────────────────────────────────────────────────
      case 3: return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Skill Level</Text>
          <Text style={styles.stepSub}>Be honest — this ensures fair and fun matches!</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Tennis Skill Level <Text style={styles.req}>*</Text></Text>
            {[
              { value: 'beginner', label: 'Beginner', icon: 'leaf-outline', desc: 'Less than 3 years of playing tennis' },
              { value: 'intermediate', label: 'Intermediate', icon: 'tennisball-outline', desc: '3 to 10 years of playing tennis' },
              { value: 'advanced', label: 'Advanced', icon: 'trophy-outline', desc: '+10 years of playing tennis' },
            ].map(o => <SelCard key={o.value} label={o.label} desc={o.desc} icon={o.icon} selected={form.skill_level === o.value} onPress={() => set('skill_level', o.value)} />)}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>USTA Rating <Text style={styles.optional}>(optional)</Text></Text>
            <Text style={styles.fieldHint}>If you have an official USTA rating, add it here for more precise matching</Text>
            <View style={styles.chipRow}>
              {USTA_RATINGS.map(r => (
                <TouchableOpacity key={r} style={[styles.chip, form.usta_rating === r && styles.chipActive]} onPress={() => set('usta_rating', form.usta_rating === r ? '' : r)} activeOpacity={0.8}>
                  <Text style={[styles.chipText, form.usta_rating === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );

      // ── STEP 4: Review & Submit ──────────────────────────────────────────────
      case 4: return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Review & Submit</Text>
          <Text style={styles.stepSub}>Please review your selections before submitting.</Text>

          {[
            { title: 'Personal Information', rows: [
              { label: 'Gender', value: fmt(form.gender) },
              { label: 'Age Range', value: fmt(form.age_range) },
              { label: 'Competition Bracket', value: fmt(form.age_competition_preference) },
              { label: 'Travel Distance', value: fmt(form.travel_distance) },
              { label: 'City', value: form.city },
              ...(form.zip_code ? [{ label: 'ZIP Code', value: form.zip_code }] : []),
            ]},
            { title: 'Playing Preferences', rows: [
              { label: 'Playing Preference', value: fmt(form.gender_preference) },
              { label: 'Competitiveness', value: fmt(form.competitiveness) },
            ]},
            { title: 'Skill Level', rows: [
              { label: 'Skill Level', value: fmt(form.skill_level) },
              { label: 'USTA Rating', value: form.usta_rating || 'Not provided' },
            ]},
          ].map(section => (
            <View key={section.title} style={styles.reviewCard}>
              <Text style={styles.reviewCardTitle}>{section.title}</Text>
              {section.rows.map(row => (
                <View key={row.label} style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>{row.label}</Text>
                  <Text style={styles.reviewValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.reviewNote}>
            <Text style={styles.reviewNoteText}>By submitting, you confirm that all information provided is accurate and complete.</Text>
          </View>
        </View>
      );

      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
        {/* Header: step indicator + progress */}
        <View style={styles.progressWrap}>
          <View style={styles.stepIndicatorRow}>
            {STEP_TITLES.map((_, i) => {
              const n = i + 1;
              const active = n === step;
              const done2 = n < step;
              return (
                <View key={n} style={styles.stepDot}>
                  <View style={[styles.stepDotCircle, active && styles.stepDotActive, done2 && styles.stepDotDone]}>
                    {done2
                      ? <Ionicons name="checkmark" size={12} color="#fff" />
                      : <Text style={[styles.stepDotNum, (active || done2) && styles.stepDotNumActive]}>{n}</Text>
                    }
                  </View>
                  {n < TOTAL_STEPS && <View style={[styles.stepDotLine, done2 && styles.stepDotLineDone]} />}
                </View>
              );
            })}
          </View>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
          <Text style={styles.progressText}>Step {step} of {TOTAL_STEPS} — {STEP_TITLES[step - 1]}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View key={step} entering={FadeInRight.springify().damping(19).stiffness(160)}>
            {renderStep()}
          </Animated.View>
        </ScrollView>

        {/* Bottom Buttons */}
        <View style={styles.bottomBar}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, !validateStep(step) && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={styles.nextBtnText}>{step === TOTAL_STEPS ? 'Create Profile' : 'Continue'}</Text>
                  <Ionicons name={step === TOTAL_STEPS ? 'trophy-outline' : 'chevron-forward'} size={20} color="#fff" />
                </>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  // ── Progress header ──────────────────────────────────────────────────────
  progressWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepIndicatorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  stepDot: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDotCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotNum: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textMuted },
  stepDotNumActive: { color: '#fff' },
  stepDotLine: { flex: 1, height: 2, backgroundColor: Colors.borderLight, marginHorizontal: 2 },
  stepDotLineDone: { backgroundColor: Colors.primary },
  progressBar: { height: 4, backgroundColor: Colors.borderLight, borderRadius: 2, marginBottom: 4 },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: { fontSize: FontSize.xs, color: Colors.textMuted },

  // ── Step content ─────────────────────────────────────────────────────────
  stepContent: { gap: Spacing.xl },
  stepTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text },
  stepSub: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginTop: -Spacing.sm },

  // ── Field groups ─────────────────────────────────────────────────────────
  fieldGroup: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  fieldHint: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18, marginTop: -2 },
  req: { color: Colors.error },
  optional: { color: Colors.textMuted, fontWeight: FontWeight.regular as any },

  // ── Two-col gender cards ──────────────────────────────────────────────────
  twoCol: { flexDirection: 'row', gap: Spacing.md },
  twoColCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: Spacing.lg, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surface },
  twoColCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  twoColLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  twoColLabelActive: { color: Colors.primaryDark },

  // ── Four-col age grid ─────────────────────────────────────────────────────
  fourCol: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridCard: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surface, minWidth: 72, alignItems: 'center' },
  gridCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  gridCardText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  gridCardTextActive: { color: Colors.primaryDark },

  // ── Selection cards ───────────────────────────────────────────────────────
  selCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.surface },
  selCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  selCardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  selCardIconActive: { backgroundColor: Colors.primaryLight },
  selCardBody: { flex: 1, gap: 2 },
  selCardLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  selCardLabelActive: { color: Colors.primaryDark },
  selCardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

  // ── Info box ──────────────────────────────────────────────────────────────
  infoBox: { backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '40' },
  infoBoxText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 18 },

  // ── Text input ────────────────────────────────────────────────────────────
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.surface },

  // ── USTA chips ────────────────────────────────────────────────────────────
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.primaryDark, fontWeight: FontWeight.semibold },

  // ── Review cards ──────────────────────────────────────────────────────────
  reviewCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: 2 },
  reviewCardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  reviewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  reviewValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1, textAlign: 'right' },
  reviewNote: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryMuted },
  reviewNoteText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  // ── Bottom bar ────────────────────────────────────────────────────────────
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface, gap: Spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.sm },
  backBtnText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.lg, gap: Spacing.sm },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },

  // ── Celebration screen ────────────────────────────────────────────────────
  celebWrap: { flex: 1, justifyContent: 'space-between' },
  celebGrad: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.lg },
  celebBall: {
    width: 128, height: 128, borderRadius: 64,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12,
  },
  celebEyebrow: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: 'rgba(255,255,255,0.75)', letterSpacing: 3 },
  celebTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: '#fff', textAlign: 'center' },
  celebSub: { fontSize: FontSize.lg, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 26 },
  celebBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, margin: Spacing.xl, borderRadius: Radius.md, paddingVertical: Spacing.lg },
  celebBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#fff' },
});
