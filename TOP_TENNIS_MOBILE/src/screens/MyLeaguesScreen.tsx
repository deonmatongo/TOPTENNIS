import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { useLeagueMatches } from '@/hooks/useLeagueMatches';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { MatchScoringModal } from '@/components/ui/MatchScoringModal';
import { ScheduleLeagueMatchModal } from '@/components/ui/ScheduleLeagueMatchModal';
import { ScoreConfirmationModal } from '@/components/ui/ScoreConfirmationModal';
import { PlayerProfileModal, PlayerSearchResult } from '@/components/ui/PlayerProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import type { LeagueMatch } from '@/hooks/useLeagueMatches';
import { useDivisionLeaderboard } from '@/hooks/useDivisionLeaderboard';
import { useLeagueLeaderboard } from '@/hooks/useLeagueLeaderboard';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '@/theme/colors';

type Tab = 'matches' | 'division' | 'league' | 'playoffs';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'matches', label: 'Matches', icon: 'calendar-outline' },
  { key: 'division', label: 'Division', icon: 'bar-chart-outline' },
  { key: 'league', label: 'League', icon: 'trophy-outline' },
  { key: 'playoffs', label: 'Playoffs', icon: 'medal-outline' },
];

const getLeagueStatus = (reg: any) => {
  const months = (Date.now() - new Date(reg.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return months < 3 ? 'In Progress' : 'Completed';
};

const LeagueDetailView: React.FC<{ registration: any; onBack: () => void; navigation: any }> = ({ registration, onBack, navigation }) => {
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [divisionInfo, setDivisionInfo] = useState<any>(null);
  const [scoringMatch, setScoringMatch] = useState<LeagueMatch | null>(null);
  const [confirmMatch, setConfirmMatch] = useState<LeagueMatch | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedLeaderboardPlayer, setSelectedLeaderboardPlayer] = useState<PlayerSearchResult | null>(null);
  const { user } = useAuth();
  const { player } = usePlayerProfile();
  const { assignments } = useDivisionAssignments();
  const divisionId = assignments.find(a => a.league_registration_id === registration.id)?.division_id;
  const { userMatches, playoffMatches, loading: matchesLoading, submitScore, scheduleMatch } = useLeagueMatches(divisionId);
  const { leaderboard, loading: leaderboardLoading } = useDivisionLeaderboard(divisionId);
  const { leaderboard: leagueLeaderboard, loading: leagueLeaderboardLoading, currentUser: leagueCurrentUser } = useLeagueLeaderboard(registration.league_id);

  useEffect(() => {
    if (!divisionId) return;
    supabase.from('divisions').select('id, tournament_status, division_name').eq('id', divisionId).single()
      .then(({ data }) => { if (data) setDivisionInfo(data); });
  }, [divisionId]);

  const status = getLeagueStatus(registration);

  const renderMatches = () => {
    if (matchesLoading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />;
    const isTournamentActive = divisionInfo?.tournament_status === 'active';
    return (
      <View style={styles.tabContent}>
        {/* Schedule new match button */}
        <TouchableOpacity style={styles.scheduleNewBtn} onPress={() => setShowSchedule(true)}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.scheduleNewBtnText}>Schedule a Match</Text>
        </TouchableOpacity>

        {isTournamentActive && (
          <View style={styles.tournamentBanner}>
            <View style={styles.tournamentDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tournamentTitle}>Active Tournament</Text>
              <Text style={styles.tournamentSub}>{divisionInfo?.division_name}</Text>
            </View>
            <View style={styles.inProgressBadge}><Text style={styles.inProgressText}>In Progress</Text></View>
          </View>
        )}

        {userMatches.length === 0 ? (
          <View style={styles.tabEmpty}>
            <Ionicons name="time-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.tabEmptyTitle}>No matches yet</Text>
            <Text style={styles.tabEmptySub}>Schedule a match with a division opponent above to get started.</Text>
          </View>
        ) : (
          userMatches.map(match => {
            const isWin = match.result === 'win';
            const isLoss = match.result === 'loss';
            const isPending = match.status === 'pending';
            const isScheduled = match.status === 'scheduled';
            const isCompleted = match.status === 'completed';
            const score = match.score as any;
            const hasScore = score?.sets && score.sets.length > 0;
            return (
              <View key={match.id} style={[
                styles.matchCard,
                isWin && styles.matchCardWin,
                isLoss && styles.matchCardLoss,
                isTournamentActive && isScheduled && styles.matchCardActive,
              ]}>
                <View style={styles.matchCardTop}>
                  <View style={[styles.matchIcon, isWin ? styles.matchIconWin : isLoss ? styles.matchIconLoss : styles.matchIconPending]}>
                    <Ionicons name={isWin ? 'trophy' : isLoss ? 'person' : 'time-outline'} size={18} color={isWin ? Colors.success : isLoss ? Colors.error : Colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchOpponent}>vs {match.opponent_name}</Text>
                    <View style={styles.matchBadgeRow}>
                      <View style={[styles.resultBadge, isWin ? styles.resultBadgeWin : isLoss ? styles.resultBadgeLoss : styles.resultBadgePending]}>
                        <Text style={[styles.resultBadgeText, { color: isWin ? Colors.success : isLoss ? Colors.error : Colors.info }]}>
                          {isWin ? 'Victory' : isLoss ? 'Defeat' : isPending ? 'Pending' : isScheduled ? 'Scheduled' : 'Upcoming'}
                        </Text>
                      </View>
                      {match.is_playoff && (
                        <View style={styles.playoffMatchBadge}>
                          <Text style={styles.playoffMatchBadgeText}>Playoff</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.matchMeta}>
                  {match.scheduled_date && (
                    <View style={styles.matchMetaItem}>
                      <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.matchMetaText}>
                        {new Date(match.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                  )}
                  {match.scheduled_time && (
                    <View style={styles.matchMetaItem}>
                      <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.matchMetaText}>{match.scheduled_time.slice(0, 5)}</Text>
                    </View>
                  )}
                  {match.court_location && (
                    <View style={styles.matchMetaItem}>
                      <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.matchMetaText}>{match.court_location}</Text>
                    </View>
                  )}
                </View>

                {hasScore && (
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreLabel}>Final Score</Text>
                    <Text style={styles.scoreValue}>
                      {score.sets.map((s: any, i: number) => `${s.p1}-${s.p2}`).join(', ')}
                    </Text>
                  </View>
                )}

                {/* Action buttons */}
                {(() => {
                  // Match where opponent submitted score — current user needs to confirm
                  const awaitingConfirmation = isCompleted && match.winner_id && match.score &&
                    match.score?.reported_by && match.score.reported_by !== user?.id &&
                    !match.score?.confirmed_by;
                  // Match played but no score yet — current user should report
                  const canReport = (isPending || isScheduled) ||
                    (isCompleted && match.needsScoreReport);
                  if (!awaitingConfirmation && !canReport) return null;
                  return (
                    <View style={styles.matchActions}>
                      {awaitingConfirmation && (
                        <TouchableOpacity
                          style={[styles.matchActionBtn, { borderColor: Colors.success }]}
                          onPress={() => setConfirmMatch(match)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                          <Text style={[styles.matchActionBtnText, { color: Colors.success }]}>Confirm Score</Text>
                        </TouchableOpacity>
                      )}
                      {canReport && !awaitingConfirmation && (
                        <TouchableOpacity
                          style={[styles.matchActionBtn, styles.matchActionBtnOrange]}
                          onPress={() => setScoringMatch(match)}
                        >
                          <Ionicons name="trophy" size={14} color="#fff" />
                          <Text style={[styles.matchActionBtnText, { color: '#fff' }]}>Report Score</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })()}
              </View>
            );
          })
        )}
      </View>
    );
  };

  const renderDivision = () => {
    if (leaderboardLoading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />;
    if (leaderboard.length === 0) return (
      <View style={styles.tabEmpty}>
        <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.tabEmptyTitle}>No standings yet</Text>
        <Text style={styles.tabEmptySub}>Division standings will appear once matches are played.</Text>
      </View>
    );
    return (
      <View style={styles.tabContent}>
        <View style={styles.standingsHeader}>
          <Text style={styles.standingsTitle}>{divisionInfo?.division_name || 'Division'} Standings</Text>
          <Text style={styles.standingsSub}>Rankings and playoff status</Text>
        </View>
        {leaderboard.map((player, index) => {
          const winRate = player.total_matches > 0 ? Math.round((player.wins / player.total_matches) * 100) : 0;
          const isTop3 = index < 3;
          return (
            <TouchableOpacity
              key={player.user_id}
              style={[styles.standingRow, player.isCurrentUser && styles.standingRowSelf]}
              onPress={() => {
                if (!player.isCurrentUser) {
                  setSelectedLeaderboardPlayer({
                    id: player.user_id,
                    first_name: player.name.split(' ')[0] || player.name,
                    last_name: player.name.split(' ').slice(1).join(' ') || '',
                    wins: player.wins,
                    losses: player.losses,
                  });
                }
              }}
              activeOpacity={player.isCurrentUser ? 1 : 0.7}
            >
              <View style={[styles.rankCircle, player.isCurrentUser ? styles.rankCircleSelf : isTop3 ? styles.rankCircleTop : styles.rankCircleDefault]}>
                {isTop3 && !player.isCurrentUser
                  ? <Text style={{ fontSize: 14 }}>🏆</Text>
                  : <Text style={[styles.rankText, player.isCurrentUser && { color: '#fff' }]}>{index + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.standingNameRow}>
                  <Text style={[styles.standingName, player.isCurrentUser && { color: Colors.primary }]}>{player.name}</Text>
                  {player.isCurrentUser && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
                </View>
                <Text style={styles.standingStats}>{player.wins}W – {player.losses}L  •  {winRate}%  •  {player.points} pts</Text>
              </View>
              <View style={styles.standingRight}>
                {player.playoff_eligible
                  ? <View style={styles.playoffBadge}><Ionicons name="medal-outline" size={11} color="#fff" /><Text style={styles.playoffBadgeText}>Playoff</Text></View>
                  : <Text style={styles.matchesNeeded}>{player.matches_required - player.matches_completed} more needed</Text>}
                {!player.isCurrentUser && (
                  <TouchableOpacity style={styles.scheduleSmallBtn} onPress={() => navigation.navigate('Schedule')}>
                    <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
                    <Text style={styles.scheduleSmallBtnText}>Schedule</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderLeagueStandings = () => {
    if (leagueLeaderboardLoading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />;
    if (leagueLeaderboard.length === 0) return (
      <View style={styles.tabEmpty}>
        <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.tabEmptyTitle}>No League Standings Yet</Text>
        <Text style={styles.tabEmptySub}>League-wide rankings will appear once players start competing across all divisions.</Text>
      </View>
    );

    const myRank = leagueCurrentUser?.rank;
    const myPoints = leagueCurrentUser?.points ?? 0;
    const nextPlayer = myRank && myRank > 1 ? leagueLeaderboard[myRank - 2] : null;
    const pointsGap = nextPlayer ? nextPlayer.points - myPoints : 0;

    return (
      <View style={styles.tabContent}>
        {/* My position banner */}
        {leagueCurrentUser && (
          <View style={styles.myRankBanner}>
            <View style={styles.myRankLeft}>
              <Text style={styles.myRankNum}>#{myRank}</Text>
              <View>
                <Text style={styles.myRankLabel}>Your League Rank</Text>
                <Text style={styles.myRankPts}>{myPoints} pts  •  {leagueCurrentUser.wins}W – {leagueCurrentUser.losses}L</Text>
              </View>
            </View>
            {pointsGap > 0 && (
              <View style={styles.myRankGap}>
                <Ionicons name="trending-up-outline" size={14} color={Colors.primary} />
                <Text style={styles.myRankGapText}>{pointsGap} pts to #{myRank! - 1}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.standingsHeader}>
          <Text style={styles.standingsTitle}>{registration.league_name} — All Divisions</Text>
          <Text style={styles.standingsSub}>{leagueLeaderboard.length} players competing</Text>
        </View>

        {leagueLeaderboard.map((p, index) => {
          const winRate = p.total_matches > 0 ? Math.round((p.wins / p.total_matches) * 100) : 0;
          const isTop3 = index < 3;
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <TouchableOpacity
              key={p.user_id}
              style={[styles.standingRow, p.isCurrentUser && styles.standingRowSelf]}
              onPress={() => {
                if (!p.isCurrentUser) {
                  setSelectedLeaderboardPlayer({
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
              <View style={[styles.rankCircle, p.isCurrentUser ? styles.rankCircleSelf : isTop3 ? styles.rankCircleTop : styles.rankCircleDefault]}>
                {isTop3 && !p.isCurrentUser
                  ? <Text style={{ fontSize: 14 }}>{medals[index]}</Text>
                  : <Text style={[styles.rankText, p.isCurrentUser && { color: '#fff' }]}>{index + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.standingNameRow}>
                  <Text style={[styles.standingName, p.isCurrentUser && { color: Colors.primary }]} numberOfLines={1}>{p.name}</Text>
                  {p.isCurrentUser && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={styles.standingStats}>{p.wins}W – {p.losses}L  •  {winRate}%</Text>
                  <View style={styles.divisionPill}>
                    <Text style={styles.divisionPillText} numberOfLines={1}>{p.division_name}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.standingRight}>
                <Text style={styles.pointsValue}>{p.points}</Text>
                <Text style={styles.pointsLabel}>pts</Text>
                {p.playoff_eligible && (
                  <View style={styles.playoffBadge}>
                    <Ionicons name="medal-outline" size={10} color="#fff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderPlayoffs = () => {
    if (matchesLoading) return <ActivityIndicator color={Colors.primary} style={{ marginTop: 32 }} />;
    if (playoffMatches.length === 0) return (
      <View style={styles.tabEmpty}>
        <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.tabEmptyTitle}>Playoff Bracket</Text>
        <Text style={styles.tabEmptySub}>
          {divisionInfo?.tournament_status === 'active'
            ? 'Playoff matches will appear here once the bracket is generated.'
            : 'The playoff bracket will be generated automatically once the regular season concludes.'}
        </Text>
        {divisionInfo?.tournament_status === 'active' && (
          <View style={styles.activeTournamentNote}>
            <View style={styles.tournamentDot} />
            <Text style={styles.activeTournamentText}>Tournament is active — playoffs coming soon!</Text>
          </View>
        )}
      </View>
    );

    // Group by round
    const rounds = playoffMatches.reduce((acc: Record<number, typeof playoffMatches>, m) => {
      const r = m.round_number || 1;
      if (!acc[r]) acc[r] = [];
      acc[r].push(m);
      return acc;
    }, {});

    return (
      <View style={styles.tabContent}>
        <View style={styles.playoffHeader}>
          <Ionicons name="trophy" size={20} color="#f59e0b" />
          <Text style={styles.playoffHeaderTitle}>Playoff Bracket</Text>
          {divisionInfo?.tournament_status === 'active' && (
            <View style={styles.inProgressBadge}><Text style={styles.inProgressText}>Active</Text></View>
          )}
        </View>
        {Object.keys(rounds).sort((a, b) => Number(a) - Number(b)).map(roundKey => {
          const roundNum = Number(roundKey);
          const roundLabel = roundNum === 1 ? 'Round 1' : roundNum === 2 ? 'Quarterfinals' : roundNum === 3 ? 'Semifinals' : roundNum === 4 ? 'Final' : `Round ${roundNum}`;
          return (
            <View key={roundKey} style={styles.playoffRound}>
              <Text style={styles.playoffRoundLabel}>{roundLabel}</Text>
              {rounds[roundNum].map(match => {
                const isWin = match.result === 'win';
                const isLoss = match.result === 'loss';
                const isCompleted = match.status === 'completed';
                const score = match.score as any;
                return (
                  <View key={match.id} style={[styles.playoffMatchCard, isWin && styles.matchCardWin, isLoss && styles.matchCardLoss]}>
                    <View style={styles.playoffMatchPlayers}>
                      <View style={[styles.playoffPlayer, match.winner_id === match.player1_id && styles.playoffPlayerWinner]}>
                        <Text style={styles.playoffPlayerName} numberOfLines={1}>{match.player1_name}</Text>
                        {match.winner_id === match.player1_id && <Ionicons name="trophy" size={14} color="#f59e0b" />}
                      </View>
                      <Text style={styles.playoffVs}>vs</Text>
                      <View style={[styles.playoffPlayer, match.winner_id === match.player2_id && styles.playoffPlayerWinner]}>
                        <Text style={styles.playoffPlayerName} numberOfLines={1}>{match.player2_name}</Text>
                        {match.winner_id === match.player2_id && <Ionicons name="trophy" size={14} color="#f59e0b" />}
                      </View>
                    </View>
                    {score?.sets && (
                      <Text style={styles.playoffScore}>
                        {score.sets.map((s: any) => `${s.p1}-${s.p2}`).join(', ')}
                      </Text>
                    )}
                    <View style={styles.playoffMatchMeta}>
                      {match.scheduled_date && (
                        <View style={styles.matchMetaItem}>
                          <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                          <Text style={styles.matchMetaText}>{new Date(match.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                        </View>
                      )}
                      {match.court_location && (
                        <View style={styles.matchMetaItem}>
                          <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                          <Text style={styles.matchMetaText}>{match.court_location}</Text>
                        </View>
                      )}
                    </View>
                    {match.isUserMatch && (match.status === 'pending' || match.status === 'scheduled') && (
                      <TouchableOpacity
                        style={[styles.matchActionBtn, styles.matchActionBtnOrange]}
                        onPress={() => setScoringMatch(match)}
                      >
                        <Ionicons name="trophy" size={14} color="#fff" />
                        <Text style={[styles.matchActionBtnText, { color: '#fff' }]}>Report Score</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.detailHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.detailTitleWrap}>
          <View style={styles.detailIconWrap}><Ionicons name="trophy" size={22} color={Colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailTitle} numberOfLines={1}>{registration.league_name}</Text>
            <Text style={styles.detailSub}>Season {new Date(registration.created_at).getFullYear()}{divisionInfo ? `  •  ${divisionInfo.division_name}` : ''}</Text>
          </View>
          <View style={[styles.statusBadge, status === 'In Progress' ? styles.statusBadgeGreen : styles.statusBadgeGray]}>
            <Text style={[styles.statusBadgeText, { color: status === 'In Progress' ? Colors.success : Colors.textMuted }]}>{status}</Text>
          </View>
        </View>
      </View>
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]} onPress={() => setActiveTab(tab.key)}>
            <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.key ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
        {activeTab === 'matches' && renderMatches()}
        {activeTab === 'division' && renderDivision()}
        {activeTab === 'league' && renderLeagueStandings()}
        {activeTab === 'playoffs' && renderPlayoffs()}
      </ScrollView>

      <MatchScoringModal
        visible={!!scoringMatch}
        match={scoringMatch}
        playerRecordId={player?.id || ''}
        onClose={() => setScoringMatch(null)}
        onSubmit={submitScore}
      />

      <ScoreConfirmationModal
        visible={!!confirmMatch}
        match={confirmMatch}
        userId={user?.id || ''}
        onClose={() => setConfirmMatch(null)}
        onConfirmed={() => { setConfirmMatch(null); }}
      />

      <PlayerProfileModal
        visible={!!selectedLeaderboardPlayer}
        player={selectedLeaderboardPlayer}
        onClose={() => setSelectedLeaderboardPlayer(null)}
      />

      <ScheduleLeagueMatchModal
        visible={showSchedule}
        divisionId={divisionId}
        onClose={() => setShowSchedule(false)}
        onSchedule={scheduleMatch}
      />
    </View>
  );
};

export const MyLeaguesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { registrations, loading, refetch } = useLeagueRegistrations();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const activeRegs = registrations.filter(r => getLeagueStatus(r) === 'In Progress');
  const completedRegs = registrations.filter(r => getLeagueStatus(r) === 'Completed');
  const displayRegs = showHistory ? completedRegs : activeRegs;

  if (selectedReg) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <LeagueDetailView
          registration={selectedReg}
          onBack={() => setSelectedReg(null)}
          navigation={navigation}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader
        title={showHistory ? 'League History' : 'My Leagues'}
        subtitle={showHistory ? 'Past league performances' : 'Manage your active leagues'}
        navigation={navigation}
        showBack
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <View style={styles.content}>
          {loading && !refreshing ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* History toggle */}
              <TouchableOpacity style={styles.historyToggle} onPress={() => setShowHistory(!showHistory)}>
                <Ionicons name={showHistory ? 'trophy-outline' : 'time-outline'} size={16} color={Colors.primary} />
                <Text style={styles.historyToggleText}>{showHistory ? 'View Active Leagues' : 'View History'}</Text>
              </TouchableOpacity>

              {/* Summary stats */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryNum}>{registrations.length}</Text>
                  <Text style={styles.summaryLabel}>Registered</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryNum}>{activeRegs.length}</Text>
                  <Text style={styles.summaryLabel}>Active</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryNum}>{completedRegs.length}</Text>
                  <Text style={styles.summaryLabel}>Completed</Text>
                </View>
              </View>

              {displayRegs.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>{showHistory ? 'No past leagues' : 'No active leagues'}</Text>
                  <Text style={styles.emptySub}>
                    {showHistory ? 'Your completed leagues will appear here.' : 'Join a league to compete with players at your skill level.'}
                  </Text>
                  {!showHistory && (
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('JoinLeague')}>
                      <Text style={styles.emptyBtnText}>Browse Leagues</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <>
                  {displayRegs.map(reg => {
                    const status = getLeagueStatus(reg);
                    return (
                      <TouchableOpacity
                        key={reg.id}
                        style={styles.leagueCard}
                        onPress={() => setSelectedReg(reg)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.leagueCardHeader}>
                          <View style={styles.leagueTitleRow}>
                            <View style={[styles.statusDot, { backgroundColor: status === 'In Progress' ? Colors.success : Colors.textMuted }]} />
                            <Text style={styles.leagueName} numberOfLines={1}>{reg.league_name || 'League'}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: status === 'In Progress' ? Colors.successLight : Colors.borderLight }]}>
                            <Text style={[styles.statusText, { color: status === 'In Progress' ? Colors.success : Colors.textMuted }]}>{status}</Text>
                          </View>
                        </View>
                        <View style={styles.leagueCardMeta}>
                          <View style={styles.metaItem}>
                            <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                            <Text style={styles.metaText}>Season {new Date(reg.created_at).getFullYear()}</Text>
                          </View>
                          <View style={styles.metaItem}>
                            <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                            <Text style={styles.metaText}>Division Play</Text>
                          </View>
                        </View>
                        <View style={styles.viewLeagueRow}>
                          <Text style={styles.viewLeagueText}>View League</Text>
                          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity style={styles.joinMoreBtn} onPress={() => navigation.navigate('JoinLeague')}>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.joinMoreText}>Join Another League</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md },

  // Overview
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary },
  historyToggleText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  summaryNum: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.primary },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  leagueCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, borderLeftColor: Colors.primary, gap: Spacing.sm },
  leagueCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leagueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  leagueName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  leagueCardMeta: { flexDirection: 'row', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  viewLeagueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  viewLeagueText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  joinMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed' },
  joinMoreText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  emptyBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.md },

  // Detail header
  detailHeader: { backgroundColor: Colors.surface, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },
  detailTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  detailSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statusBadgeGreen: { backgroundColor: Colors.successLight },
  statusBadgeGray: { backgroundColor: Colors.borderLight },
  statusBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  tabScroll: { padding: Spacing.lg, gap: Spacing.md },

  // Tab empty states
  tabEmpty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  tabEmptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.text },
  tabEmptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  scheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  scheduleBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.md },
  tabContent: { gap: Spacing.md },

  // Tournament banner
  tournamentBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: Radius.md, padding: Spacing.md },
  tournamentDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success },
  tournamentTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#166534' },
  tournamentSub: { fontSize: FontSize.xs, color: '#16a34a' },
  inProgressBadge: { backgroundColor: '#16a34a', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  inProgressText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.semibold },

  // Match cards
  matchCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  matchCardWin: { borderLeftWidth: 4, borderLeftColor: Colors.success },
  matchCardLoss: { borderLeftWidth: 4, borderLeftColor: Colors.error },
  matchCardActive: { borderLeftWidth: 4, borderLeftColor: Colors.success },
  matchCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  matchIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  matchIconWin: { backgroundColor: '#dcfce7' },
  matchIconLoss: { backgroundColor: '#fee2e2' },
  matchIconPending: { backgroundColor: '#dbeafe' },
  matchOpponent: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  matchBadgeRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 2 },
  resultBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  resultBadgeWin: { backgroundColor: '#dcfce7' },
  resultBadgeLoss: { backgroundColor: '#fee2e2' },
  resultBadgePending: { backgroundColor: '#dbeafe' },
  resultBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  scheduleMatchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  scheduleMatchBtnText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.semibold },
  matchMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  matchMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchMetaText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  scoreBox: { backgroundColor: Colors.background, borderRadius: Radius.sm, padding: Spacing.sm },
  scoreLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: 2 },
  scoreValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },

  // Schedule new match button
  scheduleNewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed' },
  scheduleNewBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Match action buttons
  matchActions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  matchActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1.5, borderColor: '#ea580c' },
  matchActionBtnOrange: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
  matchActionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Playoff inline badge on match card
  playoffMatchBadge: { backgroundColor: '#f59e0b', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  playoffMatchBadgeText: { fontSize: 10, color: '#fff', fontWeight: FontWeight.bold },

  // Active tournament note
  activeTournamentNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#f0fdf4', borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm },
  activeTournamentText: { fontSize: FontSize.sm, color: '#166534', fontWeight: FontWeight.medium },

  // Playoff bracket
  playoffHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  playoffHeaderTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, flex: 1 },
  playoffRound: { gap: Spacing.sm },
  playoffRoundLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  playoffMatchCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  playoffMatchPlayers: { gap: Spacing.xs },
  playoffPlayer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.background },
  playoffPlayerWinner: { backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#fde047' },
  playoffPlayerName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.text, flex: 1 },
  playoffVs: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.bold, textAlign: 'center', paddingVertical: 2 },
  playoffScore: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text, textAlign: 'center' },
  playoffMatchMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  // Division standings
  standingsHeader: { gap: 2, marginBottom: Spacing.xs },
  standingsTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  standingsSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  standingRowSelf: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary, borderWidth: 2 },
  rankCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rankCircleSelf: { backgroundColor: Colors.primary },
  rankCircleTop: { backgroundColor: '#f59e0b' },
  rankCircleDefault: { backgroundColor: Colors.borderLight },
  rankText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textMuted },
  standingNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  standingName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  youBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  youBadgeText: { fontSize: 10, color: '#fff', fontWeight: FontWeight.bold },
  standingStats: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  standingRight: { alignItems: 'flex-end', gap: Spacing.xs },
  playoffBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#16a34a', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  playoffBadgeText: { fontSize: 10, color: '#fff', fontWeight: FontWeight.semibold },
  matchesNeeded: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },
  scheduleSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary },
  scheduleSmallBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },

  // League-wide standings
  myRankBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary },
  myRankLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  myRankNum: { fontSize: 32, fontWeight: FontWeight.bold, color: Colors.primary },
  myRankLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primaryDark },
  myRankPts: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2 },
  myRankGap: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  myRankGapText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  divisionPill: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  divisionPillText: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  pointsValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  pointsLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
});
