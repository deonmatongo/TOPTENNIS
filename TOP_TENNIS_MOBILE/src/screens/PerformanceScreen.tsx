import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { useAchievements } from '@/hooks/useAchievements';
import { useMatchHistory } from '@/hooks/useMatchHistory';
import { Colors, FontSize, Font, FontWeight, Spacing, Radius, Shadow, Palette } from '@/theme/colors';
import { format } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────

export const PerformanceScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { player, refetch }          = usePlayerProfile();
  const { registrations }             = useLeagueRegistrations();
  const { history, loading: histL }   = useMatchHistory(15);
  const { achievements, unlockedCount, totalCount, completionPercentage } = useAchievements([], player);
  const [refreshing, setRefreshing]   = useState(false);
  const [leagueId, setLeagueId]       = useState('all');
  const [showAll, setShowAll]         = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const wins      = player?.wins        ?? 0;
  const losses    = player?.losses      ?? 0;
  const total     = wins + losses;
  const winRate   = total > 0 ? Math.round((wins / total) * 100) : 0;
  const streak    = player?.current_streak ?? 0;
  const bestStr   = player?.best_streak   ?? 0;

  const casualHistory    = history.filter(m => !m.is_league_match);
  const casualWins       = casualHistory.filter(m => m.result === 'win').length;
  const casualLosses     = casualHistory.filter(m => m.result === 'loss').length;
  const displayedHistory = showAll ? history : history.slice(0, 5);

  const totalSetsWon  = history.reduce((s, m) => s + (m.setsWon  ?? 0), 0);
  const totalSetsLost = history.reduce((s, m) => s + (m.setsLost ?? 0), 0);
  const hoursPlayed   = Math.round(history.reduce((s, m) => s + (m.durationMinutes ?? 0), 0) / 60 * 10) / 10;

  const METRICS = [
    { label: 'Total Matches', value: total,          icon: 'tennisball-outline' as const, color: Palette.blue500,   bg: Palette.blueBg   },
    { label: 'Win Rate',      value: `${winRate}%`,  icon: 'trophy-outline'    as const, color: Palette.green500,  bg: Palette.greenBg  },
    { label: 'Win Streak',    value: streak,          icon: 'flame-outline'    as const, color: Palette.orange500, bg: Palette.orange50 },
    { label: 'Best Streak',   value: bestStr,         icon: 'ribbon-outline'   as const, color: Palette.purple500, bg: Palette.purpleBg },
    ...(totalSetsWon + totalSetsLost > 0 ? [{ label: 'Sets Record', value: `${totalSetsWon}–${totalSetsLost}`, icon: 'stats-chart-outline' as const, color: Palette.blue500, bg: Palette.blueBg }] : []),
    ...(hoursPlayed > 0 ? [{ label: 'Hours Played', value: `${hoursPlayed}h`, icon: 'time-outline' as const, color: Palette.green500, bg: Palette.greenBg }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.gradHeader, { paddingTop: insets.top + Spacing.md }]}
      >
        <TouchableOpacity style={s.gradBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.gradTitle}>Performance</Text>
          <Text style={s.gradSub}>Stats & analytics</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={s.scroll}
      >

        {/* ── Hero stat card ─────────────────────────────────────────────── */}
        <LinearGradient
          colors={[Palette.dark900, Palette.dark700]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.heroCard}
        >
          <Text style={s.heroLabel}>CAREER RECORD</Text>
          <View style={s.heroRecord}>
            <View style={s.heroStatCol}>
              <Text style={s.heroStatNum}>{wins}</Text>
              <Text style={s.heroStatLbl}>Wins</Text>
            </View>
            <View style={s.heroDash}>
              <Text style={s.heroDashText}>—</Text>
            </View>
            <View style={s.heroStatCol}>
              <Text style={[s.heroStatNum, { color: Palette.red400 }]}>{losses}</Text>
              <Text style={s.heroStatLbl}>Losses</Text>
            </View>
          </View>

          {/* Win rate bar */}
          <View style={s.winBar}>
            <View style={[s.winBarFill, { flex: wins || 0.01 }]} />
            <View style={[s.lossBarFill, { flex: losses || 0.01 }]} />
          </View>
          <Text style={s.winBarLabel}>{winRate}% Win Rate across {total} match{total !== 1 ? 'es' : ''}</Text>
        </LinearGradient>

        {/* ── Metrics grid ───────────────────────────────────────────────── */}
        <View style={s.metricsGrid}>
          {METRICS.map(m => (
            <View key={m.label} style={[s.metricCard, { backgroundColor: m.bg }]}>
              <View style={[s.metricIcon, { backgroundColor: m.color + '22' }]}>
                <Ionicons name={m.icon} size={22} color={m.color} />
              </View>
              <Text style={[s.metricValue, { color: m.color }]}>{m.value}</Text>
              <Text style={s.metricLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* ── League performance ─────────────────────────────────────────── */}
        {registrations.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>League Performance</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyLeagues')}>
                <Text style={s.cardLink}>View all →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {['all', ...registrations.map(r => r.league_id)].map((id, idx) => {
                const reg = registrations.find(r => r.league_id === id);
                return (
                  <TouchableOpacity
                    key={id ?? `league-${idx}`}
                    style={[s.leagueChip, leagueId === id && s.leagueChipActive]}
                    onPress={() => setLeagueId(id)}
                  >
                    <Text style={[s.leagueChipText, leagueId === id && s.leagueChipTextActive]}>
                      {id === 'all' ? 'All Leagues' : (reg?.league_name || 'League')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={s.leagueSummary}>Registered in {registrations.length} league{registrations.length !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {/* ── Casual Match Dashboard ─────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <View>
              <Text style={s.cardTitle}>Casual Matches</Text>
              <Text style={s.cardSub}>Non-league match performance</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('CasualMatch')}>
              <Text style={s.cardLink}>Find Players →</Text>
            </TouchableOpacity>
          </View>

          {casualHistory.length === 0 ? (
            <View style={s.histEmpty}>
              <Ionicons name="tennisball-outline" size={28} color={Colors.textMuted} />
              <Text style={s.histEmptyTxt}>No casual matches yet</Text>
            </View>
          ) : (
            <View style={s.casualGrid}>
              {[
                { label: 'Played', value: casualHistory.length, color: Palette.blue500, bg: Palette.blueBg, icon: 'tennisball-outline' as const },
                { label: 'Wins',   value: casualWins,           color: Palette.green500, bg: Palette.greenBg, icon: 'trophy-outline' as const },
                { label: 'Losses', value: casualLosses,         color: Palette.red500,  bg: Palette.redBg,  icon: 'close-circle-outline' as const },
                {
                  label: 'Win Rate',
                  value: `${casualHistory.length > 0 ? Math.round((casualWins / casualHistory.length) * 100) : 0}%`,
                  color: Palette.orange500, bg: Palette.orange50, icon: 'flame-outline' as const,
                },
              ].map(m => (
                <View key={m.label} style={[s.casualCard, { backgroundColor: m.bg }]}>
                  <View style={[s.metricIcon, { backgroundColor: m.color + '22' }]}>
                    <Ionicons name={m.icon} size={18} color={m.color} />
                  </View>
                  <Text style={[s.metricValue, { color: m.color, fontSize: FontSize.lg }]}>{m.value}</Text>
                  <Text style={s.metricLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Achievements ───────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <View>
              <Text style={s.cardTitle}>Achievements</Text>
              <Text style={s.cardSub}>{unlockedCount} of {totalCount} unlocked</Text>
            </View>
            <View style={s.achieveProgress}>
              <View style={s.achieveBar}>
                <View style={[s.achieveFill, { width: `${completionPercentage}%` as any }]} />
              </View>
              <Text style={s.achievePct}>{completionPercentage}%</Text>
            </View>
          </View>

          <View style={s.achieveList}>
            {achievements.map(a => (
              <View key={a.id} style={[s.achieveRow, !a.unlocked && s.achieveRowLocked]}>
                <View style={[s.achieveIcon, { backgroundColor: a.unlocked ? a.bgColor : Colors.backgroundAlt }]}>
                  <Ionicons name={a.icon as any} size={20} color={a.unlocked ? a.color : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.achieveNameRow}>
                    <Text style={[s.achieveName, !a.unlocked && s.achieveNameLocked]} numberOfLines={1}>{a.title}</Text>
                    {a.unlocked
                      ? <View style={s.unlockedPill}><Text style={s.unlockedPillText}>✓ {a.date || 'Achieved'}</Text></View>
                      : <View style={s.lockedPill}><Text style={s.lockedPillText}>Locked</Text></View>
                    }
                  </View>
                  <Text style={s.achieveDesc}>{a.description}</Text>
                  {!a.unlocked && a.progress !== undefined && a.target !== undefined && (
                    <View style={s.progressRow}>
                      <View style={s.progressBar}>
                        <View style={[s.progressFill, { width: `${Math.round((a.progress / a.target) * 100)}%` as any }]} />
                      </View>
                      <Text style={s.progressTxt}>{a.progress}/{a.target}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Match History ──────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Match History</Text>
            <Text style={s.cardSub}>Most recent first</Text>
          </View>

          {histL ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
          ) : history.length === 0 ? (
            <View style={s.histEmpty}>
              <Ionicons name="calendar-outline" size={32} color={Colors.textMuted} />
              <Text style={s.histEmptyTxt}>No match history yet</Text>
            </View>
          ) : (
            <>
              {displayedHistory.map((m, i) => {
                const isWin  = m.result === 'win';
                const isLoss = m.result === 'loss';
                return (
                  <View key={m.id} style={[s.histRow, i < displayedHistory.length - 1 && s.histRowDivider]}>
                    <View style={[s.histDot, {
                      backgroundColor: isWin ? Palette.green500 : isLoss ? Palette.red500 : Palette.gray300,
                    }]} />
                    <View style={{ flex: 1 }}>
                      <View style={s.histNameRow}>
                        <Text style={s.histOpponent} numberOfLines={1}>vs {m.opponent_name}</Text>
                        {m.is_league_match && <View style={s.leagueMini}><Text style={s.leagueMiniText}>League</Text></View>}
                      </View>
                      <View style={s.histMeta}>
                        <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                        <Text style={s.histMetaTxt}>{format(new Date(m.match_date), 'MMM d, yyyy')}</Text>
                        {m.durationMinutes ? <><Text style={s.dot}>·</Text><Text style={s.histMetaTxt}>{m.durationMinutes} min</Text></> : null}
                        {m.court_location && <><Text style={s.dot}>·</Text><Text style={s.histMetaTxt} numberOfLines={1}>{m.court_location}</Text></>}
                      </View>
                      {(m.straightSets || m.comeback || m.bagel) && (
                        <View style={s.badgeRow}>
                          {m.straightSets && <View style={s.matchBadge}><Text style={s.matchBadgeTxt}>Straight Sets</Text></View>}
                          {m.comeback     && <View style={[s.matchBadge, { backgroundColor: Palette.purpleBg }]}><Text style={[s.matchBadgeTxt, { color: Palette.purple500 }]}>Comeback</Text></View>}
                          {m.bagel        && <View style={[s.matchBadge, { backgroundColor: Palette.orange50 }]}><Text style={[s.matchBadgeTxt, { color: Palette.orange500 }]}>Bagel</Text></View>}
                        </View>
                      )}
                    </View>
                    <View style={s.histRight}>
                      <View style={[s.resultPill, {
                        backgroundColor: isWin ? Palette.greenBg : isLoss ? Palette.redBg : Colors.backgroundAlt,
                      }]}>
                        <Text style={[s.resultPillText, { color: isWin ? Palette.green600 : isLoss ? Palette.red600 : Colors.textMuted }]}>
                          {isWin ? 'Won' : isLoss ? 'Lost' : 'Played'}
                        </Text>
                      </View>
                      {m.score_display !== 'Casual match' && m.score_display !== 'No score' && (
                        <Text style={s.scoreText}>{m.score_display}</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {history.length > 5 && (
                <TouchableOpacity style={s.showMore} onPress={() => setShowAll(v => !v)}>
                  <Text style={s.showMoreTxt}>{showAll ? 'Show less' : `Show all ${history.length} matches`}</Text>
                  <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Empty prompt ───────────────────────────────────────────────── */}
        {total === 0 && (
          <View style={s.emptyCard}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="bar-chart-outline" size={32} color={Colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No matches yet</Text>
            <Text style={s.emptySub}>Join a league or find a casual match to start building your stats.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('CasualMatch')} activeOpacity={0.85}>
              <Text style={s.emptyBtnText}>Find a Match</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.background },
  gradHeader:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
  gradBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  gradTitle:   { fontSize: FontSize.xxxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
  gradSub:     { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },

  // Hero
  heroCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.lg,
  },
  heroLabel: {
    fontSize: FontSize.xxs,
    fontFamily: Font.black,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroRecord: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, marginVertical: 4 },
  heroStatCol: { alignItems: 'center', gap: 4 },
  heroStatNum: { fontSize: FontSize.display, fontFamily: Font.black, color: '#fff', letterSpacing: -2 },
  heroStatLbl: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', fontFamily: Font.semibold },
  heroDash:    { alignItems: 'center' },
  heroDashText:{ fontSize: FontSize.xxxl, color: 'rgba(255,255,255,0.20)', fontFamily: Font.black },

  winBar: {
    flexDirection: 'row',
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  winBarFill:  { backgroundColor: Palette.green400 },
  lossBarFill: { backgroundColor: Palette.red400 },
  winBarLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.50)', fontFamily: Font.medium },

  // Metrics grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metricCard: {
    width: '47%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 6,
    ...Shadow.xs,
  },
  metricIcon:  { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: FontSize.xxl, fontFamily: Font.black, letterSpacing: -0.5 },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', fontFamily: Font.medium },

  // Generic card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
    gap: Spacing.md,
    ...Shadow.xs,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle:{ fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text, letterSpacing: -0.2 },
  cardSub:  { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Font.medium },
  cardLink: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: Font.semibold },

  // League chips
  leagueChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  leagueChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  leagueChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: Font.semibold },
  leagueChipTextActive: { color: Colors.primary },
  leagueSummary: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Achievements
  achieveProgress: { alignItems: 'flex-end', gap: 3 },
  achieveBar:  { width: 80, height: 6, borderRadius: 3, backgroundColor: Colors.backgroundAlt, overflow: 'hidden' },
  achieveFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  achievePct:  { fontSize: FontSize.xs, color: Colors.primary, fontFamily: Font.bold },
  achieveList: { gap: Spacing.sm },
  achieveRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.backgroundAlt },
  achieveRowLocked: { opacity: 0.50 },
  achieveIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  achieveNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs, marginBottom: 2 },
  achieveName: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text, flex: 1 },
  achieveNameLocked: { color: Colors.textMuted },
  achieveDesc: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 },
  unlockedPill: { backgroundColor: Palette.greenBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  unlockedPillText: { fontSize: FontSize.xxs, color: Palette.green600, fontFamily: Font.bold },
  lockedPill:   { backgroundColor: Colors.backgroundAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  lockedPillText:{ fontSize: FontSize.xxs, color: Colors.textMuted, fontFamily: Font.semibold },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill:{ height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressTxt: { fontSize: FontSize.xxs, color: Colors.textMuted, minWidth: 36, textAlign: 'right' },

  // History
  histEmpty:    { alignItems: 'center', gap: 8, paddingVertical: Spacing.xl },
  histEmptyTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  histRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  histRowDivider:{ borderBottomWidth: 1, borderBottomColor: Colors.separator },
  histDot:      { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  histNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  histOpponent: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text, flex: 1 },
  leagueMini:   { backgroundColor: Palette.blueBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  leagueMiniText:{ fontSize: FontSize.xxs, color: Palette.blue600, fontFamily: Font.bold },
  histMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  histMetaTxt:  { fontSize: FontSize.xs, color: Colors.textMuted },
  dot:          { fontSize: FontSize.xs, color: Colors.textMuted },
  histRight:    { alignItems: 'flex-end', gap: 3 },
  resultPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  resultPillText:{ fontSize: FontSize.xs, fontFamily: Font.bold },
  scoreText:    { fontSize: FontSize.xxs, color: Colors.textMuted, fontFamily: 'monospace' },

  // Match special badges (Straight Sets, Comeback, Bagel)
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  matchBadge: { backgroundColor: Palette.greenBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  matchBadgeTxt: { fontSize: 9, fontFamily: Font.extrabold, color: Palette.green600, letterSpacing: 0.3, textTransform: 'uppercase' },

  showMore:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.separator },
  showMoreTxt:  { fontSize: FontSize.sm, color: Colors.primary, fontFamily: Font.semibold },

  // Casual match summary
  casualSummaryRow: { flexDirection: 'row', gap: Spacing.sm },
  casualStatBox:    { flex: 1, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 2 },
  casualStatNum:    { fontSize: FontSize.xxl, fontFamily: Font.black, letterSpacing: -0.5 },
  casualStatLbl:    { fontSize: FontSize.xs, fontFamily: Font.semibold },

  // Casual match dashboard grid
  casualGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  casualCard: { flex: 1, minWidth: '45%', borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 4 },

  // Empty card
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadow.xs,
  },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.backgroundAlt, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  emptySub:   { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn:   { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: Radius.full, ...Shadow.orange },
  emptyBtnText:{ color: '#fff', fontFamily: Font.bold, fontSize: FontSize.md },
});
