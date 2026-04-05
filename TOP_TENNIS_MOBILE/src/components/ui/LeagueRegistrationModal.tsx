import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { supabase } from '@/services/supabase';

type Step = 'start' | 'validation' | 'disclaimer';

interface League {
  id: string;
  name: string;
  description?: string;
  prize?: string;
  privacy?: 'private' | 'friends_only' | 'public';
}

interface Props {
  visible: boolean;
  league: League | null;
  onClose: () => void;
  onRegister: (leagueId: string) => Promise<void>;
}

const PREFERENCES = [
  {
    key: 'skillLevel',
    label: 'Skill Level',
    editable: false,
    description: 'Your tennis skill level cannot be changed after registration',
  },
  {
    key: 'competitiveness',
    label: 'Competitiveness',
    editable: true,
    description: 'How competitive you prefer your matches to be',
    options: [
      { value: 'fun', label: 'Just for fun' },
      { value: 'casual', label: 'Casual but like to win' },
      { value: 'competitive', label: 'Very competitive' },
    ],
  },
  {
    key: 'genderPreference',
    label: 'Gender Preference',
    editable: true,
    description: 'Your preferred opponent gender for matches',
    options: [
      { value: 'no-preference', label: 'No preference' },
      { value: 'same-gender', label: 'Same gender' },
      { value: 'mixed', label: 'Mixed matches' },
    ],
  },
  {
    key: 'ageRange',
    label: 'Age Range',
    editable: false,
    description: 'Your age range cannot be changed after registration',
  },
];

