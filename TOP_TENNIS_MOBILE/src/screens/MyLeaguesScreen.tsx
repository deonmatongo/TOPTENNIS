import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import { useDivisionMatches } from '@/hooks/useDivisionMatches';
import { useLeagueLeaderboard } from '@/hooks/useLeagueLeaderboard';
import { supabase } from '@/services/supabase';
import { Palette, Colors, Shadow, FontSize, Font, FontWeight, Spacing, Radius } from '@/theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

// ── Dummy data (shown when user has no real registrations) ────────────────────

const _d = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const _p = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const LEAGUE_ACTIVITIES_AVAILABLE = true;

const DUMMY_REGISTRATIONS = [
  { id: '__demo_1', league_id: '__demo_l1', league_name: 'Spring Open Singles 2026', status: 'active',    created_at: _p(28),  is_demo: true },
  { id: '__demo_2', league_id: '__demo_l2', league_name: 'City Doubles Championship', status: 'active',   created_at: _p(14),  is_demo: true },
  { id: '__demo_3', league_id: '__demo_l3', league_name: 'Intermediate League S3',    status: 'completed', created_at: _p(120), is_demo: true },
];

const DUMMY_MATCHES = [
  { id: '__dm1', match_date: _d(3),  player1_name: 'You',         player2_name: 'Alex Chen',     player1_id: '__me__', player2_id: '__p2__', winner_id: undefined, status: 'scheduled', court_location: 'Court 3 — North Club', isUserMatch: true,  userIsPlayer1: true,  opponent_name: 'Alex Chen',   opponent_user_id: '__p2__', result: 'pending' as const, set1_player1: null, set1_player2: null },
  { id: '__dm2', match_date: _d(7),  player1_name: 'Jordan Lee',  player2_name: 'You',           player1_id: '__p3__', player2_id: '__me__', winner_id: undefined, status: 'scheduled', court_location: 'Court 1 — East Wing',  isUserMatch: true,  userIsPlayer1: false, opponent_name: 'Jordan Lee',  opponent_user_id: '__p3__', result: 'pending' as const, set1_player1: null, set1_player2: null },
  { id: '__dm3', match_date: _d(2),  player1_name: 'Marcus Webb', player2_name: 'Sam Rivera',    player1_id: '__p4__', player2_id: '__p5__', winner_id: undefined, status: 'scheduled', court_location: 'Court 5 — South Club', isUserMatch: false, userIsPlayer1: false, opponent_name: '',            opponent_user_id: '',        result: 'pending' as const, set1_player1: null, set1_player2: null },
  { id: '__dm4', match_date: _d(5),  player1_name: 'Priya Nair',  player2_name: 'Taylor Brooks', player1_id: '__p6__', player2_id: '__p7__', winner_id: undefined, status: 'scheduled', court_location: 'Court 2 — West Side',  isUserMatch: false, userIsPlayer1: false, opponent_name: '',            opponent_user_id: '',        result: 'pending' as const, set1_player1: null, set1_player2: null },
  { id: '__dm5', match_date: _p(3),  player1_name: 'You',         player2_name: 'Marcus Webb',   player1_id: '__me__', player2_id: '__p4__', winner_id: '__me__',  status: 'completed', court_location: 'Court 3 — North Club', isUserMatch: true,  userIsPlayer1: true,  opponent_name: 'Marcus Webb', opponent_user_id: '__p4__', result: 'win'  as const, set1_player1: 6, set1_player2: 3 },
  { id: '__dm6', match_date: _p(6),  player1_name: 'Alex Chen',   player2_name: 'Sam Rivera',    player1_id: '__p2__', player2_id: '__p5__', winner_id: '__p2__',  status: 'completed', court_location: 'Court 1 — East Wing',  isUserMatch: false, userIsPlayer1: false, opponent_name: '',            opponent_user_id: '',        result: 'pending' as const, set1_player1: 7, set1_player2: 5 },
];

const DUMMY_PLAYOFF_MATCHES = [
  // ── Semifinals ────────────────────────────────────────────────────────────
  {
    id: '__dp1', division_id: '__dd', player1_id: '__me__', player2_id: '__dd4',
    player1_name: 'You', player2_name: 'Marcus Webb',
    scheduled_date: _p(7), scheduled_time: '10:00', court_location: 'Court 3 — North Club',
    status: 'completed', winner_id: '__me__',
    score: { sets: [{ p1: 6, p2: 3 }, { p1: 6, p2: 4 }] },
    is_playoff: true, round_number: 1, created_at: _p(10),
    isUserMatch: true, userIsPlayer1: true,
    opponent_name: 'Marcus Webb', opponent_id: '__dd4',
    result: 'win' as const, needsScoreReport: false,
  },
  {
    id: '__dp2', division_id: '__dd', player1_id: '__dd1', player2_id: '__dd2',
    player1_name: 'Alex Chen', player2_name: 'Jordan Lee',
    scheduled_date: _p(7), scheduled_time: '12:00', court_location: 'Court 1 — East Wing',
    status: 'completed', winner_id: '__dd1',
    score: { sets: [{ p1: 7, p2: 5 }, { p1: 6, p2: 4 }] },
    is_playoff: true, round_number: 1, created_at: _p(10),
    isUserMatch: false, userIsPlayer1: false,
    opponent_name: '', opponent_id: '',
    result: 'pending' as const, needsScoreReport: false,
  },
  // ── Final ─────────────────────────────────────────────────────────────────
  {
    id: '__dp3', division_id: '__dd', player1_id: '__me__', player2_id: '__dd1',
    player1_name: 'You', player2_name: 'Alex Chen',
    scheduled_date: _d(7), scheduled_time: '11:00', court_location: 'Court 5 — Championship Court',
    status: 'scheduled', winner_id: undefined,
    score: undefined,
    is_playoff: true, round_number: 2, created_at: _p(3),
    isUserMatch: true, userIsPlayer1: true,
    opponent_name: 'Alex Chen', opponent_id: '__dd1',
    result: 'pending' as const, needsScoreReport: false,
  },
];

const DUMMY_DIVISION_LEADERBOARD = [
  { id: '__dd1', user_id: '__dd1', name: 'Alex Chen',     wins: 8, losses: 2, total_matches: 10, skill_level: 4, points: 29, matches_completed: 10, matches_required: 10, playoff_eligible: true,  isCurrentUser: false, rank: 1 },
  { id: '__dd2', user_id: '__dd2', name: 'Jordan Lee',    wins: 7, losses: 3, total_matches: 10, skill_level: 4, points: 26, matches_completed: 10, matches_required: 10, playoff_eligible: true,  isCurrentUser: false, rank: 2 },
  { id: '__dd3', user_id: '__dd3', name: 'You',           wins: 5, losses: 3, total_matches:  8, skill_level: 3, points: 19, matches_completed:  8, matches_required: 10, playoff_eligible: false, isCurrentUser: true,  rank: 3 },
  { id: '__dd4', user_id: '__dd4', name: 'Marcus Webb',   wins: 4, losses: 5, total_matches:  9, skill_level: 3, points: 16, matches_completed:  9, matches_required: 10, playoff_eligible: false, isCurrentUser: false, rank: 4 },
  { id: '__dd5', user_id: '__dd5', name: 'Priya Nair',    wins: 3, losses: 5, total_matches:  8, skill_level: 3, points: 13, matches_completed:  8, matches_required: 10, playoff_eligible: false, isCurrentUser: false, rank: 5 },
  { id: '__dd6', user_id: '__dd6', name: 'Sam Rivera',    wins: 2, losses: 7, total_matches:  9, skill_level: 3, points: 10, matches_completed:  9, matches_required: 10, playoff_eligible: false, isCurrentUser: false, rank: 6 },
  { id: '__dd7', user_id: '__dd7', name: 'Taylor Brooks', wins: 1, losses: 8, total_matches:  9, skill_level: 3, points:  7, matches_completed:  9, matches_required: 10, playoff_eligible: false, isCurrentUser: false, rank: 7 },
];

