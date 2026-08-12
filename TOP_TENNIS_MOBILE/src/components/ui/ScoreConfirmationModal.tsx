import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

interface Props {
  visible: boolean;
  match: any | null;
  userId: string;
  onClose: () => void;
  onConfirmed: () => void;
}

export const ScoreConfirmationModal: React.FC<Props> = ({ visible, match, userId, onClose, onConfirmed }) => {
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!match) return null;

  const score = match.score as any;
  const sets: { p1: number; p2: number }[] = score?.sets || [];
  const isPlayer1 = match.player1_id === userId;
  const didIWin = match.winner_id === userId;
  const opponentName = isPlayer1 ? match.player2_name : match.player1_name;

  const formatScore = () => {
    if (!sets.length) return 'No score recorded';
    return sets.map((s: any) =>
      isPlayer1 ? `${s.p1}-${s.p2}` : `${s.p2}-${s.p1}`
    ).join(', ');
  };

  const handleClose = () => {
    setShowDispute(false);
    setDisputeReason('');
    onClose();
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('confirm_league_match_score', {
        p_match_id: match.id,
        p_confirming_user_id: userId,
      });
      if (error) throw error;
      Alert.alert('Score Confirmed!', 'The leaderboard has been updated.');
      onConfirmed();
      handleClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to confirm score.');
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for the dispute.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('dispute_league_match_score', {
        p_match_id: match.id,
        p_disputing_user_id: userId,
        p_dispute_reason: disputeReason.trim(),
      });
      if (error) throw error;
      Alert.alert('Dispute Submitted', 'Your opponent and the league admin have been notified. The match will be reviewed.');
      onConfirmed();
      handleClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit dispute.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIcon, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="alert-circle" size={20} color="#ea580c" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Confirm Match Score</Text>
              <Text style={styles.headerSub}>Review and confirm or dispute</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Result summary */}
          <View style={[styles.resultCard, didIWin ? styles.resultCardWin : styles.resultCardLoss]}>
            <View style={styles.resultRow}>
              <Ionicons
                name={didIWin ? 'trophy' : 'person'}
                size={32}
                color={didIWin ? Colors.success : Colors.error}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultLabel, { color: didIWin ? Colors.success : Colors.error }]}>
                  {didIWin ? 'You Won! 🎉' : 'You Lost'}
                </Text>
                <Text style={styles.resultSub}>Reported by {opponentName}</Text>
              </View>
            </View>

            <View style={styles.resultDetails}>
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailKey}>Opponent</Text>
                <Text style={styles.resultDetailVal}>{opponentName}</Text>
              </View>
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailKey}>Score</Text>
                <Text style={[styles.resultDetailVal, styles.scoreText]}>{formatScore()}</Text>
              </View>
              {score?.tiebreak && (
                <View style={styles.resultDetailRow}>
                  <Text style={styles.resultDetailKey}>Tiebreak</Text>
                  <Text style={[styles.resultDetailVal, styles.scoreText]}>
                    {isPlayer1 ? `${score.tiebreak.p1}-${score.tiebreak.p2}` : `${score.tiebreak.p2}-${score.tiebreak.p1}`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Dispute form */}
          {showDispute && (
            <View style={styles.disputeCard}>
              <Text style={styles.disputeTitle}>Reason for Dispute <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.disputeInput}
                value={disputeReason}
                onChangeText={setDisputeReason}
                placeholder="Please explain why you believe this score is incorrect..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.disputeHint}>
                A league administrator will review the dispute and contact both players.
              </Text>
            </View>
          )}

          {/* Fair play banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#1d4ed8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>Fair Play Reminder</Text>
              <Text style={styles.infoBannerText}>
                Only confirm if the score is accurate. Disputing false scores or confirming incorrect scores violates fair play rules.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {!showDispute ? (
            <>
              <TouchableOpacity
                style={styles.disputeBtn}
                onPress={() => setShowDispute(true)}
                disabled={loading}
              >
                <Ionicons name="close-circle-outline" size={18} color="#ea580c" />
                <Text style={styles.disputeBtnText}>Dispute Score</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, loading && styles.btnDisabled]}
                onPress={handleConfirm}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={styles.confirmBtnText}>Confirm Score</Text></>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.cancelDisputeBtn}
                onPress={() => { setShowDispute(false); setDisputeReason(''); }}
                disabled={loading}
              >
                <Text style={styles.cancelDisputeBtnText}>Cancel Dispute</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitDisputeBtn, (loading || !disputeReason.trim()) && styles.btnDisabled]}
                onPress={handleDispute}
                disabled={loading || !disputeReason.trim()}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.submitDisputeBtnText}>Submit Dispute</Text>
                }
              </TouchableOpacity>
            </>
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
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { padding: Spacing.xs },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.lg, gap: Spacing.lg },

  resultCard: { borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1.5, gap: Spacing.md },
  resultCardWin: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  resultCardLoss: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  resultLabel: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  resultSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  resultDetails: { gap: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md },
  resultDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultDetailKey: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  resultDetailVal: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.semibold },
  scoreText: { fontFamily: 'monospace', fontSize: FontSize.md },

  disputeCard: { backgroundColor: '#fff7ed', borderWidth: 1.5, borderColor: '#fed7aa', borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  disputeTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#9a3412' },
  required: { color: Colors.error },
  disputeInput: { borderWidth: 1.5, borderColor: '#fdba74', borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.sm, color: Colors.text, backgroundColor: '#fff', height: 100 },
  disputeHint: { fontSize: FontSize.xs, color: '#c2410c' },

  infoBanner: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: Radius.md, padding: Spacing.md },
  infoBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#1e40af', marginBottom: 2 },
  infoBannerText: { fontSize: FontSize.xs, color: '#1e40af', lineHeight: 18 },

  footer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  disputeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: '#ea580c' },
  disputeBtnText: { fontSize: FontSize.md, color: '#ea580c', fontWeight: FontWeight.semibold },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.success },
  confirmBtnText: { fontSize: FontSize.md, color: '#fff', fontWeight: FontWeight.semibold },
  cancelDisputeBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border },
  cancelDisputeBtnText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  submitDisputeBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: '#ea580c' },
  submitDisputeBtnText: { fontSize: FontSize.md, color: '#fff', fontWeight: FontWeight.semibold },
  btnDisabled: { opacity: 0.5 },
});
