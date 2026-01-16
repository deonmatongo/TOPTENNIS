import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Calendar, 
  ArrowLeft,
  MapPin,
  User,
  Clock,
  Users,
  BarChart3,
  History
} from 'lucide-react';
import { useDivisionMatches } from '@/hooks/useDivisionMatches';
import { useDivisionLeaderboard } from '@/hooks/useDivisionLeaderboard';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { supabase } from '@/integrations/supabase/client';
import MatchScoringModal from './MatchScoringModal';
import LeagueProgressTable from './LeagueProgressTable';

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
  
  // Add dummy data for demonstration
  const dummyRegistrations = [
    {
      id: '1',
      league_id: 'spring-2024',
      league_name: 'Spring Tournament 2024',
      created_at: '2024-11-01T00:00:00Z',
      status: 'active'
    },
    {
      id: '2', 
      league_id: 'winter-2024',
      league_name: 'Winter Championship 2024',
      created_at: '2024-10-15T00:00:00Z',
      status: 'active'
    },
    {
      id: '3',
      league_id: 'fall-2023',
      league_name: 'Fall Classic 2023', 
      created_at: '2023-09-01T00:00:00Z',
      status: 'active'
    },
    {
      id: '4',
      league_id: 'summer-2023',
      league_name: 'Summer Open 2023', 
      created_at: '2023-06-15T00:00:00Z',
      status: 'active'
    },
    {
      id: '5',
      league_id: 'spring-2023',
      league_name: 'Spring Masters 2023', 
      created_at: '2023-03-10T00:00:00Z',
      status: 'active'
    },
    {
      id: '6',
      league_id: 'winter-2022',
      league_name: 'Winter Cup 2022', 
      created_at: '2022-12-01T00:00:00Z',
      status: 'active'
    },
    {
      id: '7',
      league_id: 'fall-2022',
      league_name: 'Fall Championship 2022', 
      created_at: '2022-09-20T00:00:00Z',
      status: 'active'
    }
  ];
  
  // Use dummy data if no real registrations exist
  const allRegistrations = registrations.length > 0 ? registrations : dummyRegistrations;
  
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-8 h-8 text-primary" />
            {showHistory ? 'League History' : 'My Leagues'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {showHistory 
              ? 'View your completed league history and performance'
              : 'View your active league registrations and performance'
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
        <div className="grid gap-4">
          {displayRegistrations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">No active leagues</h3>
                <p className="text-muted-foreground mb-6">
                  Join a league to start playing competitive tennis
                </p>
                <Button size="lg">
                  Join a League
                </Button>
              </CardContent>
            </Card>
          ) : (
            displayRegistrations.map((league) => {
            const status = getLeagueStatus(league);
            return (
              <Card key={league.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{league.league_name}</h3>
                        <Badge 
                          variant="secondary" 
                          className={`text-white ${getStatusColor(status)}`}
                        >
                          {status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Season {new Date(league.created_at).getFullYear()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          <span>League ID: {league.league_id}</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleLeagueClick(league)}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Schedule a Match
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        </div>
      )}

      {displayRegistrations.length > 0 && !showHistory && (
        <>
          {/* Quick Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Last Match Result */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Last Match
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <Badge variant="default" className="bg-green-500 mb-2">Win</Badge>
                    <div className="font-medium">vs Mike Johnson</div>
                    <div className="text-sm text-muted-foreground">6-4, 7-5</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Dec 18, 2024
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next Match */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Next Match
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <div className="font-medium">vs Sarah Chen</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Dec 22, 2024 at 7:00 PM
                    </div>
                    <div className="text-xs text-muted-foreground">
                      📍 Court 3, Tennis Center
                    </div>
                  </div>
                  <Button size="sm" className="w-full">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Season Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Record</span>
                    <span className="font-medium">12W - 4L</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Win Rate</span>
                    <span className="font-medium">75%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Streak</span>
                    <span className="font-medium text-green-600">3W</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Rank</span>
                    <span className="font-medium">#3 of 24</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Matches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Recent Matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary Stats */}
              <div className="mb-6 pb-4 border-b">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-lg">4</div>
                    <div className="text-muted-foreground">Wins</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-lg">1</div>
                    <div className="text-muted-foreground">Losses</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-lg">80%</div>
                    <div className="text-muted-foreground">Win Rate</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Match 1 */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-green-500">Win</Badge>
                    <div>
                      <div className="font-medium">vs Mike Johnson</div>
                      <div className="text-sm text-muted-foreground">Dec 18, 2024</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">6-4, 7-5</div>
                    <div className="text-xs text-muted-foreground">2h 15m</div>
                  </div>
                </div>

                {/* Match 2 */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-green-500">Win</Badge>
                    <div>
                      <div className="font-medium">vs Alex Rodriguez</div>
                      <div className="text-sm text-muted-foreground">Dec 15, 2024</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">6-3, 6-4</div>
                    <div className="text-xs text-muted-foreground">1h 50m</div>
                  </div>
                </div>

                {/* Match 3 */}
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">Loss</Badge>
                    <div>
                      <div className="font-medium">vs Lisa Wang</div>
                      <div className="text-sm text-muted-foreground">Dec 10, 2024</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">3-6, 5-7</div>
                    <div className="text-xs text-muted-foreground">2h 5m</div>
                  </div>
                </div>

                {/* Match 4 */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-green-500">Win</Badge>
                    <div>
                      <div className="font-medium">vs Tom Chen</div>
                      <div className="text-sm text-muted-foreground">Dec 8, 2024</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">7-6, 6-4</div>
                    <div className="text-xs text-muted-foreground">2h 30m</div>
                  </div>
                </div>

                {/* Match 5 */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-green-500">Win</Badge>
                    <div>
                      <div className="font-medium">vs Sarah Chen</div>
                      <div className="text-sm text-muted-foreground">Dec 5, 2024</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">6-2, 6-3</div>
                    <div className="text-xs text-muted-foreground">1h 45m</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  const handleScheduleMatch = (opponentId: string, opponentName: string) => {
    if (onNavigateToSchedule) {
      onNavigateToSchedule(opponentId, opponentName);
    }
  };

  const handleReportScore = (match: any) => {
    setScoringMatch(match);
  };

  const renderMatches = () => {
    if (matchesLoading) {
      return <div className="text-center py-8">Loading matches...</div>;
    }

    const isTournamentActive = divisionInfo?.tournament_status === 'active';

    // Add dummy matches data
    const dummyMatches = [
      {
        id: '1',
        match_date: '2024-12-15T19:00:00Z',
        player1_name: 'You',
        player2_name: 'Mike Johnson',
        opponent_name: 'Mike Johnson',
        player1_score: 6,
        player2_score: 4,
        status: 'completed',
        court_location: 'Court 3, Tennis Center',
        isUserMatch: true,
        userIsPlayer1: true,
        result: 'win' as const
      },
      {
        id: '2',
        match_date: '2024-12-18T18:30:00Z',
        player1_name: 'Sarah Chen',
        player2_name: 'You',
        opponent_name: 'Sarah Chen',
        player1_score: 4,
        player2_score: 6,
        status: 'completed',
        court_location: 'Court 1, Tennis Center',
        isUserMatch: true,
        userIsPlayer1: false,
        result: 'win' as const
      },
      {
        id: '3',
        match_date: '2024-12-22T19:00:00Z',
        player1_name: 'You',
        player2_name: 'Alex Rodriguez',
        opponent_name: 'Alex Rodriguez',
        player1_score: null,
        player2_score: null,
        status: 'scheduled',
        court_location: 'Court 2, Tennis Center',
        isUserMatch: true,
        userIsPlayer1: true,
        result: 'pending' as const
      },
      {
        id: '4',
        match_date: '2024-12-10T17:00:00Z',
        player1_name: 'Lisa Wang',
        player2_name: 'You',
        opponent_name: 'Lisa Wang',
        player1_score: 6,
        player2_score: 3,
        status: 'completed',
        court_location: 'Court 4, Tennis Center',
        isUserMatch: true,
        userIsPlayer1: false,
        result: 'loss' as const
      }
    ];

    const userMatches = matches.length > 0 ? matches.filter(match => match.isUserMatch) : dummyMatches;

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
          <Card className="border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="font-semibold text-green-700 dark:text-green-300">
                  Active Tournament - {divisionInfo?.division_name}
                </span>
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
            <Card key={match.id} className={isTournamentActive && isScheduled ? 'border-green-400' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">Match {index + 1}</h4>
                      <Badge variant={match.result === 'win' ? 'default' : match.result === 'loss' ? 'destructive' : 'secondary'}>
                        {match.result === 'win' ? 'Win' : match.result === 'loss' ? 'Loss' : 'Scheduled'}
                      </Badge>
                      {homeAway && (
                        <Badge variant="outline" className="text-xs">
                          {homeAway} Game
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>vs {match.opponent_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{match.court_location || 'TBD'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(match.match_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {match.set1_player1 !== null && match.set1_player2 !== null && (
                      <div className="mt-2 text-sm font-medium">
                        Score: {match.set1_player1}-{match.set1_player2}, {match.set2_player1}-{match.set2_player2}
                        {match.set3_player1 !== null && `, ${match.set3_player1}-${match.set3_player2}`}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {needsScoreReport && isTournamentActive && (
                      <Button
                        size="sm"
                        onClick={() => handleReportScore(match)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Report Score
                      </Button>
                    )}
                    {isScheduled && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleScheduleMatch(
                          match.userIsPlayer1 ? match.player2_id : match.player1_id,
                          match.opponent_name
                        )}
                      >
                        Reschedule
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

    // Add dummy division standings data
    const dummyLeaderboard = [
      {
        id: '1',
        user_id: 'current-user',
        name: 'You',
        email: 'you@example.com',
        wins: 12,
        losses: 4,
        total_matches: 16,
        skill_level: 7,
        points: 36,
        sets_won: 26,
        sets_lost: 14,
        matches_completed: 16,
        matches_required: 5,
        playoff_eligible: true,
        isCurrentUser: true,
        rank: 3
      },
      {
        id: '2',
        user_id: '2',
        name: 'Sarah Chen',
        email: 'sarah@example.com',
        wins: 15,
        losses: 2,
        total_matches: 17,
        skill_level: 8,
        points: 45,
        sets_won: 32,
        sets_lost: 8,
        matches_completed: 17,
        matches_required: 5,
        playoff_eligible: true,
        isCurrentUser: false,
        rank: 1
      },
      {
        id: '3',
        user_id: '3',
        name: 'Mike Johnson',
        email: 'mike@example.com',
        wins: 14,
        losses: 3,
        total_matches: 17,
        skill_level: 7,
        points: 42,
        sets_won: 30,
        sets_lost: 12,
        matches_completed: 17,
        matches_required: 5,
        playoff_eligible: true,
        isCurrentUser: false,
        rank: 2
      },
      {
        id: '4',
        user_id: '4',
        name: 'Alex Rodriguez',
        email: 'alex@example.com',
        wins: 10,
        losses: 6,
        total_matches: 16,
        skill_level: 6,
        points: 30,
        sets_won: 22,
        sets_lost: 18,
        matches_completed: 16,
        matches_required: 5,
        playoff_eligible: true,
        isCurrentUser: false,
        rank: 4
      },
      {
        id: '5',
        user_id: '5',
        name: 'Lisa Wang',
        email: 'lisa@example.com',
        wins: 8,
        losses: 8,
        total_matches: 16,
        skill_level: 6,
        points: 24,
        sets_won: 20,
        sets_lost: 20,
        matches_completed: 16,
        matches_required: 5,
        playoff_eligible: false,
        isCurrentUser: false,
        rank: 5
      }
    ];

    const displayLeaderboard = leaderboard.length > 0 ? leaderboard : dummyLeaderboard;

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
          <CardTitle>Division Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayLeaderboard.map((player, index) => (
              <div key={player.user_id} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {player.wins}W - {player.losses}L
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{player.points} pts</div>
                  <div className="text-sm text-muted-foreground">
                    {player.playoff_eligible ? 'Playoff Eligible' : 'Not Eligible'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderLeagueStandings = () => (
    <Card>
      <CardHeader>
        <CardTitle>Overall League Standings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[
            { rank: 1, name: 'Jennifer Martinez', division: 'Division A', points: 48, record: '16-1' },
            { rank: 2, name: 'David Thompson', division: 'Division B', points: 45, record: '15-2' },
            { rank: 3, name: 'You', division: 'Division C', points: 36, record: '12-4', isCurrentUser: true },
            { rank: 4, name: 'Rachel Kim', division: 'Division A', points: 42, record: '14-3' },
            { rank: 5, name: 'Michael Brown', division: 'Division C', points: 39, record: '13-4' },
            { rank: 6, name: 'Emily Davis', division: 'Division B', points: 36, record: '12-5' },
            { rank: 7, name: 'James Wilson', division: 'Division A', points: 33, record: '11-6' },
            { rank: 8, name: 'Amanda Lee', division: 'Division C', points: 30, record: '10-7' }
          ].map((player, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between p-3 rounded ${
                player.isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  player.isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
                }`}>
                  {player.rank}
                </div>
                <div>
                  <div className={`font-medium ${player.isCurrentUser ? 'text-primary' : ''}`}>
                    {player.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {player.division} • {player.record}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{player.points} pts</div>
                <div className="text-sm text-muted-foreground">
                  {player.rank <= 8 ? 'Playoff Bound' : 'Eliminated'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderPlayoffBracket = () => (
    <Card>
      <CardHeader>
        <CardTitle>Playoff Bracket</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Semifinals */}
          <div>
            <h4 className="font-medium mb-3 text-center">Semifinals</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                    <span className="font-medium">Sarah Chen</span>
                    <span className="font-bold">6-4, 6-2</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-200">
                    <span>Mike Johnson</span>
                    <span>4-6, 2-6</span>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                    <span className="font-medium">You</span>
                    <span className="font-bold">7-5, 6-3</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-200">
                    <span>Alex Rodriguez</span>
                    <span>5-7, 3-6</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Finals */}
          <div>
            <h4 className="font-medium mb-3 text-center">Championship Final</h4>
            <div className="max-w-md mx-auto">
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <div className="space-y-2">
                  <div className="text-center text-sm text-muted-foreground mb-2">
                    December 30, 2024 • 2:00 PM
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
                    <span className="font-medium">Sarah Chen</span>
                    <span className="text-sm">#1 Seed</span>
                  </div>
                  <div className="text-center text-xs text-muted-foreground">vs</div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded border border-blue-200">
                    <span className="font-medium">You</span>
                    <span className="text-sm">#3 Seed</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Championship Result */}
          <div>
            <h4 className="font-medium mb-3 text-center">Championship Result</h4>
            <div className="max-w-md mx-auto">
              <Card className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300">
                <div className="text-center space-y-2">
                  <Trophy className="w-8 h-8 mx-auto text-yellow-600" />
                  <div className="font-bold text-lg">🏆 Champion</div>
                  <div className="font-medium">You</div>
                  <div className="text-sm text-muted-foreground">
                    defeated Sarah Chen 6-3, 7-6(5)
                  </div>
                  <Badge variant="default" className="bg-yellow-500">
                    Season Champion 2024
                  </Badge>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderLeagueDetails = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleBackClick}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Leagues
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" />
            {viewState.selectedLeague?.league_name}
          </h1>
          <p className="text-muted-foreground">
            Season {new Date(viewState.selectedLeague?.created_at).getFullYear()}
          </p>
        </div>
      </div>

      <Tabs defaultValue="matches" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="division">Division Standings</TabsTrigger>
          <TabsTrigger value="league">League Standings</TabsTrigger>
          <TabsTrigger value="playoffs">Playoff Bracket</TabsTrigger>
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