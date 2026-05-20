import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { captureError } from '@/services/sentry';

interface Opponent {
  user_id: string;
  first_name: string;
  last_name: string;
  skill_level: number;
  wins: number;
  losses: number;
  matches_completed: number;
}

interface Props {
  visible: boolean;
  divisionId: string | undefined;
  initialOpponentId?: string;
  onClose: () => void;
  onSchedule: (params: {
    divisionId: string;
    opponentUserId: string;
    date: string;
    time: string;
    timezone: string;
    courtLocation: string;
    message?: string;
  }) => Promise<void>;
}

const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];
const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00',
];

export const ScheduleLeagueMatchModal: React.FC<Props> = ({ visible, divisionId, initialOpponentId, onClose, onSchedule }) => {
  const { user } = useAuth();
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loadingOpponents, setLoadingOpponents] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<Opponent | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [courtLocation, setCourtLocation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'opponent' | 'details'>('opponent');

  useEffect(() => {
    if (visible && divisionId && user) {
      fetchOpponents();
    } else if (!visible) {
      setSelectedOpponent(null);
      setDate('');
      setTime('');
      setTimezone('America/New_York');
      setCourtLocation('');
      setMessage('');
      setStep('opponent');
    }
  }, [visible, divisionId, user]);

  // Auto-select opponent and skip to details when initialOpponentId is provided
  useEffect(() => {
    if (!initialOpponentId || opponents.length === 0 || !visible) return;
    const found = opponents.find(o => o.user_id === initialOpponentId);
    if (found) {
      setSelectedOpponent(found);
      setStep('details');
    }
  }, [opponents, initialOpponentId, visible]);

  const fetchOpponents = async () => {
    if (!divisionId || !user) return;
    setLoadingOpponents(true);
    try {
      const { data, error } = await supabase.rpc('get_division_opponents', {
        p_user_id: user.id,
        p_division_id: divisionId,
      });
      if (error) throw error;
      setOpponents(data || []);
    } catch (e: any) {
      captureError(e);
      if (__DEV__) console.error('[ScheduleLeagueMatchModal] fetch opponents:', e);
    } finally {
      setLoadingOpponents(false);
    }
  };

  const reset = () => {
    setSelectedOpponent(null);
    setDate('');
    setTime('');
    setTimezone('America/New_York');
    setCourtLocation('');
    setMessage('');
    setStep('opponent');
  };

  const handleClose = () => { reset(); onClose(); };

  const validateDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

  const handleSchedule = async () => {
    if (!selectedOpponent || !divisionId) return;
    if (!validateDate(date)) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (!time) {
      Alert.alert('Missing Time', 'Please select a time slot.');
      return;
    }
    if (!courtLocation.trim()) {
      Alert.alert('Missing Location', 'Please enter a court location.');
      return;
    }
    setLoading(true);
    try {
      await onSchedule({
        divisionId,
        opponentUserId: selectedOpponent.user_id,
        date,
        time,
        timezone,
        courtLocation: courtLocation.trim(),
        message: message.trim() || undefined,
      });
      Alert.alert(
        'Match Scheduled!',
        `A match invite has been sent to ${selectedOpponent.first_name} ${selectedOpponent.last_name}. The match will be confirmed once they accept.`
      );
      handleClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to schedule match. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderOpponentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>Select Your Opponent</Text>
      <Text style={styles.stepSub}>Choose a player from your division to schedule a match with.</Text>
      {loadingOpponents ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />
      ) : opponents.length === 0 ? (
        <View style={styles.emptyOpponents}>
          <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No opponents available</Text>
          <Text style={styles.emptySub}>All division members have been scheduled or no other players are in your division yet.</Text>
        </View>
      ) : (
        opponents.map(opp => (
          <TouchableOpacity
            key={opp.user_id}
            style={[styles.opponentCard, selectedOpponent?.user_id === opp.user_id && styles.opponentCardSelected]}
            onPress={() => setSelectedOpponent(opp)}
          >
            <View style={styles.opponentAvatar}>
              <Text style={styles.opponentAvatarText}>
                {opp.first_name[0]}{opp.last_name[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.opponentName, selectedOpponent?.user_id === opp.user_id && { color: Colors.primary }]}>
                {opp.first_name} {opp.last_name}
              </Text>
              <Text style={styles.opponentStats}>
                Level {opp.skill_level}  •  {opp.wins}W – {opp.losses}L  •  {opp.matches_completed} played
              </Text>
            </View>
            {selectedOpponent?.user_id === opp.user_id && (
              <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderDetailsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepHeading}>Match Details</Text>
      <Text style={styles.stepSub}>
        Scheduling with <Text style={{ fontWeight: FontWeight.bold, color: Colors.text }}>
          {selectedOpponent?.first_name} {selectedOpponent?.last_name}
        </Text>
      </Text>

      {/* Date */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Date <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.fieldInput}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textMuted}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Text style={styles.fieldHint}>e.g. 2025-07-20</Text>
      </View>

      {/* Time */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Time <Text style={styles.required}>*</Text></Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
          {TIME_SLOTS.map(slot => (
            <TouchableOpacity
              key={slot}
              style={[styles.timeChip, time === slot && styles.timeChipSelected]}
              onPress={() => setTime(slot)}
            >
              <Text style={[styles.timeChipText, time === slot && styles.timeChipTextSelected]}>
                {slot}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Timezone */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Timezone</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
          {TIMEZONES.map(tz => (
            <TouchableOpacity
              key={tz}
              style={[styles.timeChip, timezone === tz && styles.timeChipSelected]}
              onPress={() => setTimezone(tz)}
            >
              <Text style={[styles.timeChipText, timezone === tz && styles.timeChipTextSelected]}>
                {tz.split('/')[1].replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Court Location */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Court Location <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.fieldInput}
          value={courtLocation}
          onChangeText={setCourtLocation}
          placeholder="e.g. Riverside Tennis Club, Court 3"
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Message */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Message (Optional)</Text>
        <TextInput
          style={[styles.fieldInput, styles.fieldInputMulti]}
          value={message}
          onChangeText={setMessage}
          placeholder="Add a note for your opponent..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Ionicons name="calendar" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Schedule League Match</Text>
              <Text style={styles.headerSub}>Step {step === 'opponent' ? '1' : '2'} of 2</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View style={styles.stepBar}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepLine, step === 'details' && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === 'details' && styles.stepDotActive]} />
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {step === 'opponent' ? renderOpponentStep() : renderDetailsStep()}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {step === 'details' && (
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('opponent')} disabled={loading}>
              <Ionicons name="arrow-back" size={18} color={Colors.text} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          {step === 'opponent' ? (
            <TouchableOpacity
              style={[styles.nextBtn, !selectedOpponent && styles.nextBtnDisabled]}
              onPress={() => selectedOpponent && setStep('details')}
              disabled={!selectedOpponent}
            >
              <Text style={styles.nextBtnText}>Next: Set Details</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, loading && styles.nextBtnDisabled]}
              onPress={handleSchedule}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="calendar-outline" size={18} color="#fff" /><Text style={styles.nextBtnText}>Send Invite</Text></>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { padding: Spacing.xs },

  stepBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.borderLight },
  stepDotActive: { backgroundColor: Colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.borderLight, marginHorizontal: Spacing.sm },
  stepLineActive: { backgroundColor: Colors.primary },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.lg },
  stepContent: { gap: Spacing.md },
  stepHeading: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  stepSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  emptyOpponents: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  opponentCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  opponentCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  opponentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  opponentAvatarText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
  opponentName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  opponentStats: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  fieldInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.surface },
  fieldInputMulti: { height: 80 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted },
  required: { color: Colors.error },

  timeScroll: { marginTop: 4 },
  timeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, marginRight: Spacing.sm, backgroundColor: Colors.surface },
  timeChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  timeChipTextSelected: { color: '#fff', fontWeight: FontWeight.semibold },

  footer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  backBtnText: { fontSize: FontSize.md, color: Colors.text, fontWeight: FontWeight.medium },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: FontSize.md, color: '#fff', fontWeight: FontWeight.semibold },
});
