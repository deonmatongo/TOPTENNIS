import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { format, addDays } from 'date-fns';

interface Props {
  visible: boolean;
  invite: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    court_location?: string;
    sender?: { first_name: string; last_name: string };
    receiver?: { first_name: string; last_name: string };
    sender_id: string;
    receiver_id: string;
  } | null;
  userId: string;
  onClose: () => void;
  onProposed: () => void;
}

const TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30',
];

const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
};

const nextDays = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = addDays(new Date(), i + 1);
    return { value: d.toISOString().split('T')[0], label: format(d, 'EEE, MMM d') };
  });

export const ProposeNewTimeModal: React.FC<Props> = ({ visible, invite, userId, onClose, onProposed }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStart, setSelectedStart] = useState('');
  const [selectedEnd, setSelectedEnd] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const days = nextDays(14);

  const opponentName = invite
    ? invite.sender_id === userId
      ? invite.receiver ? `${invite.receiver.first_name} ${invite.receiver.last_name}`.trim() : 'Opponent'
      : invite.sender ? `${invite.sender.first_name} ${invite.sender.last_name}`.trim() : 'Opponent'
    : 'Opponent';

  const handleStartSelect = (time: string) => {
    setSelectedStart(time);
    const idx = TIME_SLOTS.indexOf(time);
    if (idx >= 0 && idx + 2 < TIME_SLOTS.length) {
      setSelectedEnd(TIME_SLOTS[idx + 2]);
    }
  };

  const handleSubmit = async () => {
    if (!invite || !selectedDate || !selectedStart || !selectedEnd) {
      Alert.alert('Missing Info', 'Please select a date and time.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('match_invites')
        .update({
          proposed_date: selectedDate,
          proposed_start_time: selectedStart,
          proposed_end_time: selectedEnd,
          proposed_message: message.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invite.id);
      if (error) throw error;

      // Notify the other player
      const notifyUserId = invite.sender_id === userId ? invite.receiver_id : invite.sender_id;
      await supabase.from('notifications').insert({
        user_id: notifyUserId,
        type: 'match_rescheduled',
        title: 'New Time Proposed',
        message: `A new match time has been proposed: ${format(new Date(selectedDate), 'MMM d')} at ${fmtTime(selectedStart)}`,
        read: false,
        metadata: { match_id: invite.id },
      });

      onProposed();
      onClose();
      Alert.alert('Proposed!', `New time sent to ${opponentName}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to propose new time.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Propose New Time</Text>
              <Text style={styles.subtitle}>Reschedule with {opponentName}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Current match info */}
            {invite && (
              <View style={styles.currentCard}>
                <Text style={styles.currentLabel}>Current Schedule</Text>
                <View style={styles.currentRow}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.currentText}>
                    {format(new Date(invite.date), 'EEE, MMM d, yyyy')}
                  </Text>
                  <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.currentText}>{fmtTime(invite.start_time)}</Text>
                </View>
              </View>
            )}

            {/* Date picker */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>New Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
                {days.map(d => (
                  <TouchableOpacity
                    key={d.value}
                    style={[styles.dateChip, selectedDate === d.value && styles.dateChipActive]}
                    onPress={() => setSelectedDate(d.value)}
                  >
                    <Text style={[styles.dateChipText, selectedDate === d.value && styles.dateChipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Start time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Start Time</Text>
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.timeChip, selectedStart === t && styles.timeChipActive]}
                    onPress={() => handleStartSelect(t)}
                  >
                    <Text style={[styles.timeChipText, selectedStart === t && styles.timeChipTextActive]}>
                      {fmtTime(t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* End time */}
            {selectedStart && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>End Time</Text>
                <View style={styles.timeGrid}>
                  {TIME_SLOTS.filter(t => t > selectedStart).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.timeChip, selectedEnd === t && styles.timeChipActive]}
                      onPress={() => setSelectedEnd(t)}
                    >
                      <Text style={[styles.timeChipText, selectedEnd === t && styles.timeChipTextActive]}>
                        {fmtTime(t)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Optional message */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Message (optional)</Text>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a note for your opponent..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            {/* Summary */}
            {selectedDate && selectedStart && selectedEnd && (
              <View style={styles.summaryCard}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryTitle}>Proposed Time</Text>
                  <Text style={styles.summaryText}>
                    {format(new Date(selectedDate), 'EEEE, MMMM d')}  •  {fmtTime(selectedStart)} – {fmtTime(selectedEnd)}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Submit */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitBtn, (!selectedDate || !selectedStart || !selectedEnd || loading) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selectedDate || !selectedStart || !selectedEnd || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="send-outline" size={18} color="#fff" /><Text style={styles.submitBtnText}>Send Proposal</Text></>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  subtitle: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },

  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },

  currentCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs },
  currentLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  currentText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },

  dateRow: { gap: Spacing.sm, paddingVertical: 4 },
  dateChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  dateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dateChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  dateChipTextActive: { color: '#fff', fontWeight: FontWeight.semibold },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  timeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 7, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  timeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeChipText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  timeChipTextActive: { color: '#fff', fontWeight: FontWeight.semibold },

  messageInput: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, fontSize: FontSize.sm, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },

  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#f0fdf4', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: '#bbf7d0' },
  summaryTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: '#166534' },
  summaryText: { fontSize: FontSize.sm, color: '#15803d', fontWeight: FontWeight.medium, marginTop: 2 },

  footer: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: Radius.lg },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },
});
