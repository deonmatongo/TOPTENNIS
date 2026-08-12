import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

type Action = 'accept' | 'decline' | 'propose' | null;

const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00',
];

const getSkillLabel = (level?: number | null) => {
  if (!level) return 'Not rated';
  if (level >= 7) return 'Advanced';
  if (level >= 4) return 'Intermediate';
  return 'Beginner';
};

const getSkillColor = (level?: number | null) => {
  if (!level) return Colors.textMuted;
  if (level >= 8) return '#dc2626';
  if (level >= 6) return '#ea580c';
  if (level >= 4) return '#ca8a04';
  return Colors.success;
};

const getCompetitivenessLabel = (c?: string | null) => {
  switch (c) {
    case 'fun': return '🎾 Just for fun';
    case 'casual': return '😎 Casual but competitive';
    case 'competitive': return '🏆 Very competitive';
    default: return 'Not specified';
  }
};

interface Props {
  visible: boolean;
  invite: any | null;
  onClose: () => void;
  onAccept: (inviteId: string) => Promise<void>;
  onDecline: (inviteId: string) => Promise<void>;
  onProposeNewTime: (inviteId: string, date: string, startTime: string, endTime: string) => Promise<void>;
}

export const MatchInviteResponseModal: React.FC<Props> = ({
  visible, invite, onClose, onAccept, onDecline, onProposeNewTime,
}) => {
  const [action, setAction] = useState<Action>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedStart, setProposedStart] = useState('09:00');
  const [proposedEnd, setProposedEnd] = useState('10:30');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setAction(null);
    setProposedDate('');
    setProposedStart('09:00');
    setProposedEnd('10:30');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!invite) return;
    if (action === 'propose' && !proposedDate) {
      Alert.alert('Missing Date', 'Please enter a proposed date.');
      return;
    }
    setLoading(true);
    try {
      if (action === 'accept') await onAccept(invite.id);
      else if (action === 'decline') await onDecline(invite.id);
      else if (action === 'propose') await onProposeNewTime(invite.id, proposedDate, proposedStart, proposedEnd);
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!invite) return null;

  const sender = invite.sender || {};
  const totalMatches = (sender.wins || 0) + (sender.losses || 0);
  const winRate = totalMatches > 0 ? Math.round(((sender.wins || 0) / totalMatches) * 100) : 0;
  const senderName = `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'Opponent';
  const hasProposedTime = invite.proposed_date && invite.proposed_start_time;
  const isLeagueMatch = invite.is_league_match;

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Ionicons name="tennisball" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Match Invitation</Text>
              <Text style={styles.headerSub}>from {senderName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* League badge */}
          {isLeagueMatch && (
            <View style={styles.leagueBadgeRow}>
              <View style={styles.leagueBadge}>
                <Ionicons name="trophy-outline" size={13} color={Colors.primary} />
                <Text style={styles.leagueBadgeText}>League Match</Text>
              </View>
            </View>
          )}

          {/* Sender profile */}
          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(sender.first_name?.[0] || '?')}{(sender.last_name?.[0] || '')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{senderName}</Text>
                <View style={styles.profileBadges}>
                  <View style={[styles.skillBadge, { borderColor: getSkillColor(sender.skill_level) }]}>
                    <Text style={[styles.skillBadgeText, { color: getSkillColor(sender.skill_level) }]}>
                      {getSkillLabel(sender.skill_level)} • {sender.skill_level || '?'}/10
                    </Text>
                  </View>
                  {sender.usta_rating && (
                    <View style={styles.ustaBadge}>
                      <Text style={styles.ustaBadgeText}>USTA {sender.usta_rating}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.profileStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{sender.wins || 0}</Text>
                <Text style={styles.statLabel}>Wins</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{sender.losses || 0}</Text>
                <Text style={styles.statLabel}>Losses</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{winRate}%</Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </View>
            </View>
            <View style={styles.profileMeta}>
              <Text style={styles.profileMetaText}>Style: {getCompetitivenessLabel(sender.competitiveness)}</Text>
              {sender.city && <Text style={styles.profileMetaText}>📍 {sender.city}</Text>}
            </View>
          </View>

          {/* Match details */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Match Details</Text>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.detailText}>{formatDate(invite.date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.detailText}>{invite.start_time} – {invite.end_time}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.detailText}>{invite.court_location || 'No location set'}</Text>
            </View>
            {invite.message && (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>"{invite.message}"</Text>
              </View>
            )}
          </View>

          {/* Proposed time alert */}
          {hasProposedTime && (
            <View style={styles.proposedBanner}>
              <Ionicons name="time-outline" size={16} color="#ea580c" />
              <View style={{ flex: 1 }}>
                <Text style={styles.proposedTitle}>New Time Proposed</Text>
                <Text style={styles.proposedText}>
                  {formatDate(invite.proposed_date)} • {invite.proposed_start_time} – {invite.proposed_end_time}
                </Text>
              </View>
            </View>
          )}

          {/* Action selection */}
          {!action && (
            <View style={styles.actionSection}>
              <Text style={styles.actionSectionTitle}>Choose your response:</Text>
              <View style={styles.actionGrid}>
                <TouchableOpacity style={[styles.actionChoice, styles.actionAccept]} onPress={() => setAction('accept')}>
                  <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
                  <Text style={[styles.actionChoiceText, { color: Colors.success }]}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionChoice, styles.actionPropose]} onPress={() => setAction('propose')}>
                  <Ionicons name="time" size={28} color="#1d4ed8" />
                  <Text style={[styles.actionChoiceText, { color: '#1d4ed8' }]}>New Time</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionChoice, styles.actionDecline]} onPress={() => setAction('decline')}>
                  <Ionicons name="close-circle" size={28} color={Colors.error} />
                  <Text style={[styles.actionChoiceText, { color: Colors.error }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Confirm selected action */}
          {action === 'accept' && (
            <View style={styles.confirmCard}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <Text style={styles.confirmText}>You're about to <Text style={{ color: Colors.success, fontWeight: FontWeight.bold }}>accept</Text> this match invitation.</Text>
            </View>
          )}
          {action === 'decline' && (
            <View style={[styles.confirmCard, styles.confirmCardDecline]}>
              <Ionicons name="close-circle" size={24} color={Colors.error} />
              <Text style={styles.confirmText}>You're about to <Text style={{ color: Colors.error, fontWeight: FontWeight.bold }}>decline</Text> this match invitation.</Text>
            </View>
          )}

          {/* Propose new time form */}
          {action === 'propose' && (
            <View style={styles.proposeForm}>
              <Text style={styles.proposeFormTitle}>Propose a New Time</Text>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Date <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.fieldInput}
                  value={proposedDate}
                  onChangeText={setProposedDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Start Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {TIME_SLOTS.map(slot => (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.timeChip, proposedStart === slot && styles.timeChipSelected]}
                      onPress={() => setProposedStart(slot)}
                    >
                      <Text style={[styles.timeChipText, proposedStart === slot && styles.timeChipTextSelected]}>{slot}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>End Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {TIME_SLOTS.map(slot => (
                    <TouchableOpacity
                      key={slot}
                      style={[styles.timeChip, proposedEnd === slot && styles.timeChipSelected]}
                      onPress={() => setProposedEnd(slot)}
                    >
                      <Text style={[styles.timeChipText, proposedEnd === slot && styles.timeChipTextSelected]}>{slot}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {action && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.backBtn} onPress={reset} disabled={loading}>
              <Ionicons name="arrow-back" size={18} color={Colors.text} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                action === 'accept' && styles.submitBtnAccept,
                action === 'decline' && styles.submitBtnDecline,
                action === 'propose' && styles.submitBtnPropose,
                (loading || (action === 'propose' && !proposedDate)) && styles.btnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || (action === 'propose' && !proposedDate)}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.submitBtnText}>
                    {action === 'accept' ? 'Confirm Accept' : action === 'decline' ? 'Confirm Decline' : 'Send Proposal'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        )}
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
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { padding: Spacing.xs },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.lg, gap: Spacing.md },

  leagueBadgeRow: { flexDirection: 'row' },
  leagueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primaryMuted },
  leagueBadgeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },

  profileCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.lg },
  profileName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  profileBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 4 },
  skillBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1.5 },
  skillBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  ustaBadge: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  ustaBadgeText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  profileStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.borderLight },
  profileMeta: { gap: 4 },
  profileMetaText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  detailsCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  detailsTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailText: { fontSize: FontSize.sm, color: Colors.text },
  messageBox: { backgroundColor: Colors.background, borderRadius: Radius.sm, padding: Spacing.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  messageText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },

  proposedBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: Radius.md, padding: Spacing.md },
  proposedTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#9a3412' },
  proposedText: { fontSize: FontSize.xs, color: '#c2410c', marginTop: 2 },

  actionSection: { gap: Spacing.sm },
  actionSectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  actionGrid: { flexDirection: 'row', gap: Spacing.sm },
  actionChoice: { flex: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1.5 },
  actionAccept: { borderColor: Colors.success, backgroundColor: '#f0fdf4' },
  actionPropose: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  actionDecline: { borderColor: Colors.error, backgroundColor: '#fef2f2' },
  actionChoiceText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  confirmCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: Radius.md, padding: Spacing.md },
  confirmCardDecline: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  confirmText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },

  proposeForm: { gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  proposeFormTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  fieldInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.background },
  required: { color: Colors.error },
  timeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, marginRight: Spacing.sm, backgroundColor: Colors.background },
  timeChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  timeChipTextSelected: { color: '#fff', fontWeight: FontWeight.semibold },

  footer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  backBtnText: { fontSize: FontSize.md, color: Colors.text, fontWeight: FontWeight.medium },
  submitBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md },
  submitBtnAccept: { backgroundColor: Colors.success },
  submitBtnDecline: { backgroundColor: Colors.error },
  submitBtnPropose: { backgroundColor: Colors.primary },
  submitBtnText: { fontSize: FontSize.md, color: '#fff', fontWeight: FontWeight.semibold },
  btnDisabled: { opacity: 0.5 },
});
