import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Trophy,
  Calendar,
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  BarChart3,
  TrendingUp,
  Target,
  Award,
  ChevronRight,
  CalendarDays,
  Flame,
  Star,
  CheckCircle2,
  CircleDashed,
  Swords,
  ShieldCheck,
  Zap,
  Globe,
  Crown,
} from 'lucide-react';
import { useDivisionMatches } from '@/hooks/useDivisionMatches';
import { useDivisionLeaderboard } from '@/hooks/useDivisionLeaderboard';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { useLeagueGroups } from '@/hooks/useLeagueGroups';
import { usePlayoffBracket } from '@/hooks/usePlayoffBracket';
import { supabase } from '@/integrations/supabase/client';
import MatchScoringModal from './MatchScoringModal';
import { toast } from 'sonner';

interface EnhancedMyLeaguesTabProps {
  player: any;
  registrations: any[];
  onNavigateToSchedule?: (opponentId?: string, opponentName?: string) => void;
}

interface DivisionInfo {
  id: string;
  tournament_status: string;
  division_name: string;
  skill_level_range?: string;
  competitiveness?: string;
  season?: string;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const getLeagueStatus = (league: any): 'In Progress' | 'Completed' => {
  const dateStr = league.created_at || league.registration_date;
  if (!dateStr) return 'In Progress'; // treat unknown-date registrations as active
  const months = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return months < 3 ? 'In Progress' : 'Completed';
};

const wr = (wins: number, total: number) =>
  total > 0 ? Math.round((wins / total) * 100) : 0;

const FormDot = ({ result }: { result: 'W' | 'L' }) => (
  <span
    className={`inline-flex w-5 h-5 rounded-full text-[10px] font-bold text-white items-center justify-center ${
      result === 'W' ? 'bg-green-500' : 'bg-red-500'
    }`}
  >
    {result}
  </span>
);

const RankMedal = ({ rank }: { rank: number }) => {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return (
    <span className="inline-flex w-7 h-7 rounded-full bg-muted text-sm font-bold text-muted-foreground items-center justify-center">
      {rank}
    </span>
  );
};

const PlayerAvatar = ({
  name,
  avatarUrl,
  size = 'sm',
}: {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md';
}) => {
  const s = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <Avatar className={`${s} shrink-0`}>
      <AvatarImage src={avatarUrl ?? undefined} />
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
};

// ── Dummy data (shown when user has no real league registrations) ────────────

const _d = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const _p = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const DUMMY_REGISTRATIONS = [
  {
    id: '__demo_1',
    league_id: '__demo_league_1',
    league_name: 'Spring Open Singles 2026',
    status: 'active',
    created_at: _p(28),
    registration_date: _p(28),
    is_demo: true,
  },
  {
    id: '__demo_2',
    league_id: '__demo_league_2',
    league_name: 'City Doubles Championship',
    status: 'active',
    created_at: _p(14),
    registration_date: _p(14),
    is_demo: true,
  },
  {
    id: '__demo_3',
    league_id: '__demo_league_3',
    league_name: 'Intermediate League — Season 3',
    status: 'completed',
    created_at: _p(120),
    registration_date: _p(120),
    is_demo: true,
  },
];

const DUMMY_MATCHES = [
  // ── User's upcoming matches
  {
    id: '__dm_1',
    match_date: _d(3),
    player1_name: 'You',
    player2_name: 'Alex Chen',
    player1_id: '__me__',
    player2_id: '__p2__',
    winner_id: undefined,
    status: 'scheduled',
    court_location: 'Court 3 — North Club',
    isUserMatch: true,
    userIsPlayer1: true,
    opponent_name: 'Alex Chen',
    result: 'pending' as const,
  },
  {
    id: '__dm_2',
    match_date: _d(7),
    player1_name: 'Jordan Lee',
    player2_name: 'You',
    player1_id: '__p3__',
    player2_id: '__me__',
    winner_id: undefined,
    status: 'scheduled',
    court_location: 'Court 1 — East Wing',
    isUserMatch: true,
    userIsPlayer1: false,
    opponent_name: 'Jordan Lee',
    result: 'pending' as const,
  },
  // ── Other division matches (upcoming)
  {
    id: '__dm_3',
    match_date: _d(2),
    player1_name: 'Marcus Webb',
    player2_name: 'Sam Rivera',
    player1_id: '__p4__',
    player2_id: '__p5__',
    winner_id: undefined,
    status: 'scheduled',
    court_location: 'Court 5 — South Club',
    isUserMatch: false,
    userIsPlayer1: false,
    opponent_name: '',
    result: 'pending' as const,
  },
  {
    id: '__dm_4',
    match_date: _d(5),
    player1_name: 'Priya Nair',
    player2_name: 'Taylor Brooks',
    player1_id: '__p6__',
    player2_id: '__p7__',
    winner_id: undefined,
    status: 'scheduled',
    court_location: 'Court 2 — West Side',
    isUserMatch: false,
    userIsPlayer1: false,
    opponent_name: '',
    result: 'pending' as const,
  },
  // ── Completed matches
  {
    id: '__dm_5',
    match_date: _p(3),
    player1_name: 'You',
    player2_name: 'Marcus Webb',
    player1_id: '__me__',
    player2_id: '__p4__',
    winner_id: '__me__',
    status: 'completed',
    court_location: 'Court 3 — North Club',
    set1_player1: 6, set1_player2: 3,
    set2_player1: 6, set2_player2: 4,
    set3_player1: null, set3_player2: null,
    isUserMatch: true,
    userIsPlayer1: true,
    opponent_name: 'Marcus Webb',
    result: 'win' as const,
  },
  {
    id: '__dm_6',
    match_date: _p(6),
    player1_name: 'Alex Chen',
    player2_name: 'Sam Rivera',
    player1_id: '__p2__',
    player2_id: '__p5__',
    winner_id: '__p2__',
    status: 'completed',
    court_location: 'Court 1 — East Wing',
    set1_player1: 7, set1_player2: 5,
    set2_player1: 4, set2_player2: 6,
    set3_player1: 6, set3_player2: 3,
    isUserMatch: false,
    userIsPlayer1: false,
    opponent_name: '',
    result: 'pending' as const,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

const EnhancedMyLeaguesTab: React.FC<EnhancedMyLeaguesTabProps> = ({
  player,
  registrations,
  onNavigateToSchedule,
}) => {
  const [viewState, setViewState] = useState<{
    view: 'overview' | 'details';
    selectedLeague?: any;
  }>({ view: 'overview' });
  const [divisionInfo, setDivisionInfo] = useState<DivisionInfo | null>(null);
  const [scoringMatch, setScoringMatch] = useState<any>(null);
  const navigate = useNavigate();

  const activeRegistrations = registrations.filter(
    (l) => getLeagueStatus(l) === 'In Progress',
  );
  const completedRegistrations = registrations.filter(
    (l) => getLeagueStatus(l) === 'Completed',
  );

  // When user has no real leagues yet, fall back to demo data for the overview
  const displayRegs = registrations.length > 0 ? registrations : DUMMY_REGISTRATIONS;
  const displayActive = displayRegs.filter((l) => getLeagueStatus(l) === 'In Progress');
  const displayCompleted = displayRegs.filter((l) => getLeagueStatus(l) === 'Completed');
  const isDisplayingDemo = registrations.length === 0;

  const { assignments } = useDivisionAssignments();

  const divisionId = viewState.selectedLeague
    ? assignments.find((a) => a.league_registration_id === viewState.selectedLeague?.id)
        ?.division_id
    : undefined;

  const currentAssignment = viewState.selectedLeague
    ? assignments.find((a) => a.league_registration_id === viewState.selectedLeague?.id)
    : undefined;

  const leagueId: string | undefined = viewState.selectedLeague?.league_id;

  const { matches, loading: matchesLoading } = useDivisionMatches(divisionId);
  const { leaderboard, loading: lbLoading, currentUser: meStats } =
    useDivisionLeaderboard(divisionId);
  const { groups, overallStandings, loading: groupsLoading } = useLeagueGroups(
    leagueId,
    divisionId,
  );
  const { rounds: playoffRounds, hasData: hasPlayoffs, loading: playoffLoading } =
    usePlayoffBracket(divisionId);

  useEffect(() => {
    if (!divisionId) { setDivisionInfo(null); return; }
    supabase
      .from('divisions')
      .select('id, tournament_status, division_name, skill_level_range, competitiveness, season')
      .eq('id', divisionId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setDivisionInfo(data as DivisionInfo);
      });
  }, [divisionId]);

  const handleScheduleMatch = (opponentId: string, opponentName: string) => {
    if (onNavigateToSchedule) {
      onNavigateToSchedule(opponentId, opponentName);
    } else {
      const divId = divisionInfo?.id || divisionId;
      const divName = divisionInfo?.division_name || 'League';
      toast.info(`Opening ${opponentName}'s availability…`);
      navigate(
        `/public-availability/${opponentId}?source=league&divisionId=${divId}&divisionName=${encodeURIComponent(divName)}`,
      );
    }
  };

  // ── Overview ────────────────────────────────────────────────────────────────

  const renderOverview = () => {
    const totalWins = player?.wins ?? 0;
    const totalLosses = player?.losses ?? 0;
    const totalMatches = totalWins + totalLosses;
    const streak = player?.current_streak ?? 0;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            My Leagues
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track divisions, group standings, and your path to playoffs
          </p>
        </div>

        {/* Aggregate stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Record', value: isDisplayingDemo ? '4W–1L' : `${totalWins}W–${totalLosses}L`, icon: <Swords className="w-4 h-4 text-primary" />, sub: isDisplayingDemo ? '80% win rate' : `${wr(totalWins, totalMatches)}% win rate` },
              { label: 'Active', value: displayActive.length, icon: <Flame className="w-4 h-4 text-orange-500" />, sub: `${displayCompleted.length} completed` },
              { label: 'Streak', value: isDisplayingDemo ? '2W' : (streak > 0 ? `${streak}W` : '—'), icon: <Zap className="w-4 h-4 text-yellow-500" />, sub: 'win streak' },
              { label: 'Rating', value: player?.usta_rating ?? player?.skill_level ?? (isDisplayingDemo ? '3.5' : '—'), icon: <Star className="w-4 h-4 text-primary" />, sub: player?.usta_rating ? 'USTA' : 'skill level' },
            ].map((s) => (
              <Card key={s.label} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-muted-foreground">{s.label}</span></div>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Active leagues */}
        {displayActive.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              Active
              {isDisplayingDemo && <Badge variant="outline" className="text-[10px] py-0 px-1.5 normal-case font-normal">demo</Badge>}
            </h2>
            <div className="grid gap-3">
              {displayActive.map((league) => {
                const asgn = assignments.find((a) => a.league_registration_id === league.id);
                const completed = league.is_demo ? 3 : (asgn?.matches_completed ?? 0);
                const required = league.is_demo ? 5 : (asgn?.matches_required ?? 5);
                const eligible = league.is_demo ? false : (asgn?.playoff_eligible ?? false);
                const divLabel = league.is_demo ? 'Division A · Level 3.5' : (asgn?.division ? `${asgn.division.division_name} · Level ${asgn.division.skill_level_range}` : null);
                const pct = Math.min(100, Math.round((completed / required) * 100));
                return (
                  <Card
                    key={league.id}
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-primary group"
                    onClick={() => setViewState({ view: 'details', selectedLeague: league })}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-base group-hover:text-primary transition-colors truncate">{league.league_name}</h3>
                            {eligible ? (
                              <Badge className="bg-green-600 text-white text-xs shrink-0"><ShieldCheck className="w-3 h-3 mr-1" />Playoff Ready</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs shrink-0">In Progress</Badge>
                            )}
                          </div>
                          {divLabel && (
                            <p className="text-sm text-muted-foreground mb-3">{divLabel}</p>
                          )}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Match progress</span>
                              <span className="font-medium text-foreground">{completed}/{required}</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="shrink-0 text-primary hover:bg-primary/10"
                          onClick={(e) => { e.stopPropagation(); setViewState({ view: 'details', selectedLeague: league }); }}>
                          View<ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed leagues */}
        {displayCompleted.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completed</h2>
            <div className="grid gap-3">
              {displayCompleted.map((league) => (
                <Card key={league.id} className="cursor-pointer hover:shadow-md opacity-75 hover:opacity-100 group"
                  onClick={() => setViewState({ view: 'details', selectedLeague: league })}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{league.league_name}</h3>
                        <p className="text-sm text-muted-foreground">Season {new Date(league.created_at).getFullYear()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Completed</Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* "Browse leagues" CTA — always shown */}
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0"><Trophy className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="font-medium text-sm">{isDisplayingDemo ? 'Ready to compete for real?' : 'Looking for more competition?'}</p>
                  <p className="text-xs text-muted-foreground">{isDisplayingDemo ? 'Join a league to start playing' : 'Browse open leagues to join'}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate('/dashboard?tab=register')}>Browse</Button>
            </div>
          </CardContent>
        </Card>

      </div>
    );
  };

  // ── Detail: Matches ─────────────────────────────────────────────────────────

  const renderMatches = () => {
    const isDemoLeague = !!(viewState.selectedLeague?.is_demo);

    if (matchesLoading && !isDemoLeague)
      return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />)}</div>;

    // Use dummy matches for demo leagues; real matches for real leagues
    const allMatches: any[] = isDemoLeague ? DUMMY_MATCHES : matches;
    const isTournament = !isDemoLeague && divisionInfo?.tournament_status === 'active';

    const upcoming = allMatches.filter((m) => m.status === 'scheduled');
    const recent   = allMatches.filter((m) => m.status === 'completed');

    if (allMatches.length === 0) return (
      <Card><CardContent className="text-center py-10">
        <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
        <h3 className="font-medium mb-1">No matches yet</h3>
        <p className="text-sm text-muted-foreground">Matches appear once scheduled in your division.</p>
      </CardContent></Card>
    );

    const MatchCard = ({ match }: { match: any }) => {
      const isScheduled = match.status === 'scheduled';
      const isCompleted = match.status === 'completed';
      const matchDatePassed = match.match_date && new Date(match.match_date) < new Date();
      // "Enter Score" = user is a participant, match has no winner yet, and match has passed or is marked complete
      const needsScore = !match.winner_id && match.isUserMatch && (isCompleted || (isScheduled && matchDatePassed));

      // Border colour: user matches get result-based colour; other division matches are neutral
      const borderColor = match.isUserMatch
        ? (isTournament && isScheduled ? 'border-l-blue-500'
          : match.result === 'win'  ? 'border-l-green-500'
          : match.result === 'loss' ? 'border-l-red-500'
          : 'border-l-primary/40')
        : 'border-l-muted-foreground/20';

      // Icon/bg for user matches; neutral icon for other division matches
      const iconBg = match.isUserMatch
        ? (match.result === 'win'  ? 'bg-green-100 dark:bg-green-900 text-green-600'
          : match.result === 'loss' ? 'bg-red-100 dark:bg-red-900 text-red-600'
          : 'bg-blue-100 dark:bg-blue-900 text-blue-600')
        : 'bg-muted/50 text-muted-foreground';
      const Icon = match.isUserMatch
        ? (match.result === 'win' ? Trophy : match.result === 'loss' ? Target : Clock)
        : Swords;

      // Match title: user matches show "vs Opponent"; other division matches show both names
      const matchTitle = match.isUserMatch
        ? `vs ${match.opponent_name}`
        : `${match.player1_name} vs ${match.player2_name}`;

      return (
        <Card className={`border-l-4 ${borderColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm">{matchTitle}</span>
                  {match.isUserMatch && match.result === 'win'  && <Badge className="bg-green-600 text-white text-xs">Win</Badge>}
                  {match.isUserMatch && match.result === 'loss' && <Badge variant="destructive" className="text-xs">Loss</Badge>}
                  {isScheduled && <Badge variant="secondary" className="text-xs">Upcoming</Badge>}
                  {isCompleted && !match.isUserMatch && <Badge variant="outline" className="text-xs">Completed</Badge>}
                  {needsScore && <Badge className="bg-primary/90 text-white text-xs">Enter Score</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {match.match_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(match.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {match.court_location && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{match.court_location}</span>
                  )}
                  {isCompleted && match.set1_player1 != null && match.set1_player2 != null && (
                    <span className="font-medium text-foreground">
                      {match.set1_player1}–{match.set1_player2}
                      {match.set2_player1 != null && `, ${match.set2_player1}–${match.set2_player2}`}
                      {match.set3_player1 != null && `, ${match.set3_player1}–${match.set3_player2}`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {needsScore && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white h-7 text-xs"
                    onClick={() => {
                      if (isDemoLeague) {
                        toast.info('Join a real league to submit scores.', { duration: 3000 });
                        return;
                      }
                      setScoringMatch(match);
                    }}
                  >
                    <Trophy className="w-3 h-3 mr-1" />I Won
                  </Button>
                )}
                {isScheduled && match.isUserMatch && !isDemoLeague && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleScheduleMatch(
                      match.userIsPlayer1 ? match.player2_id : match.player1_id,
                      match.opponent_name,
                    )}
                  >
                    <Calendar className="w-3 h-3 mr-1" />Schedule
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    };

    return (
      <div className="space-y-5">
        {isDemoLeague && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-dashed text-xs text-muted-foreground">
            <Star className="w-3.5 h-3.5 shrink-0" />
            Demo data — join a real league to see your live match schedule and enter scores.
          </div>
        )}
        {isTournament && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Tournament active — {divisionInfo?.division_name}</span>
            <Badge className="ml-auto bg-green-600 text-white text-xs">Live</Badge>
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming ({upcoming.length})
            </h3>
            {upcoming.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        )}
        {recent.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Results ({recent.length})
            </h3>
            {recent.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        )}
      </div>
    );
  };

  // ── Detail: My Group (single division leaderboard) ──────────────────────────

  const renderMyGroup = () => {
    if (lbLoading) return <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}</div>;
    const completed = currentAssignment?.matches_completed ?? 0;
    const required = currentAssignment?.matches_required ?? 5;
    const eligible = currentAssignment?.playoff_eligible ?? false;
    const pct = Math.min(100, Math.round((completed / required) * 100));
    const myRank = leaderboard.findIndex((p) => p.isCurrentUser) + 1;

    return (
      <div className="space-y-5">
        {/* My status card */}
        {meStats && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <PlayerAvatar name={meStats.name} avatarUrl={meStats.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{meStats.name}</span>
                    {eligible && <Badge className="bg-green-600 text-white text-xs"><ShieldCheck className="w-3 h-3 mr-0.5" />Playoff Ready</Badge>}
                    {myRank > 0 && <Badge variant="outline" className="text-xs">Rank #{myRank}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm mt-1 text-muted-foreground">
                    <span className="text-green-600 font-medium">{meStats.wins}W</span>
                    <span className="text-red-500 font-medium">{meStats.losses}L</span>
                    <span>{meStats.points} pts</span>
                    <span>{wr(meStats.wins, meStats.total_matches)}% WR</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Matches toward playoff eligibility</span>
                  <span className="font-medium text-foreground">{completed}/{required}</span>
                </div>
                <Progress value={pct} className={`h-1.5 ${eligible ? '[&>div]:bg-green-500' : ''}`} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Group context badges */}
        {divisionInfo && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{divisionInfo.division_name}</Badge>
            {divisionInfo.skill_level_range && <Badge variant="outline">Level {divisionInfo.skill_level_range}</Badge>}
            {divisionInfo.competitiveness && <Badge variant="outline">{divisionInfo.competitiveness}</Badge>}
          </div>
        )}

        {leaderboard.length === 0 ? (
          <Card><CardContent className="text-center py-10">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">No standings yet</h3>
            <p className="text-sm text-muted-foreground">Rankings appear once matches are played.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((p, idx) => {
              const isMe = p.isCurrentUser;
              const form: ('W' | 'L')[] = (p.recentForm || []).slice(0, 5) as ('W' | 'L')[];
              return (
                <div key={p.user_id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isMe ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-muted/20 border-transparent hover:bg-muted/40'}`}>
                  <div className="w-8 shrink-0 flex justify-center"><RankMedal rank={idx + 1} /></div>
                  <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${isMe ? 'text-primary' : ''}`}>{p.name}</span>
                      {isMe && <Badge variant="default" className="bg-primary text-xs py-0">You</Badge>}
                      {p.playoff_eligible && <Badge className="bg-green-600 text-white text-xs py-0"><ShieldCheck className="w-2.5 h-2.5 mr-0.5" />Playoff</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{p.wins}W–{p.losses}L · {wr(p.wins, p.total_matches)}%</span>
                      {form.length > 0 && <div className="flex items-center gap-0.5">{form.map((r, i) => <FormDot key={i} result={r} />)}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-bold">{p.points}</div>
                      <div className="text-xs text-muted-foreground">pts</div>
                    </div>
                    {!isMe && (
                      <Button size="sm" variant="outline" className="h-7 text-xs hover:bg-primary hover:text-white hover:border-primary transition-colors"
                        onClick={() => handleScheduleMatch(p.user_id, p.name)}>
                        <Swords className="w-3 h-3 mr-1" />Match Request
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
          <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span>Playoff eligibility requires {currentAssignment?.matches_required ?? 5} matches. Form dots show last 5 results.</span>
        </div>
      </div>
    );
  };

  // ── Detail: All Groups ──────────────────────────────────────────────────────

  const renderAllGroups = () => {
    if (groupsLoading) return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="h-48 rounded-lg bg-muted/40 animate-pulse" />)}
      </div>
    );

    if (groups.length === 0) return (
      <Card><CardContent className="text-center py-10">
        <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
        <h3 className="font-medium mb-1">No groups found</h3>
        <p className="text-sm text-muted-foreground">Groups appear once divisions are created for this league.</p>
      </CardContent></Card>
    );

    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {groups.length} group{groups.length !== 1 ? 's' : ''} in this league · each group is same-sex, same skill level · max 10 players
        </p>

        {groups.map((group) => {
          const top3 = group.players.slice(0, 3);
          const isMyGroup = group.isCurrentUserGroup;

          return (
            <Card key={group.id} className={`${isMyGroup ? 'border-primary/40 shadow-sm' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {group.division_name}
                      {isMyGroup && <Badge variant="default" className="bg-primary text-xs">Your Group</Badge>}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize">{group.gender_preference}</Badge>
                      <Badge variant="outline" className="text-xs">Level {group.skill_level_range}</Badge>
                      {group.competitiveness && <Badge variant="outline" className="text-xs">{group.competitiveness}</Badge>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{group.current_players}/{group.max_players}</div>
                    <div className="text-xs text-muted-foreground">players</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {group.players.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No players yet</p>
                ) : (
                  <div className="space-y-2">
                    {group.players.slice(0, 5).map((p, idx) => {
                      const isMe = p.isCurrentUser;
                      return (
                        <div key={p.user_id} className={`flex items-center gap-2.5 p-2.5 rounded-lg ${isMe ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/30'} transition-colors`}>
                          <div className="w-6 shrink-0 flex justify-center">
                            <RankMedal rank={idx + 1} />
                          </div>
                          <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-sm font-medium truncate ${isMe ? 'text-primary' : ''}`}>{p.name}</span>
                              {isMe && <Badge variant="default" className="bg-primary text-[10px] py-0 px-1">You</Badge>}
                              {p.playoff_eligible && <Badge className="bg-green-600 text-white text-[10px] py-0 px-1">✓ PO</Badge>}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-right shrink-0">
                            <div className="font-medium text-foreground">{p.points} pts</div>
                            <div>{p.wins}W–{p.losses}L</div>
                          </div>
                          {!isMe && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary shrink-0"
                              onClick={() => handleScheduleMatch(p.user_id, p.name)} title={`Send match request to ${p.name}`}>
                              <Swords className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {group.players.length > 5 && (
                      <p className="text-xs text-muted-foreground pl-2">+{group.players.length - 5} more players</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // ── Detail: Overall Standings ───────────────────────────────────────────────

  const renderOverallStandings = () => {
    if (groupsLoading) return (
      <div className="space-y-2">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />)}
      </div>
    );

    if (overallStandings.length === 0) return (
      <Card><CardContent className="text-center py-10">
        <Globe className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
        <h3 className="font-medium mb-1">No overall standings yet</h3>
        <p className="text-sm text-muted-foreground">Cross-group rankings appear once players are assigned to divisions.</p>
      </CardContent></Card>
    );

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          All {overallStandings.length} players across {groups.length} groups ranked by points
        </p>

        <div className="space-y-1.5">
          {overallStandings.map((p) => {
            const isMe = p.isCurrentUser;
            return (
              <div key={p.user_id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${isMe ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-muted/10 border-transparent hover:bg-muted/30'}`}>
                {/* Rank */}
                <div className="w-8 shrink-0 flex justify-center">
                  <RankMedal rank={p.overall_rank} />
                </div>

                <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-sm font-semibold ${isMe ? 'text-primary' : ''}`}>{p.name}</span>
                    {isMe && <Badge variant="default" className="bg-primary text-[10px] py-0 px-1">You</Badge>}
                    <span className="text-xs text-muted-foreground hidden sm:inline">· {p.division_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.wins}W–{p.losses}L · {p.win_rate}% WR
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">{p.points}</div>
                  <div className="text-xs text-muted-foreground">pts</div>
                </div>

                {!isMe && (
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 hover:bg-primary hover:text-white hover:border-primary transition-colors"
                    onClick={() => handleScheduleMatch(p.user_id, p.name)}>
                    <Swords className="w-3 h-3 mr-1" />Match Request
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
          Points: 3 per win + 1 per every 2 matches completed. All groups ranked together regardless of gender or skill tier.
        </div>
      </div>
    );
  };

  // ── Detail: Playoffs ────────────────────────────────────────────────────────

  const renderPlayoffs = () => {
    if (playoffLoading) return (
      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />)}</div>
    );

    const totalRounds = playoffRounds.length;

    if (!hasPlayoffs || totalRounds === 0) {
      const completed = currentAssignment?.matches_completed ?? 0;
      const required = currentAssignment?.matches_required ?? 5;
      const eligible = currentAssignment?.playoff_eligible ?? false;
      const pct = Math.min(100, Math.round((completed / required) * 100));
      const eligibleCount = leaderboard.filter(p => p.playoff_eligible).length;

      return (
        <div className="space-y-5">
          {/* Playoff eligibility overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Path to Playoffs
              </CardTitle>
              <CardDescription>
                {eligible
                  ? 'You\'re eligible! Playoffs begin once the regular season ends.'
                  : `Play ${Math.max(0, required - completed)} more match${required - completed !== 1 ? 'es' : ''} to qualify`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your progress</span>
                  <span className="font-bold">{completed}/{required} matches</span>
                </div>
                <Progress value={pct} className={`h-2.5 ${eligible ? '[&>div]:bg-green-500' : ''}`} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className={`text-center p-3 rounded-lg ${eligible ? 'bg-green-50 dark:bg-green-950' : 'bg-muted/40'}`}>
                  <div className={`text-xl font-bold ${eligible ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {eligible ? '✓' : completed}
                  </div>
                  <div className="text-xs text-muted-foreground">{eligible ? 'Eligible' : 'Completed'}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/40">
                  <div className="text-xl font-bold">{eligibleCount}</div>
                  <div className="text-xs text-muted-foreground">Division eligible</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/40">
                  <div className="text-xl font-bold">{leaderboard.length}</div>
                  <div className="text-xs text-muted-foreground">Total players</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Eligibility list */}
          {leaderboard.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  Eligibility Status
                </CardTitle>
                <CardDescription>Players who have met the match requirement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {leaderboard.map((p, idx) => (
                    <div key={p.user_id} className={`flex items-center gap-3 p-2.5 rounded-lg ${p.isCurrentUser ? 'bg-primary/5 border border-primary/20' : 'bg-muted/20'}`}>
                      <div className="w-6 shrink-0 flex justify-center"><RankMedal rank={idx + 1} /></div>
                      <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} />
                      <span className={`flex-1 text-sm font-medium ${p.isCurrentUser ? 'text-primary' : ''}`}>{p.name}</span>
                      {p.playoff_eligible ? (
                        <Badge className="bg-green-600 text-white text-xs"><ShieldCheck className="w-3 h-3 mr-0.5" />Eligible</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {Math.max(0, p.matches_required - p.matches_completed)} needed
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
            <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>The playoff bracket is generated by a league admin once the regular season concludes. Top seeds from each group advance.</span>
          </div>
        </div>
      );
    }

    // ── Bracket visualization ──────────────────────────────────────────────

    const BracketMatch = ({ match, isFinal }: { match: import('@/hooks/usePlayoffBracket').PlayoffMatch; isFinal: boolean }) => {
      const winner = match.winner_id;
      const isDone = match.status === 'completed';
      const isBye = match.status === 'bye';

      const PlayerSlot = ({ player, isWinner }: { player?: import('@/hooks/usePlayoffBracket').PlayoffMatchPlayer; isWinner: boolean }) => (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          isWinner ? 'bg-green-100 dark:bg-green-900' : isDone && !isWinner ? 'opacity-50' : 'bg-muted/40'
        }`}>
          {player ? (
            <>
              <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isWinner ? 'text-green-700 dark:text-green-300' : ''}`}>
                  {player.seed ? `[${player.seed}] ` : ''}{player.name}
                </div>
              </div>
              {isWinner && <Crown className="w-4 h-4 text-yellow-500 shrink-0" />}
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">TBD</span>
          )}
        </div>
      );

      return (
        <div className={`rounded-xl border-2 overflow-hidden min-w-[200px] ${isFinal ? 'border-primary shadow-md' : 'border-border'}`}>
          {isFinal && (
            <div className="bg-primary px-3 py-1 text-xs font-bold text-white text-center">FINAL</div>
          )}
          {isBye ? (
            <div className="p-3 text-center text-sm text-muted-foreground">BYE</div>
          ) : (
            <div className="divide-y">
              <PlayerSlot player={match.player1} isWinner={!!(winner && winner === match.player1?.user_id)} />
              <PlayerSlot player={match.player2} isWinner={!!(winner && winner === match.player2?.user_id)} />
            </div>
          )}
          {match.scheduled_date && !isDone && (
            <div className="px-3 py-1.5 bg-muted/30 text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(match.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
          {isDone && match.score && (
            <div className="px-3 py-1.5 bg-muted/30 text-xs font-medium text-center">
              {(match.score.sets || []).map(([a, b]: [number, number], i: number) => `${a}–${b}`).join(' ')}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="font-semibold">{divisionInfo?.division_name ?? 'Division'} Playoffs</span>
          <Badge variant="secondary" className="text-xs">{totalRounds}-round bracket</Badge>
        </div>

        {/* Horizontal scrolling bracket */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-6 min-w-max">
            {playoffRounds.map((round) => {
              const isFinalRound = round.round_number === totalRounds;
              return (
                <div key={round.round_number} className="flex flex-col gap-4">
                  {/* Round label */}
                  <div className={`text-center text-xs font-bold uppercase tracking-wide py-1.5 px-3 rounded-full ${isFinalRound ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {round.label}
                  </div>
                  {/* Matches, vertically spaced so lines would align */}
                  <div
                    className="flex flex-col gap-4 justify-around"
                    style={{ minHeight: `${Math.pow(2, totalRounds - round.round_number + 1) * 80}px` }}
                  >
                    {round.matches.map((match) => (
                      <BracketMatch key={match.id} match={match} isFinal={isFinalRound && round.matches.length === 1} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block" /> Winner</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-primary inline-block" /> Final</span>
          <span>Bracket seeding: highest-ranked vs lowest-ranked</span>
        </div>
      </div>
    );
  };

  // ── Detail wrapper ──────────────────────────────────────────────────────────

  const renderDetails = () => {
    const league = viewState.selectedLeague;
    if (!league) return null;
    const status = getLeagueStatus(league);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setViewState({ view: 'overview' })} className="shrink-0">
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{league.league_name}</h1>
              <Badge variant="secondary" className={`text-white shrink-0 ${status === 'In Progress' ? 'bg-green-500' : 'bg-gray-500'}`}>{status}</Badge>
              {league.is_demo && <Badge variant="outline" className="text-xs shrink-0">Demo</Badge>}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Season {new Date(league.created_at).getFullYear()}
              {divisionInfo && <><span>·</span><span>{divisionInfo.division_name}</span></>}
            </p>
          </div>
        </div>

        {/* 5-tab layout */}
        <Tabs defaultValue="matches" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="matches"    className="flex items-center gap-1 py-2.5"><Calendar  className="w-4 h-4 shrink-0" /><span className="hidden sm:inline text-xs">Matches</span></TabsTrigger>
            <TabsTrigger value="my-group"   className="flex items-center gap-1 py-2.5"><BarChart3 className="w-4 h-4 shrink-0" /><span className="hidden sm:inline text-xs">My Group</span></TabsTrigger>
            <TabsTrigger value="all-groups" className="flex items-center gap-1 py-2.5"><Users     className="w-4 h-4 shrink-0" /><span className="hidden sm:inline text-xs">All Groups</span></TabsTrigger>
            <TabsTrigger value="overall"    className="flex items-center gap-1 py-2.5"><Globe     className="w-4 h-4 shrink-0" /><span className="hidden sm:inline text-xs">Overall</span></TabsTrigger>
            <TabsTrigger value="playoffs"   className="flex items-center gap-1 py-2.5"><Trophy    className="w-4 h-4 shrink-0" /><span className="hidden sm:inline text-xs">Playoffs</span></TabsTrigger>
          </TabsList>

          <TabsContent value="matches">    {renderMatches()}          </TabsContent>
          <TabsContent value="my-group">   {renderMyGroup()}          </TabsContent>
          <TabsContent value="all-groups"> {renderAllGroups()}        </TabsContent>
          <TabsContent value="overall">    {renderOverallStandings()} </TabsContent>
          <TabsContent value="playoffs">   {renderPlayoffs()}         </TabsContent>
        </Tabs>
      </div>
    );
  };

  // ── Root ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {viewState.view === 'overview' ? renderOverview() : renderDetails()}

      {scoringMatch && (
        <MatchScoringModal
          open={!!scoringMatch}
          onOpenChange={(open) => !open && setScoringMatch(null)}
          match={scoringMatch}
          playerId={player?.id}
          onScoreSubmitted={() => setScoringMatch(null)}
        />
      )}
    </div>
  );
};

export default EnhancedMyLeaguesTab;
