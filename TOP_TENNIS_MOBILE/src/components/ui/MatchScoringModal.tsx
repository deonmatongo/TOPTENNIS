import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import type { LeagueMatch } from '@/hooks/useLeagueMatches';

interface Props {
  visible: boolean;
  match: LeagueMatch | null;
  playerRecordId: string;
  onClose: () => void;
  onSubmit: (params: {
    matchId: string;
    winnerId: string;
    set1p1: number; set1p2: number;
    set2p1: number; set2p2: number;
    set3p1?: number | null; set3p2?: number | null;
    tiebreakP1?: number | null; tiebreakP2?: number | null;
    reportedByPlayerId: string;
  }) => Promise<void>;
}

interface SetScore { p1: string; p2: string; }

export const MatchScoringModal: React.FC<Props> = ({ visible, match, playerRecordId, onClose, onSubmit }) => {
  const [winnerId, setWinnerId] = useState('');
  const [set1, setSet1] = useState<SetScore>({ p1: '', p2: '' });
  const [set2, setSet2] = useState<SetScore>({ p1: '', p2: '' });
  const [set3, setSet3] = useState<SetScore>({ p1: '', p2: '' });
  const [tiebreak, setTiebreak] = useState<SetScore>({ p1: '', p2: '' });
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setWinnerId('');
    setSet1({ p1: '', p2: '' });
    setSet2({ p1: '', p2: '' });
    setSet3({ p1: '', p2: '' });
    setTiebreak({ p1: '', p2: '' });
  };

  const handleClose = () => { reset(); onClose(); };

  const validate = () => {
    if (!set1.p1 || !set1.p2 || !set2.p1 || !set2.p2) {
      Alert.alert('Missing Scores', 'Please enter scores for at least the first two sets.');
      return false;
    }
    if (!winnerId) {
      Alert.alert('Select Winner', 'Please select who won the match.');
      return false;
    }
    const nums = [set1.p1, set1.p2, set2.p1, set2.p2];
    if (set3.p1 || set3.p2) nums.push(set3.p1, set3.p2);
    for (const n of nums) {
      const v = parseInt(n);
      if (isNaN(v) || v < 0 || v > 7) {
        Alert.alert('Invalid Score', 'Set scores must be between 0 and 7.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!match || !validate()) return;
    setLoading(true);
    try {
      await onSubmit({
        matchId: match.id,
        winnerId,
        set1p1: parseInt(set1.p1),
        set1p2: parseInt(set1.p2),
        set2p1: parseInt(set2.p1),
        set2p2: parseInt(set2.p2),
        set3p1: set3.p1 ? parseInt(set3.p1) : null,
        set3p2: set3.p2 ? parseInt(set3.p2) : null,
        tiebreakP1: tiebreak.p1 ? parseInt(tiebreak.p1) : null,
        tiebreakP2: tiebreak.p2 ? parseInt(tiebreak.p2) : null,
        reportedByPlayerId: playerRecordId,
      });
      Alert.alert('Score Submitted', 'Your opponent will be notified to confirm the score. The leaderboard will update once confirmed.');
      handleClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit score. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!match) return null;

  const renderSetRow = (
    label: string,
    required: boolean,
    value: SetScore,
    onChange: (v: SetScore) => void
  ) => (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
      <View style={styles.setInputs}>
        <View style={styles.setInputWrap}>
          <Text style={styles.setPlayerName} numberOfLines={1}>{match.player1_name}</Text>
          <TextInput
            style={styles.setInput}
            keyboardType="number-pad"
            maxLength={1}
            value={value.p1}
            onChangeText={t => onChange({ ...value, p1: t })}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        <Text style={styles.setVs}>–</Text>
        <View style={styles.setInputWrap}>
          <Text style={styles.setPlayerName} numberOfLines={1}>{match.player2_name}</Text>
          <TextInput
            style={styles.setInput}
            keyboardType="number-pad"
            maxLength={1}
            value={value.p2}
            onChangeText={t => onChange({ ...value, p2: t })}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
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
              <Ionicons name="trophy" size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Report Match Score</Text>
              <Text style={styles.headerSub}>vs {match.opponent_name}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Winner selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who won the match? <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={[styles.winnerOption, winnerId === match.player1_id && styles.winnerOptionSelected]}
              onPress={() => setWinnerId(match.player1_id)}
            >
              <View style={[styles.radio, winnerId === match.player1_id && styles.radioSelected]}>
                {winnerId === match.player1_id && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.winnerName, winnerId === match.player1_id && styles.winnerNameSelected]}>
                {match.player1_name}
              </Text>
              {winnerId === match.player1_id && (
                <View style={styles.winnerBadge}><Text style={styles.winnerBadgeText}>Winner</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.winnerOption, winnerId === match.player2_id && styles.winnerOptionSelected]}
              onPress={() => setWinnerId(match.player2_id)}
            >
              <View style={[styles.radio, winnerId === match.player2_id && styles.radioSelected]}>
                {winnerId === match.player2_id && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.winnerName, winnerId === match.player2_id && styles.winnerNameSelected]}>
                {match.player2_name}
              </Text>
              {winnerId === match.player2_id && (
                <View style={styles.winnerBadge}><Text style={styles.winnerBadgeText}>Winner</Text></View>
              )}
            </TouchableOpacity>
          </View>

          {/* Set scores */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Set Scores</Text>
            {renderSetRow('Set 1', true, set1, setSet1)}
            {renderSetRow('Set 2', true, set2, setSet2)}
            {renderSetRow('Set 3 (Optional)', false, set3, setSet3)}
            {renderSetRow('Tiebreak (Optional)', false, tiebreak, setTiebreak)}
          </View>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#1d4ed8" />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>Professional Tennis Scoring</Text>
              <Text style={styles.infoBannerText}>
                Enter the number of games won in each set. A set is won by the first player to reach 6 games with at least a 2-game lead, or 7-6 in a tiebreak.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="trophy-outline" size={18} color="#fff" /><Text style={styles.submitBtnText}>Submit Score</Text></>
            }
          </TouchableOpacity>
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
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
  closeBtn: { padding: Spacing.xs },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  required: { color: Colors.error },

  // Winner
  winnerOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  winnerOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  winnerName: { flex: 1, fontSize: FontSize.md, color: Colors.text, fontWeight: FontWeight.medium },
  winnerNameSelected: { color: Colors.primary, fontWeight: FontWeight.semibold },
  winnerBadge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  winnerBadgeText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.semibold },

  // Sets
  setRow: { gap: Spacing.sm },
  setLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  setInputs: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  setInputWrap: { flex: 1, gap: 4 },
  setPlayerName: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  setInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, textAlign: 'center', backgroundColor: Colors.surface },
  setVs: { fontSize: FontSize.lg, color: Colors.textMuted, fontWeight: FontWeight.bold, marginTop: 18 },

  // Info
  infoBanner: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: Radius.md, padding: Spacing.md },
  infoBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#1e40af', marginBottom: 2 },
  infoBannerText: { fontSize: FontSize.xs, color: '#1e40af', lineHeight: 18 },

  // Footer
  footer: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  submitBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: '#ea580c' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: FontSize.md, color: '#fff', fontWeight: FontWeight.semibold },
});