export const LeagueRegistrationModal: React.FC<Props> = ({
  visible, league, onClose, onRegister,
}) => {
  const { player } = usePlayerProfile();
  const [step, setStep] = useState<Step>('start');
  const [validated, setValidated] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<Record<string, string>>({});
  const [updatedValues, setUpdatedValues] = useState<Record<string, string>>({});
  const [registering, setRegistering] = useState(false);

  const reset = () => {
    setStep('start');
    setValidated({});
    setEditing(null);
    setTempValues({});
    setUpdatedValues({});
    setRegistering(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const getPreferenceValue = (key: string): string => {
    if (updatedValues[key]) return updatedValues[key];
    if (!player) return 'Not set';
    switch (key) {
      case 'skillLevel': return player.usta_rating || `Level ${player.skill_level || 'Not set'}`;
      case 'competitiveness': return player.competitiveness || 'Not set';
      case 'genderPreference': return player.gender_preference || 'Not set';
      case 'ageRange': return player.age_range || 'Not set';
      default: return 'Not set';
    }
  };

  const allValidated = PREFERENCES.every(p => validated[p.key]);

  const handleSaveEdit = async (key: string) => {
    const value = tempValues[key];
    if (!value) return;
    // Persist to Supabase
    if (player) {
      const fieldMap: Record<string, string> = {
        competitiveness: 'competitiveness',
        genderPreference: 'gender_preference',
      };
      const dbField = fieldMap[key];
      if (dbField) {
        await supabase.from('players').update({ [dbField]: value }).eq('id', player.id);
      }
    }
    setUpdatedValues(prev => ({ ...prev, [key]: value }));
    setEditing(null);
    setTempValues({});
  };

  const handleFinalRegister = async () => {
    if (!league) return;
    setRegistering(true);
    try {
      await onRegister(league.id);
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert('Registration Failed', e?.message || 'Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  if (!league) return null;

  const renderStep = () => {
    switch (step) {
      case 'start':
        return (
          <View style={styles.stepWrap}>
            <View style={styles.iconRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="people" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.stepTitle}>Register for {league.name}</Text>
              {(league.privacy === 'private' || !league.privacy) && (
                <View style={styles.privacyRow}>
                  <Ionicons name="lock-closed-outline" size={12} color="#6b7280" />
                  <Text style={styles.privacyText}>Private league</Text>
                </View>
              )}
              {league.privacy === 'friends_only' && (
                <View style={[styles.privacyRow, styles.privacyRowFriends]}>
                  <Ionicons name="people-outline" size={12} color="#6d28d9" />
                  <Text style={[styles.privacyText, { color: '#6d28d9' }]}>Friends Only</Text>
                </View>
              )}
              {league.prize && (
                <Text style={styles.feeText}>
                  Registration fee: <Text style={styles.feeAmount}>{league.prize}</Text>
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Registration Start</Text>
              <Text style={styles.cardDesc}>
                Do you want to register for this league using the criteria saved in your profile?
              </Text>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, !player && styles.btnDisabled]}
                  onPress={() => player ? setStep('validation') : Alert.alert('Profile Required', 'Please complete your player profile first.')}
                >
                  <Text style={styles.btnText}>Yes, use my profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnOutline]}
                  onPress={() => {
                    handleClose();
                    Alert.alert('Update Profile', 'Please update your profile preferences and come back to register.');
                  }}
                >
                  <Text style={styles.btnOutlineText}>No, update profile first</Text>
                </TouchableOpacity>
              </View>
              {!player && (
                <Text style={styles.warningText}>Please complete your player profile first.</Text>
              )}
            </View>
          </View>
        );

      case 'validation':
        return (
          <View style={styles.stepWrap}>
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
              </View>
              <Text style={styles.stepTitle}>Validate Your Profile Preferences</Text>
              <Text style={styles.stepSub}>
                Review and confirm each preference. You can edit competitiveness and gender preference.
              </Text>
            </View>

            {PREFERENCES.map(pref => {
              const value = getPreferenceValue(pref.key);
              const isChecked = validated[pref.key] || false;
              const isEditing = editing === pref.key;

              return (
                <View key={pref.key} style={styles.prefCard}>
                  <View style={styles.prefHeader}>
                    <TouchableOpacity
                      style={styles.checkRow}
                      onPress={() => setValidated(prev => ({ ...prev, [pref.key]: !prev[pref.key] }))}
                    >
                      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                        {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <View style={styles.prefLabelWrap}>
                        <View style={styles.prefLabelRow}>
                          <Text style={styles.prefLabel}>{pref.label}</Text>
                          {!pref.editable && (
                            <View style={styles.fixedBadge}>
                              <Text style={styles.fixedBadgeText}>Fixed</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.prefDesc}>{pref.description}</Text>
                      </View>
                    </TouchableOpacity>
                    {pref.editable && !isEditing && (
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => { setEditing(pref.key); setTempValues({ [pref.key]: value }); }}
                      >
                        <Ionicons name="pencil" size={14} color={Colors.primary} />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {isEditing && pref.options ? (
                    <View style={styles.editWrap}>
                      {pref.options.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={styles.radioRow}
                          onPress={() => setTempValues({ [pref.key]: opt.value })}
                        >
                          <View style={[styles.radio, tempValues[pref.key] === opt.value && styles.radioSelected]}>
                            {tempValues[pref.key] === opt.value && <View style={styles.radioDot} />}
                          </View>
                          <Text style={styles.radioLabel}>{opt.label}</Text>
                        </TouchableOpacity>
                      ))}
                      <View style={styles.editActions}>
                        <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveEdit(pref.key)}>
                          <Text style={styles.saveBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(null); setTempValues({}); }}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.valueWrap}>
                      <Text style={styles.valueText}>{value}</Text>
                    </View>
                  )}
                </View>
              );
            })}

            <View style={styles.amberBanner}>
              <Ionicons name="information-circle" size={18} color="#d97706" />
              <Text style={styles.amberText}>
                Your skill level rating cannot be changed once set. All other preferences can be updated.
              </Text>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={() => setStep('start')}>
                <Text style={styles.btnOutlineText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { flex: 1 }, !allValidated && styles.btnDisabled]}
                onPress={() => {
                  if (!allValidated) {
                    Alert.alert('Incomplete', 'Please check all 4 preferences before continuing.');
                    return;
                  }
                  setStep('disclaimer');
                }}
              >
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'disclaimer':
        return (
          <View style={styles.stepWrap}>
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="warning" size={32} color="#d97706" />
              </View>
              <Text style={styles.stepTitle}>Matchmaking Disclaimer</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>AI-Powered Division Placement</Text>
              <View style={styles.amberBanner}>
                <Text style={styles.amberText}>
                  You will be automatically placed in a division with 5-7 players who match your skill level and preferences. Our AI system creates balanced divisions, but exact matches aren't always possible depending on available players.
                </Text>
              </View>
              <Text style={styles.cardSubTitle}>Division Placement System:</Text>
              {[
                'You will be placed in a division of 5-7 players with similar preferences',
                'Each player must complete at least 5 matches per season',
                'You can view and schedule with other division members\' calendars',
                'Only top-performing players advance to playoffs',
                'Division placement is based on your validated profile preferences',
              ].map((item, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
              <Text style={styles.proceedQuestion}>Do you wish to proceed with the registration?</Text>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={() => setStep('validation')} disabled={registering}>
                <Text style={styles.btnOutlineText}>Back to Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={handleFinalRegister} disabled={registering}>
                {registering
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnText}>Yes, Register Me</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  const stepLabels = ['Start', 'Validate', 'Confirm'];
  const stepIndex = step === 'start' ? 0 : step === 'validation' ? 1 : 2;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>League Registration</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {stepLabels.map((label, i) => (
            <React.Fragment key={label}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}>
                  {i < stepIndex
                    ? <Ionicons name="checkmark" size={12} color="#fff" />
                    : <Text style={[styles.stepDotText, i <= stepIndex && styles.stepDotTextActive]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelActive]}>{label}</Text>
              </View>
              {i < stepLabels.length - 1 && (
                <View style={[styles.stepLine, i < stepIndex && styles.stepLineActive]} />
              )}
            </React.Fragment>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {renderStep()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  closeBtn: { padding: 4 },

  stepIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotText: { fontSize: 12, fontWeight: FontWeight.bold, color: Colors.textMuted },
  stepDotTextActive: { color: '#fff' },
  stepLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.medium },
  stepLabelActive: { color: Colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.borderLight, marginBottom: 14 },
  stepLineActive: { backgroundColor: Colors.primary },

  scrollContent: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  stepWrap: { gap: Spacing.lg },

  iconRow: { alignItems: 'center', gap: Spacing.sm },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, textAlign: 'center' },
  stepSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  privacyRowFriends: { backgroundColor: '#ede9fe' },
  privacyText: { fontSize: FontSize.xs, color: '#6b7280', fontWeight: FontWeight.semibold },
  feeText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
  feeAmount: { color: Colors.success, fontWeight: FontWeight.bold },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  cardSubTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, marginTop: Spacing.sm },

  btnRow: { gap: Spacing.sm },
  navRow: { flexDirection: 'row', gap: Spacing.sm },
  btn: { backgroundColor: Colors.primary, paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.border },
  btnOutlineText: { color: Colors.text, fontWeight: FontWeight.semibold, fontSize: FontSize.md },
  warningText: { fontSize: FontSize.sm, color: Colors.warning, textAlign: 'center' },

  prefCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  prefHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  prefLabelWrap: { flex: 1, gap: 2 },
  prefLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prefLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  prefDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  fixedBadge: { backgroundColor: Colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  fixedBadgeText: { fontSize: 10, color: Colors.textMuted },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  editBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
  valueWrap: { backgroundColor: Colors.background, borderRadius: Radius.sm, padding: Spacing.sm, marginLeft: 28 },
  valueText: { fontSize: FontSize.sm, color: Colors.text },

  editWrap: { marginLeft: 28, gap: Spacing.sm },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  radioLabel: { fontSize: FontSize.sm, color: Colors.text },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm },
  saveBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  cancelBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: FontSize.sm, color: Colors.text },

  amberBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', borderRadius: Radius.md, padding: Spacing.md },
  amberText: { flex: 1, fontSize: FontSize.sm, color: '#92400e', lineHeight: 20 },

  bulletRow: { flexDirection: 'row', gap: Spacing.sm },
  bullet: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  bulletText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  proceedQuestion: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text, marginTop: Spacing.sm },
});