const DUMMY_LEAGUE_LEADERBOARD = [
  { id: '__dl1', user_id: '__dl1', name: 'Alex Chen',     wins: 8, losses: 2, total_matches: 10, skill_level: 4, points: 29, matches_completed: 10, matches_required: 10, playoff_eligible: true,  division_name: 'Division A', division_id: '__da', isCurrentUser: false, rank: 1 },
  { id: '__dl2', user_id: '__dl2', name: 'Jordan Lee',    wins: 7, losses: 3, total_matches: 10, skill_level: 4, points: 26, matches_completed: 10, matches_required: 10, playoff_eligible: true,  division_name: 'Division B', division_id: '__db', isCurrentUser: false, rank: 2 },
  { id: '__dl3', user_id: '__dl3', name: 'Chris Park',    wins: 7, losses: 2, total_matches:  9, skill_level: 4, points: 23, matches_completed:  9, matches_required: 10, playoff_eligible: true,  division_name: 'Division C', division_id: '__dc', isCurrentUser: false, rank: 3 },
  { id: '__dl4', user_id: '__dl4', name: 'You',           wins: 5, losses: 3, total_matches:  8, skill_level: 3, points: 19, matches_completed:  8, matches_required: 10, playoff_eligible: false, division_name: 'Division A', division_id: '__da', isCurrentUser: true,  rank: 4 },
  { id: '__dl5', user_id: '__dl5', name: 'Maya Osei',     wins: 5, losses: 4, total_matches:  9, skill_level: 3, points: 17, matches_completed:  9, matches_required: 10, playoff_eligible: false, division_name: 'Division C', division_id: '__dc', isCurrentUser: false, rank: 5 },
  { id: '__dl6', user_id: '__dl6', name: 'Marcus Webb',   wins: 4, losses: 5, total_matches:  9, skill_level: 3, points: 16, matches_completed:  9, matches_required: 10, playoff_eligible: false, division_name: 'Division C', division_id: '__dc', isCurrentUser: false, rank: 6 },
  { id: '__dl7', user_id: '__dl7', name: 'Priya Nair',    wins: 3, losses: 5, total_matches:  8, skill_level: 3, points: 13, matches_completed:  8, matches_required: 10, playoff_eligible: false, division_name: 'Division B', division_id: '__db', isCurrentUser: false, rank: 7 },
  { id: '__dl8', user_id: '__dl8', name: 'Sam Rivera',    wins: 2, losses: 7, total_matches:  9, skill_level: 3, points: 10, matches_completed:  9, matches_required: 10, playoff_eligible: false, division_name: 'Division B', division_id: '__db', isCurrentUser: false, rank: 8 },
  { id: '__dl9', user_id: '__dl9', name: 'Taylor Brooks', wins: 1, losses: 8, total_matches:  9, skill_level: 3, points:  7, matches_completed:  9, matches_required: 10, playoff_eligible: false, division_name: 'Division A', division_id: '__da', isCurrentUser: false, rank: 9 },
];

type Tab = 'matches' | 'division' | 'league' | 'playoffs';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'matches', label: 'Matches', icon: 'calendar-outline' },
  { key: 'division', label: 'Division', icon: 'bar-chart-outline' },
  { key: 'league', label: 'League', icon: 'trophy-outline' },
  { key: 'playoffs', label: 'Playoffs', icon: 'medal-outline' },
];

const getLeagueStatus = (reg: any) => {
  if (reg.status === 'completed' || reg.status === 'expired') return 'Completed';
  if (reg.status === 'active') return 'In Progress';
  // Fallback: date-based heuristic for legacy records
  const dateStr = reg.created_at || reg.registration_date;
  if (!dateStr) return 'In Progress';
  const months = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return months < 3 ? 'In Progress' : 'Completed';
};

