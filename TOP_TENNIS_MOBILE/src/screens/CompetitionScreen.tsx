import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { useLeagueLeaderboard } from '@/hooks/useLeagueLeaderboard';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { PlayerProfileModal, PlayerSearchResult } from '@/components/ui/PlayerProfileModal';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

const MEDALS = ['🥇', '🥈', '🥉'];

export const CompetitionScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { registrations, loading: regsLoading, refetch: refetchRegs } = useLeagueRegistrations();
  const { player } = usePlayerProfile();
  const [selectedLeagueIdx, setSelectedLeagueIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);

  const activeRegs = registrations.filter(r => {
    const months = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
    return months < 3;
  });

  const currentLeague = activeRegs[selectedLeagueIdx];
  const { leaderboard, loading: lbLoading, currentUser, topPlayers } = useLeagueLeaderboard(currentLeague?.league_id);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchRegs();
    setRefreshing(false);
  };

  const myRank = currentUser?.rank;
  const myPoints = currentUser?.points ?? 0;
  const myWins = currentUser?.wins ?? 0;
  const myLosses = currentUser?.losses ?? 0;
  const myTotal = myWins + myLosses;
  const myWinRate = myTotal > 0 ? Math.round((myWins / myTotal) * 100) : 0;

  // Peer comparison — players within 2 skill levels
  const mySkill = player?.skill_level ?? 0;
  const peers = leaderboard.filter(p => !p.isCurrentUser && Math.abs(p.skill_level - mySkill) <= 1);
  const peersAheadCount = peers.filter(p => p.rank < (myRank ?? 999)).length;
  const peersBehindCount = peers.filter(p => p.rank > (myRank ?? 0)).length;

  // Points needed to reach next rank
  const nextRankPlayer = myRank && myRank > 1 ? leaderboard.find(p => p.rank === myRank - 1) : null;
  const pointsToNext = nextRankPlayer ? Math.max(0, nextRankPlayer.points - myPoints + 1) : 0;

  const loading = regsLoading || lbLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader title="Competition" subtitle="Rankings & standings" navigation={navigation} showBack />

      {regsLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : activeRegs.length === 0 ? (
        <View style={styles.noLeague}>
          <Ionicons name="trophy-outline" size={56} color={Colors.textMuted} />
          <Text style={styles.noLeagueTitle}>No Active Leagues</Text>
          <Text style={styles.noLeagueSub}>Join a league to see your competition rankings and standings.</Text>
          <TouchableOpacity style={styles.joinBtn} onPress={() => navigation.navigate('JoinLeague')}>
            <Text style={styles.joinBtnText}>Browse Leagues</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* League selector */}
          {activeRegs.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.leagueTabScroll} contentContainerStyle={styles.leagueTabContent}>
              {activeRegs.map((reg, i) => (
                <TouchableOpacity
                  key={reg.id}
                  style={[styles.leagueTab, selectedLeagueIdx === i && styles.leagueTabActive]}
                  onPress={() => setSelectedLeagueIdx(i)}
                >
                  <Text style={[styles.leagueTabText, selectedLeagueIdx === i && styles.leagueTabTextActive]} numberOfLines={1}>
                    {reg.league_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {lbLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.content}>
              {/* My rank hero */}
              {currentUser ? (
                <LinearGradient
                  colors={['#ea580c', '#f97316']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.rankHero}
                >
                  <View style={styles.rankHeroLeft}>
                    <Text style={styles.rankHeroNum}>#{myRank}</Text>
                    <View>
                      <Text style={styles.rankHeroLabel}>Your Rank</Text>
                      <Text style={styles.rankHeroSub}>out of {leaderboard.length} players</Text>
                    </View>
                  </View>
                  <View style={styles.rankHeroStats}>
                    <View style={styles.rankHeroStat}>
                      <Text style={styles.rankHeroStatNum}>{myPoints}</Text>
                      <Text style={styles.rankHeroStatLabel}>Points</Text>
                    </View>
                    <View style={styles.rankHeroStatDivider} />
                    <View style={styles.rankHeroStat}>
                      <Text style={styles.rankHeroStatNum}>{myWinRate}%</Text>
                      <Text style={styles.rankHeroStatLabel}>Win Rate</Text>
                    </View>
                    <View style={styles.rankHeroStatDivider} />
                    <View style={styles.rankHeroStat}>
                      <Text style={styles.rankHeroStatNum}>{myWins}W</Text>
                      <Text style={styles.rankHeroStatLabel}>{myLosses}L</Text>
                    </View>
                  </View>
                  {pointsToNext > 0 && (
                    <View style={styles.rankHeroProgress}>
                      <Ionicons name="trending-up-outline" size={14} color="rgba(255,255,255,0.9)" />
                      <Text style={styles.rankHeroProgressText}>
                        {pointsToNext} pts to reach #{myRank! - 1}
                      </Text>
                    </View>
                  )}
                  {currentUser.playoff_eligible && (
                    <View style={styles.playoffEligibleBadge}>
                      <Ionicons name="medal" size={14} color="#f59e0b" />
                      <Text style={styles.playoffEligibleText}>Playoff Eligible</Text>
                    </View>
                  )}
                </LinearGradient>
              ) : (
                <View style={styles.notRankedCard}>
                  <Ionicons name="information-circle-outline" size={24} color={Colors.textMuted} />
                  <Text style={styles.notRankedText}>Play matches to appear in the rankings</Text>
                </View>
              )}

              {/* Peer comparison */}
              {peers.length > 0 && (
                <View style={styles.peerCard}>
                  <Text style={styles.peerTitle}>Peer Comparison</Text>
                  <Text style={styles.peerSub}>Players at your skill level (±1)</Text>
                  <View style={styles.peerStats}>
                    <View style={styles.peerStat}>
                      <Text style={styles.peerStatNum}>{peersAheadCount}</Text>
                      <Text style={styles.peerStatLabel}>Peers ahead</Text>
                    </View>
                    <View style={styles.peerStatDivider} />
                    <View style={styles.peerStat}>
                      <Text style={styles.peerStatNum}>{peers.length}</Text>
                      <Text style={styles.peerStatLabel}>Total peers</Text>
                    </View>
                    <View style={styles.peerStatDivider} />
                    <View style={styles.peerStat}>
                      <Text style={styles.peerStatNum}>{peersBehindCount}</Text>
                      <Text style={styles.peerStatLabel}>Peers behind</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Top 10 leaderboard */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {currentLeague?.league_name} — Top {Math.min(10, leaderboard.length)}
                </Text>
                {leaderboard.length === 0 ? (
                  <View style={styles.emptyLb}>
                    <Ionicons name="bar-chart-outline" size={36} color={Colors.textMuted} />
                    <Text style={styles.emptyLbText}>No standings yet. Play matches to appear here.</Text>
                  </View>
                ) : (
                  leaderboard.slice(0, 10).map((p, index) => {
                    const winRate = p.total_matches > 0 ? Math.round((p.wins / p.total_matches) * 100) : 0;
                    const isTop3 = index < 3;
                    return (
                      <TouchableOpacity
                        key={p.user_id}
                        style={[styles.lbRow, p.isCurrentUser && styles.lbRowSelf]}
                        onPress={() => {
                          if (!p.isCurrentUser) {
                            setSelectedPlayer({
                              id: p.user_id,
                              first_name: p.name.split(' ')[0] || p.name,
                              last_name: p.name.split(' ').slice(1).join(' ') || '',
                              wins: p.wins,
                              losses: p.losses,
                              profile_picture_url: p.profile_picture_url,
                            });
                          }
                        }}
                        activeOpacity={p.isCurrentUser ? 1 : 0.7}
                      >
                        {/* Rank */}
                        <View style={[styles.lbRank, p.isCurrentUser ? styles.lbRankSelf : isTop3 ? styles.lbRankTop : styles.lbRankDefault]}>
                          {isTop3 && !p.isCurrentUser
                            ? <Text style={{ fontSize: 16 }}>{MEDALS[index]}</Text>
                            : <Text style={[styles.lbRankText, p.isCurrentUser && { color: '#fff' }]}>{index + 1}</Text>
                          }
                        </View>

                        {/* Avatar + name */}
                        <Avatar
                          name={p.name}
                          size={38}
                          imageUrl={p.profile_picture_url}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={styles.lbNameRow}>
                            <Text style={[styles.lbName, p.isCurrentUser && { color: Colors.primary }]} numberOfLines={1}>
                              {p.name}
                            </Text>
                            {p.isCurrentUser && (
                              <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>
                            )}
                          </View>
                          <View style={styles.lbMeta}>
                            <Text style={styles.lbMetaText}>{p.wins}W – {p.losses}L  •  {winRate}%</Text>
                            <View style={styles.divPill}>
                              <Text style={styles.divPillText} numberOfLines={1}>{p.division_name}</Text>
                            </View>
                          </View>
                        </View>

                        {/* Points */}
                        <View style={styles.lbPoints}>
                          <Text style={styles.lbPointsNum}>{p.points}</Text>
                          <Text style={styles.lbPointsLabel}>pts</Text>
                          {p.playoff_eligible && (
                            <View style={styles.playoffDot} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              {/* My position if outside top 10 */}
              {currentUser && myRank && myRank > 10 && (
                <View style={styles.myPositionCard}>
                  <Text style={styles.myPositionLabel}>Your Position</Text>
                  <View style={styles.lbRow}>
                    <View style={[styles.lbRank, styles.lbRankSelf]}>
                      <Text style={[styles.lbRankText, { color: '#fff' }]}>{myRank}</Text>
                    </View>
                    <Avatar name={player?.name || 'You'} size={38} imageUrl={player?.profile_picture_url} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lbName, { color: Colors.primary }]}>{player?.name || 'You'}</Text>
                      <Text style={styles.lbMetaText}>{myWins}W – {myLosses}L  •  {myWinRate}%</Text>
                    </View>
                    <View style={styles.lbPoints}>
                      <Text style={styles.lbPointsNum}>{myPoints}</Text>
                      <Text style={styles.lbPointsLabel}>pts</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* View full league standings CTA */}
              <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('MyLeagues')}>
                <Ionicons name="trophy-outline" size={18} color={Colors.primary} />
                <Text style={styles.viewAllText}>View Full League Details</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      <PlayerProfileModal
        visible={!!selectedPlayer}
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },

  noLeague: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  noLeagueTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  noLeagueSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  joinBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  joinBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.md },

  leagueTabScroll: { flexGrow: 0, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  leagueTabContent: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  leagueTab: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background },
  leagueTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  leagueTabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  leagueTabTextActive: { color: '#fff', fontWeight: FontWeight.semibold },

  rankHero: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md },
  rankHeroLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rankHeroNum: { fontSize: 48, fontWeight: FontWeight.bold, color: '#fff', lineHeight: 52 },
  rankHeroLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#fff' },
  rankHeroSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  rankHeroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.lg, padding: Spacing.md },
  rankHeroStat: { flex: 1, alignItems: 'center', gap: 2 },
  rankHeroStatNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#fff' },
  rankHeroStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)' },
  rankHeroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 4 },
  rankHeroProgress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  rankHeroProgressText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.95)', fontWeight: FontWeight.semibold },
  playoffEligibleBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  playoffEligibleText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.bold },

  notRankedCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  notRankedText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },

  peerCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  peerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  peerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: -8 },
  peerStats: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md },
  peerStat: { flex: 1, alignItems: 'center', gap: 2 },
  peerStatNum: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  peerStatLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  peerStatDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },

  emptyLb: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyLbText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },

  lbRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  lbRowSelf: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary, borderWidth: 2 },
  lbRank: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  lbRankSelf: { backgroundColor: Colors.primary },
  lbRankTop: { backgroundColor: '#f59e0b' },
  lbRankDefault: { backgroundColor: Colors.borderLight },
  lbRankText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textMuted },
  lbNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  lbName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1 },
  youBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  youBadgeText: { fontSize: 10, color: '#fff', fontWeight: FontWeight.bold },
  lbMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  lbMetaText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  divPill: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: Radius.full },
  divPillText: { fontSize: 9, color: Colors.textMuted, fontWeight: FontWeight.medium },
  lbPoints: { alignItems: 'center', gap: 2 },
  lbPointsNum: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  lbPointsLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  playoffDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },

  myPositionCard: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary, gap: Spacing.sm },
  myPositionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primaryDark, textTransform: 'uppercase', letterSpacing: 0.5 },

  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  viewAllText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
});
