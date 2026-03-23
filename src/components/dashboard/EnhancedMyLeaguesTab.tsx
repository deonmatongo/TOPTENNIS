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
  AlertCircle,
  Zap,
} from 'lucide-react';
import { useDivisionMatches } from '@/hooks/useDivisionMatches';
import { useDivisionLeaderboard } from '@/hooks/useDivisionLeaderboard';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { supabase } from '@/integrations/supabase/client';
import MatchScoringModal from './MatchScoringModal';
import { toast } from 'sonner';

interface EnhancedMyLeaguesTabProps {
  player: any;
  registrations: any[];
  onNavigateToSchedule?: (opponentId?: string, opponentName?: string) => void;
}

interface LeagueViewState {
  view: 'overview' | 'details';
  selectedLeague?: any;
}

interface DivisionInfo {
  id: string;
  tournament_status: string;
  division_name: string;
  skill_level_range?: string;
  competitiveness?: string;
  season?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const getLeagueStatus = (league: any): 'In Progress' | 'Completed' => {
  const now = new Date();
  const monthsAgo =
    (now.getTime() - new Date(league.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return monthsAgo < 3 ? 'In Progress' : 'Completed';
};

const winRate = (wins: number, total: number) =>
  total > 0 ? Math.round((wins / total) * 100) : 0;

const FormDot = ({ result }: { result: 'W' | 'L' }) => (
  <span
    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white ${
      result === 'W' ? 'bg-green-500' : 'bg-red-500'
    }`}
  >
    {result}
  </span>
);

const RankMedal = ({ rank }: { rank: number }) => {
  if (rank === 1)
    return (
      <span className="text-xl" title="1st">
        🥇
      </span>
    );
  if (rank === 2)
    return (
      <span className="text-xl" title="2nd">
        🥈
      </span>
    );
  if (rank === 3)
    return (
      <span className="text-xl" title="3rd">
        🥉
      </span>
    );
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-sm font-bold text-muted-foreground">
      {rank}
    </span>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const EnhancedMyLeaguesTab: React.FC<EnhancedMyLeaguesTabProps> = ({
  player,
  registrations,
  onNavigateToSchedule,
}) => {
  const [viewState, setViewState] = useState<LeagueViewState>({ view: 'overview' });
  const [divisionInfo, setDivisionInfo] = useState<DivisionInfo | null>(null);
  const [scoringMatch, setScoringMatch] = useState<any>(null);
  const navigate = useNavigate();

  const activeRegistrations = registrations.filter(
    (l) => getLeagueStatus(l) === 'In Progress',
  );
  const completedRegistrations = registrations.filter(
    (l) => getLeagueStatus(l) === 'Completed',
  );

  const { assignments } = useDivisionAssignments();

  const divisionId = viewState.selectedLeague
    ? assignments.find((a) => a.league_registration_id === viewState.selectedLeague?.id)
        ?.division_id
    : undefined;

  const currentAssignment = viewState.selectedLeague
    ? assignments.find((a) => a.league_registration_id === viewState.selectedLeague?.id)
    : undefined;

  const { matches, loading: matchesLoading } = useDivisionMatches(divisionId);
  const { leaderboard, loading: leaderboardLoading, currentUser: currentUserStats } =
    useDivisionLeaderboard(divisionId);

  useEffect(() => {
    if (!divisionId) return;
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
      toast.info(`Opening ${opponentName}'s availability...`);
      navigate(
        `/public-availability/${opponentId}?source=league&divisionId=${divId}&divisionName=${encodeURIComponent(divName)}`,
      );
    }
  };

  // ── Overview ───────────────────────────────────────────────────────────────

  const renderOverview = () => {
    // Aggregate stats across all registrations (use player-level data)
    const totalWins = player?.wins ?? 0;
    const totalLosses = player?.losses ?? 0;
    const totalMatches = totalWins + totalLosses;
    const wr = winRate(totalWins, totalMatches);
    const streak = player?.current_streak ?? 0;

    return (
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            My Leagues
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track your divisions, standings, and match progress
          </p>
        </div>

        {/* Aggregate stat strip */}
        {totalMatches > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Overall Record',
                value: `${totalWins}W – ${totalLosses}L`,
                icon: <Swords className="w-4 h-4 text-primary" />,
                sub: `${wr}% win rate`,
              },
              {
                label: 'Active Leagues',
                value: activeRegistrations.length,
                icon: <Flame className="w-4 h-4 text-orange-500" />,
                sub: `${completedRegistrations.length} completed`,
              },
              {
                label: 'Current Streak',
                value: streak > 0 ? `${streak}W` : '—',
                icon: <Zap className="w-4 h-4 text-yellow-500" />,
                sub: 'win streak',
              },
              {
                label: 'Skill Level',
                value: player?.usta_rating ?? player?.skill_level ?? '—',
                icon: <Star className="w-4 h-4 text-primary" />,
                sub: player?.usta_rating ? 'USTA rating' : 'skill level',
              },
            ].map((s) => (
              <Card key={s.label} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {s.icon}
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Active leagues */}
        {activeRegistrations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Active
            </h2>
            <div className="grid gap-3">
              {activeRegistrations.map((league) => {
                const asgn = assignments.find((a) => a.league_registration_id === league.id);
                const completed = asgn?.matches_completed ?? 0;
                const required = asgn?.matches_required ?? 5;
                const playoffEligible = asgn?.playoff_eligible ?? false;
                const progressPct = Math.min(100, Math.round((completed / required) * 100));

                return (
                  <Card
                    key={league.id}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 border-l-primary group"
                    onClick={() => setViewState({ view: 'details', selectedLeague: league })}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-base group-hover:text-primary transition-colors truncate">
                              {league.league_name}
                            </h3>
                            {playoffEligible ? (
                              <Badge className="bg-green-600 text-white text-xs shrink-0">
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                Playoff Ready
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                In Progress
                              </Badge>
                            )}
                          </div>
                          {asgn?.division && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {asgn.division.division_name}
                              {asgn.division.skill_level_range &&
                                ` · Level ${asgn.division.skill_level_range}`}
                            </p>
                          )}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Match progress</span>
                              <span className="font-medium text-foreground">
                                {completed} / {required} played
                              </span>
                            </div>
                            <Progress value={progressPct} className="h-1.5" />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewState({ view: 'details', selectedLeague: league });
                          }}
                        >
                          View
                          <ChevronRight className="w-3 h-3 ml-1" />
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
        {completedRegistrations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Completed
            </h2>
            <div className="grid gap-3">
              {completedRegistrations.map((league) => (
                <Card
                  key={league.id}
                  className="cursor-pointer hover:shadow-md transition-all duration-200 opacity-75 hover:opacity-100 group"
                  onClick={() => setViewState({ view: 'details', selectedLeague: league })}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {league.league_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Season {new Date(league.created_at).getFullYear()}
                        </p>
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

        {/* Empty state */}
        {registrations.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="text-center py-16">
              <div className="p-4 bg-primary/5 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Leagues Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
                Join a league to compete with players at your skill level and track your
                progress.
              </p>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90"
                onClick={() => navigate('/dashboard?tab=register')}
              >
                <Trophy className="w-4 h-4 mr-2" />
                Browse Leagues
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Browse more CTA */}
        {registrations.length > 0 && (
          <Card className="border border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <Trophy className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Looking for more competition?</p>
                    <p className="text-xs text-muted-foreground">Browse open leagues to join</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => navigate('/dashboard?tab=register')}
                >
                  Browse Leagues
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ── Detail: Matches tab ───────────────────────────────────────────────────

  const renderMatches = () => {
    if (matchesLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      );
    }

    const userMatches = matches.filter((m) => m.isUserMatch);
    const upcoming = userMatches.filter((m) => m.status === 'scheduled');
    const recent = userMatches.filter((m) => m.status === 'completed');
    const isTournamentActive = divisionInfo?.tournament_status === 'active';

    if (userMatches.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-10">
            <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">No matches yet</h3>
            <p className="text-sm text-muted-foreground">
              Matches will appear here once they're scheduled in your division.
            </p>
          </CardContent>
        </Card>
      );
    }

    const MatchCard = ({ match }: { match: (typeof userMatches)[0] }) => {
      const isScheduled = match.status === 'scheduled';
      const isCompleted = match.status === 'completed';
      const needsScore = isCompleted && !match.winner_id;
      const borderColor =
        isTournamentActive && isScheduled
          ? 'border-l-blue-500'
          : match.result === 'win'
            ? 'border-l-green-500'
            : match.result === 'loss'
              ? 'border-l-red-500'
              : 'border-l-muted-foreground/30';

      const ResultIcon =
        match.result === 'win'
          ? Trophy
          : match.result === 'loss'
            ? Target
            : Clock;
      const iconBg =
        match.result === 'win'
          ? 'bg-green-100 dark:bg-green-900 text-green-600'
          : match.result === 'loss'
            ? 'bg-red-100 dark:bg-red-900 text-red-600'
            : 'bg-blue-100 dark:bg-blue-900 text-blue-600';

      return (
        <Card className={`border-l-4 ${borderColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                <ResultIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm">vs {match.opponent_name}</span>
                  {match.result === 'win' && (
                    <Badge className="bg-green-600 text-white text-xs">Win</Badge>
                  )}
                  {match.result === 'loss' && (
                    <Badge variant="destructive" className="text-xs">Loss</Badge>
                  )}
                  {match.status === 'scheduled' && (
                    <Badge variant="secondary" className="text-xs">Upcoming</Badge>
                  )}
                  {needsScore && (
                    <Badge className="bg-orange-500 text-white text-xs">Score Pending</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {match.match_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(match.match_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  {match.court_location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {match.court_location}
                    </span>
                  )}
                  {isCompleted &&
                    match.set1_player1 !== null &&
                    match.set1_player2 !== null && (
                      <span className="font-medium text-foreground">
                        {match.set1_player1}–{match.set1_player2}
                        {match.set2_player1 !== null &&
                          `, ${match.set2_player1}–${match.set2_player2}`}
                        {match.set3_player1 !== null &&
                          `, ${match.set3_player1}–${match.set3_player2}`}
                      </span>
                    )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {needsScore && isTournamentActive && (
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white h-7 text-xs"
                    onClick={() => setScoringMatch(match)}
                  >
                    Report Score
                  </Button>
                )}
                {isScheduled && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      handleScheduleMatch(
                        match.userIsPlayer1 ? match.player2_id : match.player1_id,
                        match.opponent_name,
                      )
                    }
                  >
                    <Calendar className="w-3 h-3 mr-1" />
                    Schedule
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
        {isTournamentActive && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Tournament active — {divisionInfo?.division_name}
            </span>
            <Badge className="ml-auto bg-green-600 text-white text-xs">Live</Badge>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming ({upcoming.length})
            </h3>
            {upcoming.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Results ({recent.length})
            </h3>
            {recent.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Detail: Standings tab ─────────────────────────────────────────────────

  const renderStandings = () => {
    if (leaderboardLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      );
    }

    if (leaderboard.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-10">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">No standings yet</h3>
            <p className="text-sm text-muted-foreground">
              Division rankings appear once matches are played.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Division context */}
        {divisionInfo && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{divisionInfo.division_name}</Badge>
            {divisionInfo.skill_level_range && (
              <Badge variant="outline">Level {divisionInfo.skill_level_range}</Badge>
            )}
            {divisionInfo.competitiveness && (
              <Badge variant="outline">{divisionInfo.competitiveness}</Badge>
            )}
          </div>
        )}

        {/* Standings list */}
        <div className="space-y-2">
          {leaderboard.map((p, idx) => {
            const wr = winRate(p.wins, p.total_matches);
            const isMe = p.isCurrentUser;
            const form: ('W' | 'L')[] = (p.recentForm || []).slice(0, 5) as ('W' | 'L')[];

            return (
              <div
                key={p.user_id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  isMe
                    ? 'bg-primary/5 border-primary/30 shadow-sm'
                    : 'bg-muted/20 border-transparent hover:bg-muted/40'
                }`}
              >
                {/* Rank */}
                <div className="w-8 shrink-0 flex justify-center">
                  <RankMedal rank={idx + 1} />
                </div>

                {/* Avatar */}
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={p.avatar_url} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                    {p.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name + form */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${isMe ? 'text-primary' : ''}`}>
                      {p.name}
                    </span>
                    {isMe && (
                      <Badge variant="default" className="bg-primary text-xs py-0">
                        You
                      </Badge>
                    )}
                    {p.playoff_eligible && (
                      <Badge className="bg-green-600 text-white text-xs py-0">
                        <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                        Playoff
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {p.wins}W–{p.losses}L · {wr}%
                    </span>
                    {form.length > 0 && (
                      <div className="flex items-center gap-0.5">
                        {form.map((r, i) => (
                          <FormDot key={i} result={r} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Points + action */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold">{p.points}</div>
                    <div className="text-xs text-muted-foreground">pts</div>
                  </div>
                  {!isMe && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs hover:bg-primary hover:text-white hover:border-primary transition-colors"
                      onClick={() => handleScheduleMatch(p.user_id, p.name)}
                    >
                      <Swords className="w-3 h-3 mr-1" />
                      Challenge
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Playoff eligibility legend */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
          <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span>
            Playoff badge requires {currentAssignment?.matches_required ?? 5} matches
            completed. Form dots show last 5 results (newest right).
          </span>
        </div>
      </div>
    );
  };

  // ── Detail: Progress tab ─────────────────────────────────────────────────

  const renderProgress = () => {
    const completed = currentAssignment?.matches_completed ?? 0;
    const required = currentAssignment?.matches_required ?? 5;
    const playoffEligible = currentAssignment?.playoff_eligible ?? false;
    const progressPct = Math.min(100, Math.round((completed / required) * 100));
    const remaining = Math.max(0, required - completed);

    const meStats = currentUserStats;
    const myRank = leaderboard.findIndex((p) => p.isCurrentUser) + 1;
    const totalPlayers = leaderboard.length;

    const milestones = [
      {
        label: 'First match played',
        done: completed >= 1,
        icon: <Calendar className="w-4 h-4" />,
      },
      {
        label: `Halfway there (${Math.ceil(required / 2)} matches)`,
        done: completed >= Math.ceil(required / 2),
        icon: <TrendingUp className="w-4 h-4" />,
      },
      {
        label: `Playoff eligible (${required} matches)`,
        done: playoffEligible,
        icon: <ShieldCheck className="w-4 h-4" />,
      },
      {
        label: 'Top half of division',
        done: myRank > 0 && myRank <= Math.ceil(totalPlayers / 2),
        icon: <Award className="w-4 h-4" />,
      },
      {
        label: 'Top 3 in division',
        done: myRank > 0 && myRank <= 3,
        icon: <Trophy className="w-4 h-4" />,
      },
    ];

    return (
      <div className="space-y-5">
        {/* Match progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Match Completion
            </CardTitle>
            <CardDescription>
              {playoffEligible
                ? 'You\'ve met the minimum match requirement!'
                : `Play ${remaining} more match${remaining !== 1 ? 'es' : ''} to become playoff eligible`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Matches played</span>
                <span className="font-bold">
                  {completed} / {required}
                </span>
              </div>
              <Progress
                value={progressPct}
                className={`h-3 ${playoffEligible ? '[&>div]:bg-green-500' : ''}`}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span
                  className={
                    playoffEligible ? 'text-green-600 font-semibold' : 'font-medium'
                  }
                >
                  {required} (playoff)
                </span>
              </div>
            </div>

            {meStats && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                  <div className="text-xl font-bold text-green-600">{meStats.wins}</div>
                  <div className="text-xs text-muted-foreground">Wins</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                  <div className="text-xl font-bold text-red-500">{meStats.losses}</div>
                  <div className="text-xs text-muted-foreground">Losses</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/5">
                  <div className="text-xl font-bold text-primary">{meStats.points}</div>
                  <div className="text-xs text-muted-foreground">Points</div>
                </div>
              </div>
            )}

            {myRank > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm">
                <span className="text-muted-foreground">Division rank</span>
                <span className="font-bold">
                  #{myRank}{' '}
                  <span className="text-muted-foreground font-normal">of {totalPlayers}</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Season milestones */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Season Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      m.done
                        ? 'bg-green-100 dark:bg-green-900 text-green-600'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {m.done ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <CircleDashed className="w-4 h-4" />
                    )}
                  </div>
                  <div className={`flex items-center gap-2 text-sm ${m.done ? '' : 'text-muted-foreground'}`}>
                    <span className={m.done ? '' : 'text-muted-foreground/70'}>{m.icon}</span>
                    <span className={m.done ? 'font-medium' : ''}>{m.label}</span>
                  </div>
                  {m.done && (
                    <Badge className="ml-auto bg-green-600 text-white text-xs py-0">
                      Done
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick action: schedule next */}
        {!playoffEligible && (
          <Card className="border border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                    <Swords className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Schedule your next match</p>
                    <p className="text-xs text-muted-foreground">
                      Challenge a division opponent to get closer to playoffs
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="shrink-0 bg-primary hover:bg-primary/90"
                  onClick={() =>
                    setViewState((prev) => ({ ...prev })) // stay in details, switch to standings
                  }
                >
                  View Opponents
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ── Detail wrapper ────────────────────────────────────────────────────────

  const renderDetails = () => {
    const league = viewState.selectedLeague;
    if (!league) return null;
    const status = getLeagueStatus(league);

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewState({ view: 'overview' })}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{league.league_name}</h1>
              <Badge
                variant="secondary"
                className={`text-white shrink-0 ${
                  status === 'In Progress' ? 'bg-green-500' : 'bg-gray-500'
                }`}
              >
                {status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <CalendarDays className="w-3.5 h-3.5" />
              Season {new Date(league.created_at).getFullYear()}
              {divisionInfo && (
                <>
                  <span>·</span>
                  <span>{divisionInfo.division_name}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="standings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="matches" className="flex items-center gap-1.5 py-2.5">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Matches</span>
            </TabsTrigger>
            <TabsTrigger value="standings" className="flex items-center gap-1.5 py-2.5">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Standings</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-1.5 py-2.5">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Progress</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matches">{renderMatches()}</TabsContent>
          <TabsContent value="standings">{renderStandings()}</TabsContent>
          <TabsContent value="progress">{renderProgress()}</TabsContent>
        </Tabs>
      </div>
    );
  };

  // ── Root render ───────────────────────────────────────────────────────────

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
