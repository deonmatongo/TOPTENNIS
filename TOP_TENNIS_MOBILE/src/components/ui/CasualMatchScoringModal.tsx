import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import type { MatchInvite } from '@/hooks/useMatches';
import { Colors, Palette, FontSize, FontWeight, Spacing, Radius, Font } from '@/theme/colors';
import { format } from 'date-fns';

interface SetScore { my: number; opp: number }

interface Props {
  visible: boolean;
  match: MatchInvite | null;
  userId: string;
  onClose: () => void;
  /** Called with (winnerId, senderSetsWon, receiverSetsWon) */
  onSubmit: (winnerId: string, senderSets: number, receiverSets: number) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function whoWonSet(s: SetScore): 'my' | 'opp' | null {
  if (s.my === 0 && s.opp === 0) return null; // not yet entered
  if (s.my > s.opp) return 'my';
  if (s.opp > s.my) return 'opp';
  return null; // tied — invalid tennis but don't crash
}

// ─── Score stepper sub-component ─────────────────────────────────────────────

function ScoreStepper({
  value, onChange, isWinner = false, disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  isWinner?: boolean;
  disabled?: boolean;
}) {
  const dec = () => onChange(Math.max(0, value - 1));
  const inc = () => onChange(Math.min(7, value + 1));

  return (
    <View style={[sp.wrap, isWinner && sp.wrapWinner]}>
      <TouchableOpacity
        onPress={dec}
        style={[sp.btn, value === 0 && sp.btnDisabled]}
        disabled={value === 0 || disabled}
        activeOpacity={0.65}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="remove" size={20} color={value === 0 ? Colors.borderLight : isWinner ? Colors.success : Colors.textSecondary} />
      </TouchableOpacity>

      <Text style={[sp.value, isWinner && sp.valueWinner]}>{value}</Text>

      <TouchableOpacity
        onPress={inc}
        style={[sp.btn, value === 7 && sp.btnDisabled]}
        disabled={value === 7 || disabled}
        activeOpacity={0.65}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="add" size={20} color={value === 7 ? Colors.borderLight : isWinner ? Colors.success : Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const sp = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    minWidth: 110,
    justifyContent: 'center',
  },
  wrapWinner: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  btn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  btnDisabled: { opacity: 0.35 },
  value: {
    fontSize: FontSize.xxl,
    fontFamily: Font.black,
    color: Colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  valueWinner: { color: Colors.success },
});

// ─── Set row sub-component ────────────────────────────────────────────────────

function SetRow({
  label, value, onChange, myLabel, oppLabel, loading, isDecider = false,
}: {
  label: string;
  value: SetScore;
  onChange: (v: SetScore) => void;
  myLabel: string;
  oppLabel: string;
  loading: boolean;
  isDecider?: boolean;
}) {
  const winner = whoWonSet(value);
  const setPlayed = value.my > 0 || value.opp > 0;

  return (
    <View style={[sr.card, isDecider && sr.cardDecider]}>
      {/* Set label row */}
      <View style={sr.labelRow}>
        <Text style={[sr.label, isDecider && sr.labelDecider]}>{label}</Text>
        {setPlayed && winner && (
          <View style={[sr.winBadge, winner === 'my' ? sr.winBadgeMy : sr.winBadgeOpp]}>
            <Text style={sr.winBadgeTxt}>
              {winner === 'my' ? myLabel : oppLabel} wins set
            </Text>
          </View>
        )}
      </View>

      {/* Score row */}
      <View style={sr.scoresRow}>
        <View style={sr.scoreCol}>
          <Text style={sr.playerLbl}>{myLabel}</Text>
          <ScoreStepper
            value={value.my}
            onChange={v => onChange({ ...value, my: v })}
            isWinner={winner === 'my'}
            disabled={loading}
          />
        </View>

        <Text style={sr.dash}>—</Text>

        <View style={sr.scoreCol}>
          <Text style={sr.playerLbl}>{oppLabel}</Text>
          <ScoreStepper
            value={value.opp}
            onChange={v => onChange({ ...value, opp: v })}
            isWinner={winner === 'opp'}
            disabled={loading}
          />
        </View>
      </View>
    </View>
  );
}

const sr = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    gap: Spacing.md,
  },
  cardDecider: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontSize: FontSize.sm,
    fontFamily: Font.extrabold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelDecider: { color: Colors.primary },
  winBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  winBadgeMy:  { backgroundColor: Colors.successLight },
  winBadgeOpp: { backgroundColor: Colors.errorLight },
  winBadgeTxt: { fontSize: FontSize.xxs, fontFamily: Font.bold, color: Colors.text },
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  scoreCol: { alignItems: 'center', gap: Spacing.xs, flex: 1 },
  playerLbl: {
    fontSize: FontSize.xs,
    fontFamily: Font.semibold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  dash: {
    fontSize: FontSize.xxl,
    fontFamily: Font.bold,
    color: Colors.textMuted,
  },
});

// ─── Main modal ───────────────────────────────────────────────────────────────

