import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { useAchievements } from '@/hooks/useAchievements';
import { useMatchHistory } from '@/hooks/useMatchHistory';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';
import { format } from 'date-fns';

export const PerformanceScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { player, refetch } = usePlayerProfile();
  const { registrations } = useLeagueRegistrations();
  const { history, loading: historyLoading } = useMatchHistory(15);
  const { achievements, unlockedCount, totalCount, completionPercentage } = useAchievements([], player);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('all');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const wins = player?.wins ?? 0;
  const losses = player?.losses ?? 0;
  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const streak = player?.current_streak ?? 0;
  const bestStreak = player?.best_streak ?? 0;

  const displayedHistory = showAllHistory ? history : history.slice(0, 5);

  const metrics = [
    { label: 'Total Matches', value: total, icon: 'tennisball-outline', color: Colors.accent, bg: Colors.accentLight },
    { label: 'Win Rate', value: `${winRate}%`, icon: 'trophy-outline', color: Colors.success, bg: Colors.successLight },
    { label: 'Win Streak', value: streak, icon: 'flame-outline', color: Colors.primary, bg: Colors.primaryLight },
    { label: 'Best Streak', value: bestStreak, icon: 'ribbon-outline', color: '#8B5CF6', bg: '#EDE9FE' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="My Performance" subtitle="Stats & analytics" navigation={navigation} showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >

        <View style={styles.content}>
          {/* Metrics Grid */}
          <View style={styles.metricsGrid}>
            {metrics.map(m => (
              <View key={m.label} style={[styles.metricCard, { backgroundColor: m.bg }]}>
                <View style={[styles.metricIcon, { backgroundColor: m.color + '25' }]}>
                  <Ionicons name={m.icon as any} size={22} color={m.color} />
                </View>
                <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>

          {/* Win/Loss Bar */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Win / Loss Record</Text>
            <View style={styles.wlRow}>
              <View style={styles.wlItem}>
                <Text style={[styles.wlNum, { color: Colors.success }]}>{wins}</Text>
                <Text style={styles.wlLabel}>Wins</Text>
              </View>
              <View style={styles.wlBarWrap}>
                <View style={styles.wlBar}>
                  <View style={[styles.wlFillWin, { flex: wins || 0.01 }]} />
                  <View style={[styles.wlFillLoss, { flex: losses || 0.01 }]} />
                </View>
                <Text style={styles.wlRate}>{winRate}% Win Rate</Text>
              </View>
              <View style={styles.wlItem}>
                <Text style={[styles.wlNum, { color: Colors.error }]}>{losses}</Text>
                <Text style={styles.wlLabel}>Losses</Text>
              </View>
            </View>
          </View>

          {/* Career Summary */}
          <View style={styles.careerRow}>
            <View style={styles.careerCard}>
              <Text style={styles.careerNum}>{total}</Text>
              <Text style={styles.careerLabel}>Career Matches</Text>
            </View>
            <View style={styles.careerCard}>
              <Text style={styles.careerNum}>{winRate}%</Text>
              <Text style={styles.careerLabel}>Career Win Rate</Text>
            </View>
            <View style={styles.careerCard}>
              <Text style={styles.careerNum}>{bestStreak}</Text>
              <Text style={styles.careerLabel}>Best Streak</Text>
            </View>
          </View>

          {/* League Filter */}
          {registrations.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>League Performance</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.leagueFilter}>
                <TouchableOpacity
                  style={[styles.leagueChip, selectedLeagueId === 'all' && styles.leagueChipActive]}
                  onPress={() => setSelectedLeagueId('all')}
                >
                  <Text style={[styles.leagueChipText, selectedLeagueId === 'all' && styles.leagueChipTextActive]}>All</Text>
                </TouchableOpacity>
                {registrations.map(r => (
                  <TouchableOpacity
                    key={r.league_id}
                    style={[styles.leagueChip, selectedLeagueId === r.league_id && styles.leagueChipActive]}
                    onPress={() => setSelectedLeagueId(r.league_id)}
                  >
                    <Text style={[styles.leagueChipText, selectedLeagueId === r.league_id && styles.leagueChipTextActive]} numberOfLines={1}>
                      {r.league_name || 'League'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.leagueStats}>
                <Text style={styles.leagueStatText}>Registered in {registrations.length} league{registrations.length !== 1 ? 's' : ''}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('MyLeagues')}>
                  <Text style={styles.leagueLink}>View Leagues →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Achievements — 9-achievement system with progress bars */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Achievements</Text>
                <Text style={styles.cardSub}>{unlockedCount} / {totalCount} unlocked</Text>
              </View>
              <View style={styles.achieveProgressWrap}>
                <View style={styles.achieveProgressBar}>
                  <View style={[styles.achieveProgressFill, { width: `${completionPercentage}%` as any }]} />
                </View>
                <Text style={styles.achieveProgressPct}>{completionPercentage}%</Text>
              </View>
            </View>
            <View style={styles.achieveList}>
              {achievements.map(a => (
                <View key={a.id} style={[styles.achieveRow, !a.unlocked && styles.achieveRowLocked]}>
                  <View style={[styles.achieveIconWrap, { backgroundColor: a.unlocked ? a.bgColor : Colors.borderLight }]}>
                    <Ionicons name={a.icon as any} size={20} color={a.unlocked ? a.color : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.achieveNameRow}>
                      <Text style={[styles.achieveName, !a.unlocked && { color: Colors.textMuted }]}>{a.title}</Text>
                      {a.unlocked
                        ? <View style={styles.unlockedBadge}><Text style={styles.unlockedBadgeText}>{a.date || 'Achieved'}</Text></View>
                        : <View style={styles.lockedBadge}><Text style={styles.lockedBadgeText}>Locked</Text></View>
                      }
                    </View>
                    <Text style={styles.achieveDesc}>{a.description}</Text>
                    {!a.unlocked && a.progress !== undefined && a.target !== undefined && (
                      <View style={styles.progressWrap}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${Math.round((a.progress / a.target) * 100)}%` as any }]} />
                        </View>
                        <Text style={styles.progressText}>{a.progress} / {a.target}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Match History */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Match History</Text>
              <Text style={styles.cardSub}>Most recent first</Text>
            </View>
            {historyLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : history.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Ionicons name="calendar-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.historyEmptyText}>No match history yet</Text>
              </View>
            ) : (
              <>
                {displayedHistory.map((m, i) => (
                  <View key={m.id} style={[styles.historyRow, i < displayedHistory.length - 1 && styles.historyRowBorder]}>
                    <View style={[styles.historyDot, { backgroundColor: m.result === 'win' ? Colors.success : m.result === 'loss' ? Colors.error : Colors.textMuted }]} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.historyNameRow}>
                        <Text style={styles.historyOpponent} numberOfLines={1}>vs {m.opponent_name}</Text>
                        {m.is_league_match && (
                          <View style={styles.leaguePill}><Text style={styles.leaguePillText}>League</Text></View>
                        )}
                      </View>
                      <View style={styles.historyMeta}>
                        <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                        <Text style={styles.historyMetaText}>{format(new Date(m.match_date), 'MMM d, yyyy')}</Text>
                        {m.court_location && (
                          <><Text style={styles.historyMetaDot}>·</Text><Text style={styles.historyMetaText} numberOfLines={1}>{m.court_location}</Text></>
                        )}
                      </View>
                    </View>
                    <View style={styles.historyRight}>
                      <View style={[styles.resultBadge, { backgroundColor: m.result === 'win' ? Colors.successLight : m.result === 'loss' ? Colors.errorLight : Colors.borderLight }]}>
                        <Text style={[styles.resultBadgeText, { color: m.result === 'win' ? Colors.success : m.result === 'loss' ? Colors.error : Colors.textMuted }]}>
                          {m.result === 'win' ? 'Won' : m.result === 'loss' ? 'Lost' : 'Played'}
                        </Text>
                      </View>
                      {m.score_display !== 'Casual match' && m.score_display !== 'No score' && (
                        <Text style={styles.scoreText}>{m.score_display}</Text>
                      )}
                    </View>
                  </View>
                ))}
                {history.length > 5 && (
                  <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllHistory(v => !v)}>
                    <Text style={styles.showMoreText}>{showAllHistory ? 'Show less' : `Show all ${history.length} matches`}</Text>
                    <Ionicons name={showAllHistory ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* No Data Prompt */}
          {total === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.emptySub}>Join a league or find a casual match to start tracking your performance.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CasualMatch')}>
                <Text style={styles.emptyBtnText}>Find a Match</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.lg },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metricCard: { width: '47%', borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 6 },
  metricIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: Spacing.md },
  cardSub: { fontSize: FontSize.sm, color: Colors.textMuted },

  wlRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  wlItem: { alignItems: 'center', minWidth: 40 },
  wlNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold },
  wlLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  wlBarWrap: { flex: 1, gap: 6 },
  wlBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  wlFillWin: { backgroundColor: Colors.success },
  wlFillLoss: { backgroundColor: Colors.error },
  wlRate: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },

  leagueFilter: { marginBottom: Spacing.md },
  leagueChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, marginRight: Spacing.sm, backgroundColor: Colors.surface },
  leagueChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  leagueChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  leagueChipTextActive: { color: Colors.primaryDark, fontWeight: FontWeight.semibold },
  leagueStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leagueStatText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  leagueLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  achieveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  achieveCard: { width: '47%', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 6, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, position: 'relative' },
  achieveCardLocked: { opacity: 0.5 },
  achieveIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  achieveLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center' },
  achieveLabelLocked: { color: Colors.textMuted },
  achieveDescCentered: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  achieveBadge: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.md },

  // Career summary row
  careerRow: { flexDirection: 'row', gap: Spacing.sm },
  careerCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border },
  careerNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  careerLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },

  // Achievements — new list style
  cardTitleNoMargin: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  achieveProgressWrap: { alignItems: 'flex-end', gap: 4 },
  achieveProgressBar: { width: 80, height: 6, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  achieveProgressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  achieveProgressPct: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  achieveList: { gap: Spacing.sm },
  achieveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  achieveRowLocked: { opacity: 0.55 },
  achieveIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  achieveNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs },
  achieveName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1 },
  achieveDesc: { fontSize: FontSize.xs, color: Colors.textMuted, flexShrink: 1 },
  unlockedBadge: { backgroundColor: Colors.successLight, paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: Radius.full },
  unlockedBadgeText: { fontSize: 10, color: Colors.success, fontWeight: FontWeight.semibold },
  lockedBadge: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: Radius.full },
  lockedBadgeText: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.medium },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: { fontSize: 10, color: Colors.textMuted, minWidth: 36, textAlign: 'right' },

  // Match history
  historyEmpty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  historyEmptyText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  historyDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  historyNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  historyOpponent: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1 },
  leaguePill: { backgroundColor: '#dbeafe', paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: Radius.full },
  leaguePillText: { fontSize: 10, color: '#1d4ed8', fontWeight: FontWeight.semibold },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  historyMetaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  historyMetaDot: { fontSize: FontSize.xs, color: Colors.textMuted },
  historyRight: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  resultBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  resultBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  scoreText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: 'monospace' },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingTop: Spacing.sm, marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  showMoreText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
});
