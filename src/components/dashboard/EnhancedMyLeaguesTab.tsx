import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Trophy, 
  Calendar, 
  ArrowLeft,
  MapPin,
  User,
  Clock,
  Users,
  BarChart3,
  History,
  TrendingUp,
  Target,
  Award,
  Flame,
  ChevronRight,
  CalendarDays,
  Medal
} from 'lucide-react';
import { useDivisionMatches } from '@/hooks/useDivisionMatches';
import { useDivisionLeaderboard } from '@/hooks/useDivisionLeaderboard';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { supabase } from '@/integrations/supabase/client';
import MatchScoringModal from './MatchScoringModal';
import LeagueProgressTable from './LeagueProgressTable';
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
}

const EnhancedMyLeaguesTab: React.FC<EnhancedMyLeaguesTabProps> = ({ 
  player, 
  registrations,
  onNavigateToSchedule 
}) => {
  const [viewState, setViewState] = useState<LeagueViewState>({ view: 'overview' });
  const [divisionInfo, setDivisionInfo] = useState<DivisionInfo | null>(null);
  const [scoringMatch, setScoringMatch] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Helper functions defined early to avoid hoisting issues
  const getLeagueStatus = (league: any) => {
    const now = new Date();
    const createdAt = new Date(league.created_at);
    const monthsAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsAgo < 1) return 'In Progress';
    if (monthsAgo < 3) return 'In Progress';
    return 'Completed';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress': return 'bg-green-500';
      case 'Upcoming': return 'bg-blue-500';
      case 'Completed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Use real registrations only
  const allRegistrations = registrations;
  
  // Filter registrations based on status
  const activeRegistrations = allRegistrations.filter(league => {
    const status = getLeagueStatus(league);
    return status === 'In Progress';
  });
  
  const completedRegistrations = allRegistrations.filter(league => {
    const status = getLeagueStatus(league);
    return status === 'Completed';
  });
  
  const displayRegistrations = showHistory ? completedRegistrations : activeRegistrations;
  
  const { assignments } = useDivisionAssignments();
  const divisionId = viewState.selectedLeague ? 
    assignments.find(a => a.league_registration_id === viewState.selectedLeague?.id)?.division_id : 
    undefined;
  
  const { matches, loading: matchesLoading } = useDivisionMatches(divisionId);
  const { leaderboard, loading: leaderboardLoading } = useDivisionLeaderboard(divisionId);

  // Fetch division info when league is selected
  useEffect(() => {
    const fetchDivisionInfo = async () => {
      if (!divisionId) return;
      
      const { data, error } = await supabase
        .from('divisions')
        .select('id, tournament_status, division_name')
        .eq('id', divisionId)
        .single();
      
      if (!error && data) {
        setDivisionInfo(data);
      }
    };
    
    fetchDivisionInfo();
  }, [divisionId]);

  const handleLeagueClick = (league: any) => {
    setViewState({ view: 'details', selectedLeague: league });
  };

  const handleBackClick = () => {
    setViewState({ view: 'overview' });
  };

  const renderLeagueOverview = () => (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Trophy className="w-7 h-7 text-primary" />
            </div>
            {showHistory ? 'League History' : 'My Leagues'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {showHistory 
              ? 'Review your past league performances and achievements'
              : 'Manage your active leagues and track your progress'
            }
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2"
        >
          {showHistory ? (
            <>
              <Trophy className="w-4 h-4" />
              Active Leagues
            </>
          ) : (
            <>
              <History className="w-4 h-4" />
              View History
            </>
          )}
        </Button>
      </div>

      {showHistory ? (
        <LeagueProgressTable 
          registrations={completedRegistrations}
          onLeagueClick={handleLeagueClick}
        />
      ) : (
        <div className="space-y-6">
          {/* Active Leagues Cards */}
          {displayRegistrations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="text-center py-16">
                <div className="max-w-md mx-auto">
                  <div className="p-4 bg-primary/5 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Active Leagues</h3>
                  <p className="text-muted-foreground mb-6">
                    Join a league to compete with players at your skill level and track your progress
                  </p>
                  <Button size="lg" className="bg-primary hover:bg-primary/90">
                    <Trophy className="w-4 h-4 mr-2" />
                    Browse Available Leagues
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {displayRegistrations.map((league) => {
                const status = getLeagueStatus(league);
                return (
                  <Card 
                    key={league.id} 
                    className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-primary group"
                    onClick={() => handleLeagueClick(league)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-bold group-hover:text-primary transition-colors">
                              {league.league_name}
                            </h3>
                            <Badge 
                              variant="secondary" 
                              className={`text-white ${getStatusColor(status)}`}
                            >
                              {status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4" />
                              <span>Season {new Date(league.created_at).getFullYear()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <span>Division Play</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLeagueClick(league);
                            }}
                            size="lg"
                            className="bg-primary hover:bg-primary/90 text-white"
                          >
                            View League
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats and match history sections removed - will be populated with real data from the league details view */}
    </div>
  );

  const navigate = useNavigate();

  const handleScheduleMatch = (opponentId: string, opponentName: string) => {
    // Navigate to opponent's public availability page with league context
    const divId = divisionInfo?.id || divisionId;
    const divName = divisionInfo?.division_name || 'League';
    
    toast.info(`Opening ${opponentName}'s availability calendar...`);
    navigate(`/public-availability/${opponentId}?source=league&divisionId=${divId}&divisionName=${encodeURIComponent(divName)}`);
  };

  const handleReportScore = (match: any) => {
    setScoringMatch(match);
  };

  const renderMatches = () => {
    if (matchesLoading) {
      return <div className="text-center py-8">Loading matches...</div>;
    }

    const isTournamentActive = divisionInfo?.tournament_status === 'active';

    // Use real matches only
    const userMatches = matches.filter(match => match.isUserMatch);

    if (userMatches.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No matches yet</h3>
            <p className="text-muted-foreground">
              Your matches will appear here once they're scheduled
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Active Tournament Indicator */}
        {isTournamentActive && (
          <Card className="border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <span className="font-semibold text-green-700 dark:text-green-300 block">
                      🏆 Active Tournament
                    </span>
                    <span className="text-sm text-green-600 dark:text-green-400">
                      {divisionInfo?.division_name}
                    </span>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white">In Progress</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {userMatches.map((match, index) => {
          const isScheduled = match.status === 'scheduled';
          const isCompleted = match.status === 'completed';
          const needsScoreReport = isCompleted && !match.winner_id;
          const homeAway = match.home_player_id === match.player1_id 
            ? (match.userIsPlayer1 ? 'Home' : 'Away')
            : (match.userIsPlayer1 ? 'Away' : 'Home');

          return (
            <Card 
              key={match.id} 
              className={`hover:shadow-md transition-shadow ${
                isTournamentActive && isScheduled ? 'border-l-4 border-l-green-500' : 
                match.result === 'win' ? 'border-l-4 border-l-green-500' : 
                match.result === 'loss' ? 'border-l-4 border-l-red-500' : ''
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        match.result === 'win' ? 'bg-green-100 dark:bg-green-900' :
                        match.result === 'loss' ? 'bg-red-100 dark:bg-red-900' :
                        'bg-blue-100 dark:bg-blue-900'
                      }`}>
                        {match.result === 'win' ? <Trophy className="w-5 h-5 text-green-600" /> :
                         match.result === 'loss' ? <User className="w-5 h-5 text-red-600" /> :
                         <Clock className="w-5 h-5 text-blue-600" />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">vs {match.opponent_name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant={match.result === 'win' ? 'default' : match.result === 'loss' ? 'destructive' : 'secondary'}
                            className={match.result === 'win' ? 'bg-green-600' : ''}
                          >
                            {match.result === 'win' ? 'Victory' : match.result === 'loss' ? 'Defeat' : 'Upcoming'}
                          </Badge>
                          {homeAway && (
                            <Badge variant="outline" className="text-xs">
                              {homeAway}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(match.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(match.match_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{match.court_location || 'Location TBD'}</span>
                      </div>
                    </div>
                    {match.set1_player1 !== null && match.set1_player2 !== null && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm font-semibold mb-1">Final Score</div>
                        <div className="text-lg font-bold">
                          {match.set1_player1}-{match.set1_player2}, {match.set2_player1}-{match.set2_player2}
                          {match.set3_player1 !== null && `, ${match.set3_player1}-${match.set3_player2}`}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    {needsScoreReport && isTournamentActive && (
                      <Button
                        size="sm"
                        onClick={() => handleReportScore(match)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Trophy className="w-4 h-4 mr-1" />
                        Report Score
                      </Button>
                    )}
                    {isScheduled && (
                      <Button
                        size="sm"
                        onClick={() => handleScheduleMatch(
                          match.userIsPlayer1 ? match.player2_id : match.player1_id,
                          match.opponent_name
                        )}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Calendar className="w-4 h-4 mr-1" />
                        Schedule Match
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderDivisionStandings = () => {
    if (leaderboardLoading) {
      return <div className="text-center py-8">Loading standings...</div>;
    }

    // Use real leaderboard data only
    const displayLeaderboard = leaderboard;

    if (displayLeaderboard.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No standings available</h3>
            <p className="text-muted-foreground">
              Division standings will appear here once matches are played
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Division Standings
          </CardTitle>
          <CardDescription>
            {divisionInfo?.division_name || 'Your division'} rankings and playoff status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayLeaderboard.map((player, index) => {
              const winRate = player.total_matches > 0 ? ((player.wins / player.total_matches) * 100).toFixed(0) : '0';
              const isTopThree = index < 3;
              
              return (
                <div 
                  key={player.user_id} 
                  className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                    player.isCurrentUser 
                      ? 'bg-primary/10 border-2 border-primary shadow-sm' 
                      : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      player.isCurrentUser 
                        ? 'bg-primary text-primary-foreground' 
                        : isTopThree
                        ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isTopThree && !player.isCurrentUser ? '🏆' : index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`font-semibold text-lg ${player.isCurrentUser ? 'text-primary' : ''}`}>
                          {player.name}
                        </div>
                        {player.isCurrentUser && (
                          <Badge variant="default" className="bg-primary text-xs">You</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-medium">{player.wins}W - {player.losses}L</span>
                        <span>•</span>
                        <span>{winRate}% Win Rate</span>
                        <span>•</span>
                        <span>{player.points} pts</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                      {player.playoff_eligible ? (
                        <Badge className="bg-green-600 text-white">
                          <Award className="w-3 h-3 mr-1" />
                          Playoff Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          {player.matches_required - player.matches_completed} more needed
                        </Badge>
                      )}
                    </div>
                    {!player.isCurrentUser && (
                      <Button
                        size="sm"
                        onClick={() => handleScheduleMatch(player.user_id, player.name)}
                        className="bg-primary hover:bg-primary/90 text-white"
                      >
                        <Calendar className="w-4 h-4 mr-1" />
                        Schedule
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLeagueStandings = () => (
    <Card>
      <CardHeader>
        <CardTitle>Overall League Standings</CardTitle>
        <CardDescription>Cross-division rankings (Coming Soon)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">League-Wide Standings</h3>
          <p className="text-sm">
            Overall league rankings across all divisions will be displayed here once the season progresses.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderPlayoffBracket = () => (
    <Card>
      <CardHeader>
        <CardTitle>Playoff Bracket</CardTitle>
        <CardDescription>Tournament bracket (Available during playoffs)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">Playoff Bracket</h3>
          <p className="text-sm">
            The playoff bracket will be generated automatically once the regular season concludes and playoff matches begin.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderLeagueDetails = () => (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleBackClick}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-12" />
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Trophy className="w-6 h-6 text-primary" />
                  </div>
                  {viewState.selectedLeague?.league_name}
                </h1>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Season {new Date(viewState.selectedLeague?.created_at).getFullYear()}
                  {divisionInfo && (
                    <>
                      <span>•</span>
                      <span>{divisionInfo.division_name}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <Badge 
              variant="secondary" 
              className={`text-white ${getStatusColor(getLeagueStatus(viewState.selectedLeague))}`}
            >
              {getLeagueStatus(viewState.selectedLeague)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="matches" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger value="matches" className="flex items-center gap-2 py-3">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Matches</span>
          </TabsTrigger>
          <TabsTrigger value="division" className="flex items-center gap-2 py-3">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Division</span>
          </TabsTrigger>
          <TabsTrigger value="league" className="flex items-center gap-2 py-3">
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">League</span>
          </TabsTrigger>
          <TabsTrigger value="playoffs" className="flex items-center gap-2 py-3">
            <Award className="w-4 h-4" />
            <span className="hidden sm:inline">Playoffs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches">
          {renderMatches()}
        </TabsContent>

        <TabsContent value="division">
          {renderDivisionStandings()}
        </TabsContent>

        <TabsContent value="league">
          {renderLeagueStandings()}
        </TabsContent>

        <TabsContent value="playoffs">
          {renderPlayoffBracket()}
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className="space-y-6">
      {viewState.view === 'overview' ? renderLeagueOverview() : renderLeagueDetails()}
      
      {scoringMatch && (
        <MatchScoringModal
          open={!!scoringMatch}
          onOpenChange={(open) => !open && setScoringMatch(null)}
          match={scoringMatch}
          playerId={player?.id}
          onScoreSubmitted={() => {
            setScoringMatch(null);
            // Refresh matches
          }}
        />
      )}
    </div>
  );
};

export default EnhancedMyLeaguesTab;