const LeagueDetailView: React.FC<{ registration: any; onBack: () => void; navigation: any }> = ({ registration, onBack, navigation }) => {
  const detailInsets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('division');
  const [divisionInfo, setDivisionInfo] = useState<any>(null);
  const [scoringMatch, setScoringMatch] = useState<LeagueMatch | null>(null);
  const [confirmMatch, setConfirmMatch] = useState<LeagueMatch | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedulingOpponentId, setSchedulingOpponentId] = useState<string | null>(null);
  const [selectedLeaderboardPlayer, setSelectedLeaderboardPlayer] = useState<PlayerSearchResult | null>(null);
  const { user } = useAuth();
  const { player } = usePlayerProfile();
  const { assignments } = useDivisionAssignments();
  const divisionId = assignments.find(a => a.league_registration_id === registration.id)?.division_id;
  const { userMatches, allDivisionMatches, playoffMatches, loading: matchesLoading, submitScore, scheduleMatch } = useLeagueMatches(divisionId);
  const { loading: divMatchesLoading } = useDivisionMatches(divisionId);
  const isDemoLeague = !!(registration.is_demo);
  const { leaderboard, loading: leaderboardLoading } = useDivisionLeaderboard(divisionId);
  const { leaderboard: leagueLeaderboard, loading: leagueLeaderboardLoading, currentUser: leagueCurrentUser } = useLeagueLeaderboard(registration.league_id);

  useEffect(() => {
    if (!divisionId) return;
    supabase.from('divisions').select('id, tournament_status, division_name').eq('id', divisionId).single()
      .then(({ data }) => { if (data) setDivisionInfo(data); });
  }, [divisionId]);

  const status = getLeagueStatus(registration);

  const handleMatchRequest = (opponentId: string, opponentName: string) => {
    navigation.navigate('Schedule', { opponentId, opponentName });
  };

  const renderMatches = () => {
    const allMatches: any[] = (!isDemoLeague && !matchesLoading && allDivisionMatches.length > 0)
      ? allDivisionMatches
      : DUMMY_MATCHES;
    const isTournamentActive = !isDemoLeague && divisionInfo?.tournament_status === 'active';

    // Group by week for round-robin display
    const hasWeeks = !isDemoLeague && !matchesLoading && allDivisionMatches.some((m: any) => m.week_number != null);
    const weekGroups: Map<number | null, any[]> = hasWeeks
      ? allMatches.reduce((acc, m) => {
          const w = m.week_number ?? null;
          if (!acc.has(w)) acc.set(w, []);
          acc.get(w)!.push(m);
          return acc;
        }, new Map<number | null, any[]>())
      : new Map([[null, allMatches]]);

    const upcoming  = allMatches.filter(m => m.status === 'scheduled' || m.status === 'pending');
    const completed = allMatches.filter(m => m.status === 'completed');

    const MatchCard = ({ match }: { match: any }) => {
      const isUserMatch  = !!match.isUserMatch;
      const isWin        = isUserMatch && match.result === 'win';
      const isLoss       = isUserMatch && match.result === 'loss';
      const isScheduled  = match.status === 'scheduled' || match.status === 'pending';
      const isCompleted  = match.status === 'completed';

      // For user matches, look up the corresponding LeagueMatch for the scoring modal
      const leagueMatch  = isUserMatch ? userMatches.find(m => m.id === match.id) : undefined;

      const canReport = isUserMatch && !isDemoLeague && leagueMatch &&
        ((isScheduled) || (isCompleted && leagueMatch.needsScoreReport));
      const awaitingConfirmation = isUserMatch && !isDemoLeague && leagueMatch && isCompleted &&
        leagueMatch.winner_id && leagueMatch.score?.reported_by &&
        leagueMatch.score.reported_by !== user?.id && !leagueMatch.score?.confirmed_by;

      // Title: user matches → "vs Opponent"; other matches → "P1 vs P2"
      const matchTitle = isUserMatch
        ? `vs ${match.opponent_name}`
        : `${match.player1_name} vs ${match.player2_name}`;

      const iconName  = isWin ? 'trophy' : isLoss ? 'person' : isUserMatch ? 'time-outline' : 'tennisball-outline';
      const iconColor = isWin ? Colors.success : isLoss ? Colors.error : isUserMatch ? Colors.info : Colors.textMuted;
      const iconBg    = isWin ? styles.matchIconWin : isLoss ? styles.matchIconLoss : isUserMatch ? styles.matchIconPending : styles.matchIconOther;

      // Score display (set scores stored as set1_player1 / set1_player2 etc.)
      const hasSetScores = match.set1_player1 != null && match.set1_player2 != null;
      const scoreText = hasSetScores
        ? [
            `${match.set1_player1}–${match.set1_player2}`,
            match.set2_player1 != null ? `${match.set2_player1}–${match.set2_player2}` : null,
            match.set3_player1 != null ? `${match.set3_player1}–${match.set3_player2}` : null,
          ].filter(Boolean).join(', ')
        : (leagueMatch?.score?.sets ? leagueMatch.score.sets.map((s: any) => `${s.p1}-${s.p2}`).join(', ') : null);

      const displayDate = match.match_date || leagueMatch?.scheduled_date;
      const displayTime = leagueMatch?.scheduled_time;
      const displayLoc  = match.court_location || leagueMatch?.court_location;

      return (
        <View style={[
          styles.matchCard,
          isWin  && styles.matchCardWin,
          isLoss && styles.matchCardLoss,
          isTournamentActive && isScheduled && isUserMatch && styles.matchCardActive,
          !isUserMatch && styles.matchCardOther,
        ]}>
          <View style={styles.matchCardTop}>
            <View style={[styles.matchIcon, iconBg]}>
              <Ionicons name={iconName as any} size={18} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.matchOpponent, !isUserMatch && { color: Colors.textSecondary }]}>
                {matchTitle}
              </Text>
              <View style={styles.matchBadgeRow}>
                {isUserMatch && (
                  <View style={[styles.resultBadge, isWin ? styles.resultBadgeWin : isLoss ? styles.resultBadgeLoss : styles.resultBadgePending]}>
                    <Text style={[styles.resultBadgeText, { color: isWin ? Colors.success : isLoss ? Colors.error : Colors.info }]}>
                      {isWin ? 'Victory' : isLoss ? 'Defeat' : isScheduled ? 'Upcoming' : 'Pending'}
                    </Text>
                  </View>
                )}
                {!isUserMatch && isScheduled && (
                  <View style={[styles.resultBadge, styles.resultBadgeOther]}>
                    <Text style={[styles.resultBadgeText, { color: Colors.textMuted }]}>Upcoming</Text>
                  </View>
                )}
                {!isUserMatch && isCompleted && (
                  <View style={[styles.resultBadge, styles.resultBadgeOther]}>
                    <Text style={[styles.resultBadgeText, { color: Colors.textMuted }]}>Completed</Text>
                  </View>
                )}
                {canReport && (
                  <View style={styles.enterScoreBadge}>
                    <Text style={styles.enterScoreBadgeText}>Enter Score</Text>
                  </View>
                )}
                {leagueMatch?.is_playoff && (
                  <View style={styles.playoffMatchBadge}>
                    <Text style={styles.playoffMatchBadgeText}>Playoff</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.matchMeta}>
            {displayDate && (
              <View style={styles.matchMetaItem}>
                <Ionicons name="calendar-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.matchMetaText}>
                  {new Date(displayDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            )}
            {displayTime && (
              <View style={styles.matchMetaItem}>
                <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.matchMetaText}>{displayTime.slice(0, 5)}</Text>
              </View>
            )}
            {displayLoc && (
              <View style={styles.matchMetaItem}>
                <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.matchMetaText}>{displayLoc}</Text>
              </View>
            )}
          </View>

          {isCompleted && scoreText && (
            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>Final Score</Text>
              <Text style={styles.scoreValue}>{scoreText}</Text>
            </View>
          )}

          {/* Book Match — for user's pending (unbooked) matches */}
          {isUserMatch && match.status === 'pending' && !isDemoLeague && (
            <TouchableOpacity
              style={styles.bookMatchBtn}
              onPress={() => setSchedulingOpponentId(match.opponent_id || '')}
            >
              <Ionicons name="calendar" size={14} color="#fff" />
              <Text style={styles.bookMatchBtnText}>Book Court &amp; Time</Text>
            </TouchableOpacity>
          )}

          {/* Action buttons — only for user's own matches */}
          {(canReport || awaitingConfirmation) && (
            <View style={styles.matchActions}>
              {awaitingConfirmation && leagueMatch && (
                <TouchableOpacity
                  style={[styles.matchActionBtn, { borderColor: Colors.success }]}
                  onPress={() => setConfirmMatch(leagueMatch)}
                >
                  <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                  <Text style={[styles.matchActionBtnText, { color: Colors.success }]}>Confirm Score</Text>
                </TouchableOpacity>
              )}
              {canReport && !awaitingConfirmation && leagueMatch && (
                <TouchableOpacity
                  style={[styles.matchActionBtn, styles.matchActionBtnOrange]}
                  onPress={() => setScoringMatch(leagueMatch)}
                >
                  <Ionicons name="trophy" size={14} color="#fff" />
                  <Text style={[styles.matchActionBtnText, { color: '#fff' }]}>I Won</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      );
    };

    return (
      <View style={styles.tabContent}>
        {isDemoLeague && (
          <View style={styles.demoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.demoBannerText}>Demo data — join a real league to see live matches and enter scores.</Text>
          </View>
        )}

        {!isDemoLeague && (
          <TouchableOpacity style={styles.scheduleNewBtn} onPress={() => setShowSchedule(true)}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.scheduleNewBtnText}>Schedule a Match</Text>
          </TouchableOpacity>
        )}

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

        {allMatches.length === 0 ? (
          <View style={styles.tabEmpty}>
            <Ionicons name="time-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.tabEmptyTitle}>No matches yet</Text>
            <Text style={styles.tabEmptySub}>Division schedule will appear once players are assigned.</Text>
          </View>
        ) : hasWeeks ? (
          // Week-grouped round-robin schedule
          Array.from(weekGroups.entries())
            .sort(([a], [b]) => (a ?? 9999) - (b ?? 9999))
            .map(([week, weekMatches]) => (
              <View key={`week-${week}`} style={styles.matchSection}>
                <View style={styles.weekHeader}>
                  <View style={styles.weekDot} />
                  <Text style={styles.weekLabel}>Week {week ?? '—'}</Text>
                  {weekMatches[0]?.scheduled_date && (
                    <Text style={styles.weekDate}>
                      {new Date(weekMatches[0].scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                </View>
                {weekMatches.map((m: any) => <MatchCard key={m.id} match={m} />)}
              </View>
            ))
        ) : (
          // No week numbers — fallback to upcoming/completed split
          <>
            {upcoming.length > 0 && (
              <View style={styles.matchSection}>
                <Text style={styles.matchSectionLabel}>Upcoming ({upcoming.length})</Text>
                {upcoming.map(m => <MatchCard key={m.id} match={m} />)}
              </View>
            )}
            {completed.length > 0 && (
              <View style={styles.matchSection}>
                <Text style={styles.matchSectionLabel}>Recent Results ({completed.length})</Text>
                {completed.map(m => <MatchCard key={m.id} match={m} />)}
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const renderDivision = () => {
    const realBoard = leaderboard.filter(p => p.name && p.name !== 'Unknown');
    const displayBoard = (!leaderboardLoading && realBoard.length > 0) ? realBoard : DUMMY_DIVISION_LEADERBOARD;
    const meStats = displayBoard.find(p => p.isCurrentUser);
    const myRank  = displayBoard.findIndex(p => p.isCurrentUser) + 1;
    const currentAssignment = assignments.find(a => a.league_registration_id === registration.id);
    const completed  = currentAssignment?.matches_completed ?? meStats?.matches_completed ?? 0;
    const required   = currentAssignment?.matches_required  ?? meStats?.matches_required  ?? 5;
    const eligible   = currentAssignment?.playoff_eligible  ?? meStats?.playoff_eligible  ?? false;
    const pct = Math.min(100, Math.round((completed / required) * 100));

    return (
      <View style={styles.tabContent}>

        {/* My status card */}
        {meStats && (
          <View style={styles.myStatusCard}>
            <View style={styles.myStatusTop}>
              <View style={styles.myStatusAvatar}>
                <Text style={styles.myStatusAvatarText}>{meStats.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.myStatusNameRow}>
                  <Text style={styles.myStatusName}>{meStats.name}</Text>
                  {eligible && (
                    <View style={styles.playoffReadyBadge}>
                      <Ionicons name="shield-checkmark-outline" size={11} color="#fff" />
                      <Text style={styles.playoffReadyText}>Playoff Ready</Text>
                    </View>
                  )}
                  {myRank > 0 && (
                    <View style={styles.rankPill}><Text style={styles.rankPillText}>#{myRank}</Text></View>
                  )}
                </View>
                <View style={styles.myStatusStatsRow}>
                  <Text style={styles.myStatusWins}>{meStats.wins}W</Text>
                  <Text style={styles.myStatusLosses}>{meStats.losses}L</Text>
                  <Text style={styles.myStatusPts}>{meStats.points} pts</Text>
                  <Text style={styles.myStatusWr}>
                    {meStats.total_matches > 0 ? Math.round((meStats.wins / meStats.total_matches) * 100) : 0}% WR
                  </Text>
                </View>
              </View>
            </View>
            {/* Progress toward playoff eligibility */}
            <View style={styles.myStatusProgress}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Matches toward playoff eligibility</Text>
                <Text style={styles.progressCount}>{completed}/{required}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` as any }, eligible && styles.progressFillGreen]} />
              </View>
            </View>
          </View>
        )}

        {/* Division context badges */}
        {divisionInfo && (
          <View style={styles.divBadgeRow}>
            <View style={styles.divBadge}><Text style={styles.divBadgeText}>{divisionInfo.division_name}</Text></View>
            {(divisionInfo as any).skill_level_range && (
              <View style={styles.divBadge}><Text style={styles.divBadgeText}>Level {(divisionInfo as any).skill_level_range}</Text></View>
            )}
            {(divisionInfo as any).competitiveness && (
              <View style={styles.divBadge}><Text style={styles.divBadgeText}>{(divisionInfo as any).competitiveness}</Text></View>
            )}
          </View>
        )}

        <View style={styles.leagueTable}>
            {/* ── Table header ── */}
            <LinearGradient
              colors={[Palette.dark900, Palette.dark700]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.tableHeader}
            >
              <View style={styles.tableRankCol}>
                <Text style={styles.tableHeaderText}>#</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableHeaderText}>Player</Text>
              </View>
              <Text style={[styles.tableHeaderText, styles.tableNumHeader]}>Pld</Text>
              <Text style={[styles.tableHeaderText, styles.tableNumHeader]}>W</Text>
              <Text style={[styles.tableHeaderText, styles.tableNumHeader]}>L</Text>
              <Text style={[styles.tableHeaderText, styles.tableNumHeaderPts]}>Pts</Text>
              <Text style={[styles.tableHeaderText, styles.tableNumHeaderWr]}>WR%</Text>
            </LinearGradient>

            {/* ── Table rows ── */}
            {displayBoard.map((p, index) => {
              const winRate = p.total_matches > 0 ? Math.round((p.wins / p.total_matches) * 100) : 0;
              const medals = ['🥇', '🥈', '🥉'];
              const isTop3 = index < 3;
              return (
                <TouchableOpacity
                  key={p.user_id ?? `lb-${index}`}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 && styles.tableRowAlt,
                    p.isCurrentUser && styles.tableRowSelf,
                    index === displayBoard.length - 1 && styles.tableRowLast,
                  ]}
                  onPress={() => {
                    if (!p.isCurrentUser) {
                      setSelectedLeaderboardPlayer({
                        id: p.user_id,
                        first_name: p.name.split(' ')[0] || p.name,
                        last_name: p.name.split(' ').slice(1).join(' ') || '',
                        wins: p.wins,
                        losses: p.losses,
                      });
                    }
                  }}
                  activeOpacity={p.isCurrentUser ? 1 : 0.75}
                >
                  {/* Rank / Medal */}
                  <View style={styles.tableRankCol}>
                    {isTop3 && !p.isCurrentUser
                      ? <Text style={styles.tableMedal}>{medals[index]}</Text>
                      : <Text style={[styles.tableRankNum, p.isCurrentUser && styles.tableRankNumSelf]}>{index + 1}</Text>
                    }
                  </View>

                  {/* Player name + YOU / playoff badges */}
                  <View style={styles.tableNameCell}>
                    <Text style={[styles.tablePlayerName, p.isCurrentUser && styles.tablePlayerNameSelf]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {(p.isCurrentUser || p.playoff_eligible) && (
                      <View style={styles.tableNameBadges}>
                        {p.isCurrentUser && (
                          <View style={styles.tableYouBadge}>
                            <Text style={styles.tableYouText}>YOU</Text>
                          </View>
                        )}
                        {p.playoff_eligible && (
                          <View style={styles.tablePlayoffDot}>
                            <Ionicons name="shield-checkmark-outline" size={8} color="#fff" />
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Pld */}
                  <Text style={[styles.tableNumCell, p.isCurrentUser && styles.tableNumSelf]}>{p.total_matches}</Text>
                  {/* W */}
                  <Text style={[styles.tableNumCell, styles.tableWinNum]}>{p.wins}</Text>
                  {/* L */}
                  <Text style={[styles.tableNumCell, styles.tableLossNum]}>{p.losses}</Text>
                  {/* Pts */}
                  <Text style={[styles.tablePtsCell, p.isCurrentUser && styles.tableNumSelf]}>{p.points}</Text>
                  {/* WR% */}
                  <Text style={[styles.tableWrCell, p.isCurrentUser && styles.tableNumSelf]}>{winRate}%</Text>
                </TouchableOpacity>
              );
            })}
          </View>

        {/* Footer note */}
        <View style={styles.divFooter}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.success} />
          <Text style={styles.divFooterText}>
            Playoff eligibility requires {required} matches. Top seeds from each group advance.
          </Text>
        </View>
      </View>
    );
  };

  const renderLeagueStandings = () => {
    const realLeagueBoard = leagueLeaderboard.filter(p => p.name && p.name !== 'Unknown');
    const displayLeagueBoard = (!leagueLeaderboardLoading && realLeagueBoard.length > 0) ? realLeagueBoard : DUMMY_LEAGUE_LEADERBOARD;
    const leagueCurrentUserDisplay = displayLeagueBoard.find(p => p.isCurrentUser) ?? leagueCurrentUser;
    const myRank = leagueCurrentUserDisplay?.rank;
    const myPoints = leagueCurrentUserDisplay?.points ?? 0;
    const nextPlayer = myRank && myRank > 1 ? displayLeagueBoard[myRank - 2] : null;
    const pointsGap = nextPlayer ? nextPlayer.points - myPoints : 0;

    return (
      <View style={styles.tabContent}>
        {/* My position banner */}
        {leagueCurrentUserDisplay && (
          <View style={styles.myRankBanner}>
            <View style={styles.myRankLeft}>
              <Text style={styles.myRankNum}>#{myRank}</Text>
              <View>
                <Text style={styles.myRankLabel}>Your League Rank</Text>
                <Text style={styles.myRankPts}>{myPoints} pts  •  {leagueCurrentUserDisplay.wins}W – {leagueCurrentUserDisplay.losses}L</Text>
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
          <Text style={styles.standingsSub}>{displayLeagueBoard.length} players competing</Text>
        </View>

        <View style={styles.leagueTable}>
          {/* ── Table header ── */}
          <LinearGradient
            colors={[Palette.dark900, Palette.dark700]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.tableHeader}
          >
            <View style={styles.tableRankCol}>
              <Text style={styles.tableHeaderText}>#</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tableHeaderText}>Player</Text>
            </View>
            <Text style={[styles.tableHeaderText, styles.tableNumHeader]}>Pld</Text>
            <Text style={[styles.tableHeaderText, styles.tableNumHeader]}>W</Text>
            <Text style={[styles.tableHeaderText, styles.tableNumHeader]}>L</Text>
            <Text style={[styles.tableHeaderText, styles.tableNumHeaderPts]}>Pts</Text>
            <Text style={[styles.tableHeaderText, styles.tableNumHeaderWr]}>WR%</Text>
          </LinearGradient>

          {/* ── Table rows ── */}
          {displayLeagueBoard.map((p, index) => {
            const winRate = p.total_matches > 0 ? Math.round((p.wins / p.total_matches) * 100) : 0;
            const medals = ['🥇', '🥈', '🥉'];
            const isTop3 = index < 3;
            return (
              <TouchableOpacity
                key={p.user_id ?? `llb-${index}`}
                style={[
                  styles.tableRow,
                  index % 2 === 1 && styles.tableRowAlt,
                  p.isCurrentUser && styles.tableRowSelf,
                  index === displayLeagueBoard.length - 1 && styles.tableRowLast,
                ]}
                onPress={() => {
                  if (!p.isCurrentUser) {
                    setSelectedLeaderboardPlayer({
                      id: p.user_id,
                      first_name: p.name.split(' ')[0] || p.name,
                      last_name: p.name.split(' ').slice(1).join(' ') || '',
                      wins: p.wins,
                      losses: p.losses,
                      profile_picture_url: (p as any).profile_picture_url,
                    });
                  }
                }}
                activeOpacity={p.isCurrentUser ? 1 : 0.75}
              >
                {/* Rank / Medal */}
                <View style={styles.tableRankCol}>
                  {isTop3 && !p.isCurrentUser
                    ? <Text style={styles.tableMedal}>{medals[index]}</Text>
                    : <Text style={[styles.tableRankNum, p.isCurrentUser && styles.tableRankNumSelf]}>{index + 1}</Text>
                  }
                </View>

                {/* Player name + division sub-label + YOU / playoff badges */}
                <View style={styles.tableNameCell}>
                  <Text style={[styles.tablePlayerName, p.isCurrentUser && styles.tablePlayerNameSelf]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View style={styles.tableLeagueSub}>
                    <Text style={styles.tableLeagueDiv} numberOfLines={1}>{p.division_name}</Text>
                    {(p.isCurrentUser || p.playoff_eligible) && (
                      <View style={styles.tableNameBadges}>
                        {p.isCurrentUser && (
                          <View style={styles.tableYouBadge}>
                            <Text style={styles.tableYouText}>YOU</Text>
                          </View>
                        )}
                        {p.playoff_eligible && (
                          <View style={styles.tablePlayoffDot}>
                            <Ionicons name="shield-checkmark-outline" size={8} color="#fff" />
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* Pld */}
                <Text style={[styles.tableNumCell, p.isCurrentUser && styles.tableNumSelf]}>{p.total_matches}</Text>
                {/* W */}
                <Text style={[styles.tableNumCell, styles.tableWinNum]}>{p.wins}</Text>
                {/* L */}
                <Text style={[styles.tableNumCell, styles.tableLossNum]}>{p.losses}</Text>
                {/* Pts */}
                <Text style={[styles.tablePtsCell, p.isCurrentUser && styles.tableNumSelf]}>{p.points}</Text>
                {/* WR% */}
                <Text style={[styles.tableWrCell, p.isCurrentUser && styles.tableNumSelf]}>{winRate}%</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderPlayoffs = () => {
    const displayPlayoffs = (!matchesLoading && playoffMatches.length > 0) ? playoffMatches : DUMMY_PLAYOFF_MATCHES;

    // Group by round
    const rounds = displayPlayoffs.reduce((acc: Record<number, any[]>, m: any) => {
      const r = m.round_number || 1;
      if (!acc[r]) acc[r] = [];
      acc[r].push(m);
      return acc;
    }, {});

    const totalRounds = Math.max(...Object.keys(rounds).map(Number));
    const roundLabel = (n: number) => {
      if (n === totalRounds) return 'Final';
      if (n === totalRounds - 1) return 'Semifinals';
      if (n === totalRounds - 2) return 'Quarterfinals';
      return `Round ${n}`;
    };

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
          return (
            <View key={roundKey} style={styles.playoffRound}>
              <Text style={styles.playoffRoundLabel}>{roundLabel(roundNum)}</Text>
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
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <StatusBar style="light" />
      {/* Dark gradient header — matches every other screen */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradHeader, { paddingTop: detailInsets.top + Spacing.md }]}
      >
        <TouchableOpacity style={styles.gradBackBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.gradTitle} numberOfLines={1}>{registration.league_name}</Text>
          <Text style={styles.gradSub}>
            Season {new Date(registration.created_at).getFullYear()}{divisionInfo ? `  •  ${divisionInfo.division_name}` : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, status === 'In Progress' ? styles.statusBadgeGreen : styles.statusBadgeGray]}>
          <Text style={[styles.statusBadgeText, { color: status === 'In Progress' ? Colors.success : Colors.textMuted }]}>{status}</Text>
        </View>
      </LinearGradient>

      {/* Matches / Division / League / Playoffs pill tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]} onPress={() => setActiveTab(tab.key)}>
            <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.key ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.tabScroll, { paddingBottom: detailInsets.bottom + Spacing.xl }]}>
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
        visible={showSchedule || !!schedulingOpponentId}
        divisionId={divisionId}
        initialOpponentId={schedulingOpponentId ?? undefined}
        onClose={() => { setShowSchedule(false); setSchedulingOpponentId(null); }}
        onSchedule={scheduleMatch}
      />
    </View>
  );
};

export const MyLeaguesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { registrations, loading, refetch } = useLeagueRegistrations();
  const { player } = usePlayerProfile();
  const { assignments } = useDivisionAssignments();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReg, setSelectedReg] = useState<any>(null);
  const [completedPage, setCompletedPage] = useState(3);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const isDisplayingDemo = registrations.length === 0;
  const sourceRegs = isDisplayingDemo ? DUMMY_REGISTRATIONS : registrations;
  const sourceActive    = sourceRegs.filter(r => getLeagueStatus(r) === 'In Progress');
  const sourceCompleted = sourceRegs.filter(r => getLeagueStatus(r) === 'Completed');

  // Stats for the strip
  const totalWins   = isDisplayingDemo ? 4 : (player?.wins   ?? 0);
  const totalLosses = isDisplayingDemo ? 1 : (player?.losses ?? 0);
  const totalMatches = totalWins + totalLosses;
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
  const streak  = isDisplayingDemo ? 2 : (player?.current_streak ?? 0);
  const rating  = player?.usta_rating ?? (player?.skill_level ? String(player.skill_level) : (isDisplayingDemo ? '3.5' : '—'));

  const STATS = [
    { label: 'Record', value: `${totalWins}W–${totalLosses}L`, sub: `${winRate}% win rate`,      icon: 'tennisball-outline' as const, color: Colors.primary },
    { label: 'Active',  value: String(sourceActive.length),    sub: `${sourceCompleted.length} completed`, icon: 'flame-outline' as const,     color: Palette.orange500 },
    { label: 'Streak',  value: streak > 0 ? `${streak}W` : '—', sub: 'win streak',               icon: 'flash-outline' as const,    color: '#eab308' },
    { label: 'Rating',  value: rating,                          sub: player?.usta_rating ? 'USTA' : 'skill level', icon: 'star-outline' as const, color: Colors.primary },
  ];

  if (selectedReg) {
    return (
      <SafeAreaView style={styles.safe} edges={[]}>
        <LeagueDetailView
          registration={selectedReg}
          onBack={() => setSelectedReg(null)}
          navigation={navigation}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />
      {/* Dark gradient header */}
      <LinearGradient
        colors={[Palette.dark900, Palette.dark700]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.gradHeader, { paddingTop: insets.top + Spacing.md }]}
      >
        <TouchableOpacity style={styles.gradBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.gradTitle}>My Leagues</Text>
          <Text style={styles.gradSub}>Track divisions, standings &amp; playoffs</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
      >
        <View style={styles.content}>
          {!LEAGUE_ACTIVITIES_AVAILABLE ? (
            <View style={styles.unavailableCard}>
              <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.unavailableTitle}>League activities are not available at this time.</Text>
              <Text style={styles.unavailableSub}>Check back soon — new league registrations will open shortly.</Text>
            </View>
          ) : loading && !refreshing ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* 4-stat strip */}
              <View style={styles.statsGrid}>
                {STATS.map(s => (
                  <View key={s.label} style={styles.statCard}>
                    <View style={styles.statIconRow}>
                      <Ionicons name={s.icon} size={14} color={s.color} />
                      <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statSub}>{s.sub}</Text>
                  </View>
                ))}
              </View>

              {/* Demo notice */}
              {isDisplayingDemo && (
                <View style={styles.demoBanner}>
                  <Ionicons name="information-circle-outline" size={15} color={Colors.textMuted} />
                  <Text style={styles.demoBannerText}>Showing example data — join a real league to see your stats.</Text>
                </View>
              )}

              {/* Active leagues */}
              {sourceActive.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Active</Text>
                    {isDisplayingDemo && (
                      <View style={styles.demoPill}><Text style={styles.demoPillText}>demo</Text></View>
                    )}
                  </View>
                  {sourceActive.map(reg => {
                    const r = reg as any;
                    const asgn = assignments.find(a => a.league_registration_id === reg.id);
                    const completed = r.is_demo ? 3 : (asgn?.matches_completed ?? 0);
                    const required  = r.is_demo ? 5 : (asgn?.matches_required  ?? 5);
                    const eligible  = r.is_demo ? false : (asgn?.playoff_eligible ?? false);
                    const pct = Math.min(100, Math.round((completed / required) * 100));
                    const divLabel = r.is_demo
                      ? 'Division A · Level 3.5'
                      : (asgn?.division ? `${asgn.division.division_name} · Level ${asgn.division.skill_level_range}` : null);
                    return (
                      <TouchableOpacity
                        key={reg.id}
                        style={styles.leagueCard}
                        onPress={() => setSelectedReg(reg)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.leagueCardHeader}>
                          <View style={styles.leagueTitleRow}>
                            <Text style={styles.leagueName} numberOfLines={1}>{reg.league_name || 'League'}</Text>
                          </View>
                          <View style={styles.leagueBadgeRow}>
                            {eligible
                              ? <View style={styles.playoffReadyBadge}><Ionicons name="shield-checkmark-outline" size={11} color="#fff" /><Text style={styles.playoffReadyText}>Playoff Ready</Text></View>
                              : <View style={styles.inProgressBadge2}><Text style={styles.inProgressText2}>In Progress</Text></View>
                            }
                          </View>
                        </View>
                        {divLabel && (
                          <Text style={styles.divLabel}>{divLabel}</Text>
                        )}
                        {/* Progress bar */}
                        <View style={styles.progressSection}>
                          <View style={styles.progressLabelRow}>
                            <Text style={styles.progressLabel}>Match progress</Text>
                            <Text style={styles.progressCount}>{completed}/{required}</Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
                          </View>
                        </View>
                        <View style={styles.viewLeagueRow}>
                          <Text style={styles.viewLeagueText}>View League</Text>
                          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Completed leagues */}
              {sourceCompleted.length > 0 && (() => {
                const sorted = [...sourceCompleted].sort((a, b) =>
                  new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
                );
                const visible = sorted.slice(0, completedPage);
                return (
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHead}>
                      <Text style={styles.sectionTitle}>Completed</Text>
                      <Text style={styles.sectionCount}>{sourceCompleted.length} total</Text>
                    </View>
                    {visible.map(reg => (
                      <TouchableOpacity
                        key={reg.id}
                        style={[styles.leagueCard, styles.leagueCardCompleted]}
                        onPress={() => setSelectedReg(reg)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.leagueCardHeader}>
                          <Text style={styles.leagueName} numberOfLines={1}>{reg.league_name || 'League'}</Text>
                          <View style={styles.completedBadge}><Text style={styles.completedBadgeText}>Completed</Text></View>
                        </View>
                        <Text style={styles.divLabel}>
                          Season {reg.created_at ? new Date(reg.created_at).getFullYear() : '—'}
                        </Text>
                        <View style={styles.viewLeagueRow}>
                          <Text style={styles.viewLeagueText}>View Details</Text>
                          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                        </View>
                      </TouchableOpacity>
                    ))}
                    {sorted.length > completedPage && (
                      <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setCompletedPage(p => p + 3)}>
                        <Text style={styles.loadMoreText}>Load more ({sorted.length - completedPage} remaining)</Text>
                        <Ionicons name="chevron-down" size={14} color={Colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}

              {/* Empty state */}
              {sourceActive.length === 0 && sourceCompleted.length === 0 && !isDisplayingDemo && (
                <View style={styles.emptyCard}>
                  <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No leagues yet</Text>
                  <Text style={styles.emptySub}>Join a league to compete with players at your skill level.</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('JoinLeague')}>
                    <Text style={styles.emptyBtnText}>Browse Leagues</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Browse / Join CTA */}
              <TouchableOpacity style={styles.ctaCard} onPress={() => navigation.navigate('JoinLeague')}>
                <View style={styles.ctaIcon}><Ionicons name="trophy-outline" size={18} color={Colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ctaTitle}>{isDisplayingDemo ? 'Ready to compete for real?' : 'Looking for more competition?'}</Text>
                  <Text style={styles.ctaSub}>{isDisplayingDemo ? 'Join a league to start playing' : 'Browse open leagues to join'}</Text>
                </View>
                <View style={styles.ctaBtn}><Text style={styles.ctaBtnText}>Browse</Text></View>
              </TouchableOpacity>
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

  // Unavailable state
  unavailableCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: Spacing.sm },
  unavailableTitle: { fontSize: FontSize.md, fontFamily: Font.semibold, color: Colors.textMuted, textAlign: 'center', maxWidth: 280 },
  unavailableSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', maxWidth: 260, opacity: 0.7 },

  // Gradient header
  gradHeader: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  gradBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  gradTitle: { fontSize: FontSize.xxxl, fontFamily: Font.black, color: '#fff', letterSpacing: -1 },
  gradSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // Stat strip
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: { width: '47.5%', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 3, ...Shadow.xs },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: Font.medium },
  statValue: { fontSize: FontSize.xxl, fontFamily: Font.bold, color: Colors.text, letterSpacing: -0.5 },
  statSub: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Overview sections
  sectionBlock: { gap: Spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sectionTitle: { fontSize: FontSize.xs, fontFamily: Font.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Font.medium },
  loadMoreBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.separator, marginTop: 4 },
  loadMoreText: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: Font.semibold },
  demoPill: { backgroundColor: Colors.borderLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  demoPillText: { fontSize: 10, color: Colors.textMuted },

  // League cards
  leagueCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, borderLeftColor: Colors.primary, gap: Spacing.sm, ...Shadow.sm },
  leagueCardCompleted: { opacity: 0.75, borderLeftColor: Colors.textMuted },
  leagueCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  leagueTitleRow: { flex: 1 },
  leagueName: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  leagueBadgeRow: { flexShrink: 0 },
  playoffReadyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#16a34a', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  playoffReadyText: { fontSize: 10, color: '#fff', fontFamily: Font.semibold },
  inProgressBadge2: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  inProgressText2: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: Font.medium },
  completedBadge: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  completedBadgeText: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Font.medium },
  divLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Progress bar on league card
  progressSection: { gap: 5 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  progressCount: { fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.text },
  progressTrack: { height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },

  viewLeagueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  viewLeagueText: { fontSize: FontSize.sm, color: Colors.primary, fontFamily: Font.semibold },

  // Browse CTA card
  ctaCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryLight },
  ctaIcon: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  ctaSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  ctaBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  ctaBtnText: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Font.medium },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontFamily: Font.semibold, color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  emptyBtnText: { color: '#fff', fontFamily: Font.semibold, fontSize: FontSize.md },

  // Detail header
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  detailHeader: { backgroundColor: Colors.surface, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  backBtnText: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Font.medium },
  detailTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: FontSize.lg, fontFamily: Font.bold, color: Colors.text },
  detailSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statusBadgeGreen: { backgroundColor: Colors.successLight },
  statusBadgeGray: { backgroundColor: Colors.borderLight },
  statusBadgeText: { fontSize: FontSize.xs, fontFamily: Font.semibold },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Font.medium },
  tabLabelActive: { color: Colors.primary, fontFamily: Font.semibold },
  tabScroll: { padding: Spacing.lg, gap: Spacing.md },

  // Tab empty states
  tabEmpty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xxl },
  tabEmptyTitle: { fontSize: FontSize.lg, fontFamily: Font.semibold, color: Colors.text },
  tabEmptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  scheduleBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm },
  scheduleBtnText: { color: '#fff', fontFamily: Font.semibold, fontSize: FontSize.md },
  tabContent: { gap: Spacing.md },

  // Tournament banner
  tournamentBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: Radius.md, padding: Spacing.md },
  tournamentDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success },
  tournamentTitle: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: '#166534' },
  tournamentSub: { fontSize: FontSize.xs, color: '#16a34a' },
  inProgressBadge: { backgroundColor: '#16a34a', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  inProgressText: { fontSize: FontSize.xs, color: '#fff', fontFamily: Font.semibold },

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
  matchOpponent: { fontSize: FontSize.md, fontFamily: Font.semibold, color: Colors.text },
  matchBadgeRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 2 },
  resultBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  resultBadgeWin: { backgroundColor: '#dcfce7' },
  resultBadgeLoss: { backgroundColor: '#fee2e2' },
  resultBadgePending: { backgroundColor: '#dbeafe' },
  resultBadgeText: { fontSize: FontSize.xs, fontFamily: Font.semibold },
  scheduleMatchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm },
  scheduleMatchBtnText: { fontSize: FontSize.xs, color: '#fff', fontFamily: Font.semibold },
  matchMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  matchMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchMetaText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  scoreBox: { backgroundColor: Colors.background, borderRadius: Radius.sm, padding: Spacing.sm },
  scoreLabel: { fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.textSecondary, marginBottom: 2 },
  scoreValue: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },

  // Schedule new match button
  scheduleNewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed' },
  scheduleNewBtnText: { fontSize: FontSize.md, color: Colors.primary, fontFamily: Font.semibold },

  // Demo banner
  demoBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.borderLight, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  demoBannerText: { fontSize: FontSize.xs, color: Colors.textMuted, flex: 1, lineHeight: 18 },

  // Match sections (Upcoming / Recent Results grouping)
  matchSection: { gap: Spacing.sm },
  matchSectionLabel: { fontSize: FontSize.xs, fontFamily: Font.bold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 2 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 2, marginBottom: 2 },
  weekDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  weekLabel: { fontSize: FontSize.xs, fontFamily: Font.bold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  weekDate: { fontSize: FontSize.xs, fontFamily: Font.regular, color: Colors.textMuted },

  // Other-player (non-user) match card styling
  matchCardOther: { opacity: 0.85 },
  matchIconOther: { backgroundColor: Colors.borderLight },

  // Badge variants
  resultBadgeOther: { backgroundColor: Colors.borderLight },
  enterScoreBadge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  enterScoreBadgeText: { fontSize: FontSize.xs, color: '#fff', fontFamily: Font.bold },

  // Match action buttons
  matchActions: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  matchActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1.5, borderColor: '#ea580c' },
  matchActionBtnOrange: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
  matchActionBtnText: { fontSize: FontSize.sm, fontFamily: Font.semibold },

  // Playoff inline badge on match card
  playoffMatchBadge: { backgroundColor: '#f59e0b', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  playoffMatchBadgeText: { fontSize: 10, color: '#fff', fontFamily: Font.bold },

  // Active tournament note
  activeTournamentNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#f0fdf4', borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm },
  activeTournamentText: { fontSize: FontSize.sm, color: '#166534', fontFamily: Font.medium },

  // Playoff bracket
  playoffHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  playoffHeaderTitle: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text, flex: 1 },
  playoffRound: { gap: Spacing.sm },
  playoffRoundLabel: { fontSize: FontSize.sm, fontFamily: Font.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  playoffMatchCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  playoffMatchPlayers: { gap: Spacing.xs },
  playoffPlayer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.background },
  playoffPlayerWinner: { backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#fde047' },
  playoffPlayerName: { fontSize: FontSize.sm, fontFamily: Font.medium, color: Colors.text, flex: 1 },
  playoffVs: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Font.bold, textAlign: 'center', paddingVertical: 2 },
  playoffScore: { fontSize: FontSize.sm, fontFamily: Font.bold, color: Colors.text, textAlign: 'center' },
  playoffMatchMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },

  // My status card (Division tab)
  myStatusCard: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary, gap: Spacing.sm },
  myStatusTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  myStatusAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  myStatusAvatarText: { fontSize: FontSize.sm, fontFamily: Font.bold, color: '#fff' },
  myStatusNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  myStatusName: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  rankPill: { backgroundColor: Colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  rankPillText: { fontSize: 10, color: Colors.textSecondary, fontFamily: Font.semibold },
  myStatusStatsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  myStatusWins: { fontSize: FontSize.sm, fontFamily: Font.bold, color: Colors.success },
  myStatusLosses: { fontSize: FontSize.sm, fontFamily: Font.bold, color: Colors.error },
  myStatusPts: { fontSize: FontSize.sm, color: Colors.textSecondary },
  myStatusWr: { fontSize: FontSize.sm, color: Colors.textSecondary },
  myStatusProgress: { gap: 5 },
  progressFillGreen: { backgroundColor: Colors.success },

  // Division context badges
  divBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  divBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  divBadgeText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontFamily: Font.medium },

  // Footer note
  divFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, backgroundColor: Colors.borderLight, borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.xs },
  divFooterText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Division standings
  standingsHeader: { gap: 2, marginBottom: Spacing.xs },
  standingsTitle: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  standingsSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  standingRowSelf: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary, borderWidth: 2 },
  rankCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rankCircleSelf: { backgroundColor: Colors.primary },
  rankCircleTop: { backgroundColor: '#f59e0b' },
  rankCircleDefault: { backgroundColor: Colors.borderLight },
  rankText: { fontSize: FontSize.sm, fontFamily: Font.bold, color: Colors.textMuted },
  standingNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  standingName: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  youBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  youBadgeText: { fontSize: 10, color: '#fff', fontFamily: Font.bold },
  standingStats: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  standingRight: { alignItems: 'flex-end', gap: Spacing.xs },
  playoffBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#16a34a', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  playoffBadgeText: { fontSize: 10, color: '#fff', fontFamily: Font.semibold },
  matchesNeeded: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },
  scheduleSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary },
  scheduleSmallBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontFamily: Font.medium },

  // League-wide standings
  myRankBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary },
  myRankLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  myRankNum: { fontSize: 32, fontFamily: Font.bold, color: Colors.primary },
  myRankLabel: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.primaryDark },
  myRankPts: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2 },
  myRankGap: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  myRankGapText: { fontSize: FontSize.xs, color: Colors.primary, fontFamily: Font.semibold },
  divisionPill: { backgroundColor: Colors.borderLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  divisionPillText: { fontSize: 10, color: Colors.textSecondary, fontFamily: Font.medium },
  pointsValue: { fontSize: FontSize.md, fontFamily: Font.bold, color: Colors.text },
  pointsLabel: { fontSize: FontSize.xs, color: Colors.textMuted },

  // ── Beautiful League Table (Division standings) ──────────────────────────────
  leagueTable: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  tableHeaderText: { fontSize: 10, fontFamily: Font.bold, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableNumHeader: { width: 28, textAlign: 'center' as const },
  tableNumHeaderPts: { width: 32, textAlign: 'center' as const },
  tableNumHeaderWr: { width: 38, textAlign: 'center' as const },

  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tableRowSelf: { backgroundColor: '#fff7ed', borderLeftWidth: 3, borderLeftColor: Colors.primary },
  tableRowLast: { borderBottomWidth: 0 },

  tableRankCol: { width: 32, alignItems: 'center', justifyContent: 'center' },
  tableRankNum: { fontSize: 13, fontFamily: Font.bold, color: Colors.textMuted, textAlign: 'center' },
  tableRankNumSelf: { color: Colors.primary },
  tableMedal: { fontSize: 16, textAlign: 'center' },

  tableNameCell: { flex: 1, paddingRight: 4 },
  tablePlayerName: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: Colors.text },
  tablePlayerNameSelf: { color: Colors.primary, fontFamily: Font.bold },
  tableNameBadges: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tableLeagueSub: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  tableLeagueDiv: { fontSize: 10, color: Colors.textMuted, fontFamily: Font.medium, flexShrink: 1 },
  tableYouBadge: { backgroundColor: Colors.primary, paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radius.full },
  tableYouText: { fontSize: 8, color: '#fff', fontFamily: Font.bold, letterSpacing: 0.5 },
  tablePlayoffDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },

  tableNumCell: { width: 28, textAlign: 'center' as const, fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.text },
  tableNumSelf: { color: Palette.orange500 },
  tableWinNum: { color: Colors.success },
  tableLossNum: { color: Colors.error },
  tablePtsCell: { width: 32, textAlign: 'center' as const, fontSize: FontSize.sm, fontFamily: Font.bold, color: Colors.primary },
  tableWrCell: { width: 38, textAlign: 'center' as const, fontSize: FontSize.xs, fontFamily: Font.semibold, color: Colors.textSecondary },

  // ── Book Match button ─────────────────────────────────────────────────────────
  bookMatchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.primary },
  bookMatchBtnText: { fontSize: FontSize.sm, fontFamily: Font.semibold, color: '#fff' },
});