export const CasualMatchScoringModal: React.FC<Props> = ({
  visible, match, userId, onClose, onSubmit,
}) => {
  const [set1, setSet1] = useState<SetScore>({ my: 0, opp: 0 });
  const [set2, setSet2] = useState<SetScore>({ my: 0, opp: 0 });
  const [set3, setSet3] = useState<SetScore>({ my: 0, opp: 0 });
  const [loading, setLoading] = useState(false);

  // Reset state each time a match opens
  useEffect(() => {
    if (visible) {
      setSet1({ my: 0, opp: 0 });
      setSet2({ my: 0, opp: 0 });
      setSet3({ my: 0, opp: 0 });
    }
  }, [visible, match?.id]);

  if (!match) return null;

  const isSender     = match.sender_id === userId;
  const myProfile    = isSender ? match.sender   : match.receiver;
  const oppProfile   = isSender ? match.receiver : match.sender;
  const opponentId   = isSender ? match.receiver_id : match.sender_id;
  const myImage      = myProfile?.profile_picture_url;
  const oppImage     = oppProfile?.profile_picture_url;
  const oppFirstName = oppProfile
    ? (oppProfile.first_name || '').trim() || 'Opp'
    : 'Opponent';
  const oppFullName  = oppProfile
    ? `${oppProfile.first_name || ''} ${oppProfile.last_name || ''}`.trim() || 'Opponent'
    : 'Opponent';

  // Determine set winners
  const s1w = whoWonSet(set1);
  const s2w = whoWonSet(set2);
  const s3w = whoWonSet(set3);

  const mySetsWon  = [s1w, s2w, s3w].filter(w => w === 'my').length;
  const oppSetsWon = [s1w, s2w, s3w].filter(w => w === 'opp').length;

  // Show decider set only when first two sets split 1–1
  const showSet3 = s1w !== null && s2w !== null && s1w !== s2w;

  // Match decided at best of 3
  const iWon     = mySetsWon >= 2;
  const oppWon   = oppSetsWon >= 2;
  const hasResult = iWon || oppWon;
  const winnerId  = iWon ? userId : oppWon ? opponentId : null;

  // DB values: sender/receiver sets (not me/opp)
  const senderSets   = isSender ? mySetsWon  : oppSetsWon;
  const receiverSets = isSender ? oppSetsWon : mySetsWon;

  const handleSubmit = async () => {
    if (!hasResult || !winnerId) {
      Alert.alert('Score Incomplete', 'Enter set scores until a winner is determined (best of 3 sets).');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(winnerId, senderSets, receiverSets);
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { if (!loading) onClose(); };

  const matchDate = match.date
    ? format(new Date(match.date), 'EEE, MMM d')
    : '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={m.safe} edges={['top', 'bottom']}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={m.header}>
          <View style={m.headerIcon}>
            <Ionicons name="trophy" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={m.headerTitle}>Log Match Result</Text>
            <Text style={m.headerSub}>You are logging this as the winner</Text>
          </View>
          <TouchableOpacity onPress={handleClose} disabled={loading} style={m.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Match meta ──────────────────────────────────────────────── */}
        <View style={m.meta}>
          {matchDate ? (
            <View style={m.metaChip}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
              <Text style={m.metaTxt}>{matchDate}</Text>
            </View>
          ) : null}
          {match.start_time ? (
            <View style={m.metaChip}>
              <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
              <Text style={m.metaTxt}>{match.start_time}</Text>
            </View>
          ) : null}
          {match.court_location ? (
            <View style={m.metaChip}>
              <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
              <Text style={m.metaTxt} numberOfLines={1}>{match.court_location}</Text>
            </View>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={m.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Scoreboard summary ──────────────────────────────────── */}
          <View style={m.scoreboard}>
            {/* My card */}
            <PlayerSummaryCard
              label="You"
              imageUrl={myImage}
              setsWon={mySetsWon}
              isWinner={iWon}
              hasResult={hasResult}
            />

            {/* Centre */}
            <View style={m.scoreboardCentre}>
              <Text style={m.scoreboardVs}>VS</Text>
              <Text style={m.scoreboardSetsTotal}>
                {mySetsWon} – {oppSetsWon}
              </Text>
              <Text style={m.scoreboardSetsLabel}>sets</Text>
            </View>

            {/* Opp card */}
            <PlayerSummaryCard
              label={oppFirstName}
              imageUrl={oppImage}
              setsWon={oppSetsWon}
              isWinner={oppWon}
              hasResult={hasResult}
            />
          </View>

          {/* ── Result banner ────────────────────────────────────────── */}
          {hasResult && (
            <LinearGradient
              colors={iWon
                ? [Colors.success, '#059669']
                : [Palette.red500, '#b91c1c']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={m.resultBanner}
            >
              <Ionicons name={iWon ? 'trophy' : 'ribbon-outline'} size={24} color="#fff" />
              <View>
                <Text style={m.resultTitle}>
                  {iWon ? '🎉 You Won!' : `${oppFirstName} Won`}
                </Text>
                <Text style={m.resultSub}>
                  Match score: {mySetsWon}–{oppSetsWon} sets
                </Text>
              </View>
            </LinearGradient>
          )}

          {/* ── Set score entry ──────────────────────────────────────── */}
          <Text style={m.sectionTitle}>Enter Games Per Set</Text>
          <Text style={m.sectionHint}>
            Tap + or – to enter the number of games each player won in each set.
          </Text>

          <View style={m.setsContainer}>
            <SetRow
              label="Set 1"
              value={set1}
              onChange={setSet1}
              myLabel="You"
              oppLabel={oppFirstName}
              loading={loading}
            />
            <SetRow
              label="Set 2"
              value={set2}
              onChange={setSet2}
              myLabel="You"
              oppLabel={oppFirstName}
              loading={loading}
            />
            {showSet3 && (
              <SetRow
                label="Set 3 — Decider"
                value={set3}
                onChange={setSet3}
                myLabel="You"
                oppLabel={oppFirstName}
                loading={loading}
                isDecider
              />
            )}
          </View>

          {/* ── Tip ─────────────────────────────────────────────────── */}
          {!hasResult && (
            <View style={m.tip}>
              <Ionicons name="bulb-outline" size={15} color={Colors.textMuted} />
              <Text style={m.tipTxt}>
                First to win 2 sets wins the match. Set 3 appears automatically if sets are tied 1–1.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={m.footer}>
          <TouchableOpacity
            style={m.cancelBtn}
            onPress={handleClose}
            disabled={loading}
            activeOpacity={0.75}
          >
            <Text style={m.cancelTxt}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[m.submitBtn, (!hasResult || loading) && m.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!hasResult || loading}
            activeOpacity={0.87}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={m.submitTxt}>Submit Result</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ─── Player summary card ──────────────────────────────────────────────────────

function PlayerSummaryCard({
  label, imageUrl, setsWon, isWinner, hasResult,
}: {
  label: string;
  imageUrl?: string;
  setsWon: number;
  isWinner: boolean;
  hasResult: boolean;
}) {
  return (
    <View style={[pc.card, isWinner && pc.cardWinner, hasResult && !isWinner && pc.cardLoser]}>
      <Avatar name={label} imageUrl={imageUrl} size={52} />
      <Text style={pc.name} numberOfLines={1}>{label}</Text>

      <View style={[pc.setsCircle, isWinner && pc.setsCircleWinner, hasResult && !isWinner && pc.setsCircleLoser]}>
        <Text style={[pc.setsNum, isWinner && pc.setsNumWinner]}>{setsWon}</Text>
      </View>
      <Text style={pc.setsLabel}>SETS</Text>

      {isWinner && (
        <View style={pc.winnerTag}>
          <Ionicons name="trophy" size={10} color="#fff" />
          <Text style={pc.winnerTagTxt}>WINNER</Text>
        </View>
      )}
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  cardWinner: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  cardLoser: {
    borderColor: Colors.borderLight,
    opacity: 0.7,
  },
  name: {
    fontSize: FontSize.sm,
    fontFamily: Font.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  setsCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  setsCircleWinner: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  setsCircleLoser: {
    opacity: 0.5,
  },
  setsNum: {
    fontSize: FontSize.xxl,
    fontFamily: Font.black,
    color: Colors.text,
  },
  setsNumWinner: { color: '#fff' },
  setsLabel: {
    fontSize: 9,
    fontFamily: Font.extrabold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  winnerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  winnerTagTxt: {
    fontSize: 9,
    fontFamily: Font.extrabold,
    color: '#fff',
    letterSpacing: 0.8,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  headerSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  closeBtn: { padding: Spacing.xs },

  // Meta chips
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  metaTxt: { fontSize: FontSize.xs, fontFamily: Font.medium, color: Colors.textSecondary },

  scroll: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxxxl },

  // Scoreboard
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scoreboardCentre: { alignItems: 'center', gap: 2 },
  scoreboardVs: {
    fontSize: FontSize.xs,
    fontFamily: Font.extrabold,
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  scoreboardSetsTotal: {
    fontSize: FontSize.xxxl,
    fontFamily: Font.black,
    color: Colors.text,
    letterSpacing: -1,
  },
  scoreboardSetsLabel: {
    fontSize: FontSize.xs,
    fontFamily: Font.medium,
    color: Colors.textMuted,
  },

  // Result banner
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  resultTitle: { fontSize: FontSize.lg, fontFamily: Font.extrabold, color: '#fff' },
  resultSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.80)', marginTop: 2 },

  // Section labels
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: Font.bold,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: -Spacing.md,
  },

  // Sets container
  setsContainer: { gap: Spacing.md },

  // Tip
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tipTxt: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelTxt: { fontSize: FontSize.md, fontFamily: Font.semibold, color: Colors.textSecondary },
  submitBtn: {
    flex: 2,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  submitBtnOff: { opacity: 0.4 },
  submitTxt: { fontSize: FontSize.md, fontFamily: Font.bold, color: '#fff' },
});
