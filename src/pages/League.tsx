import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, Users, Calendar, Target, ArrowLeft, Medal, 
  TrendingUp, Clock, MapPin, Star, Crown, Award,
  Activity, BarChart3, Calendar as CalendarIcon, AlertCircle,
  MessageCircle, Zap
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useLeagueRegistrations } from '@/hooks/useLeagueRegistrations';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { useDivisionLeaderboard } from '@/hooks/useDivisionLeaderboard';
import { useDivisionMatches } from '@/hooks/useDivisionMatches';
import { DivisionAnalytics } from '@/components/league/DivisionAnalytics';

const League = () => {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { registrations, loading: registrationsLoading } = useLeagueRegistrations();
  const { assignments, loading: assignmentsLoading } = useDivisionAssignments();
  const [activeTab, setActiveTab] = useState('leaderboard');

  // Check if user is registered for this league
  const userRegistration = registrations.find(reg => 
    reg.league_id === leagueId && reg.status === 'active'
  );

  // Get user's division assignment for this league
  const userDivisionAssignment = assignments.find(assignment => 
    assignment.division?.league_id === leagueId && assignment.status === 'active'
  );

  // Fetch division-specific data
  const { 
    leaderboard, 
    loading: leaderboardLoading, 
    currentUser 
  } = useDivisionLeaderboard(userDivisionAssignment?.division?.id);

  const { 
    matches,
    userMatches,
    upcomingMatches,
    recentMatches,
    loading: matchesLoading 
  } = useDivisionMatches(userDivisionAssignment?.division?.id);

  // Loading state
  if (registrationsLoading || assignmentsLoading || leaderboardLoading || matchesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading league details...</p>
        </div>
      </div>
    );
  }

  // Show message if not registered but still allow viewing
  if (!userRegistration) {
    console.log('User not registered for league, but showing anyway for demo purposes');
  }

  // Get league data from registration and division
  const leagueData = {
    id: leagueId,
    name: userRegistration?.league_name || (leagueId ? String(leagueId).replace(/-/g, ' ') : 'League'),
    description: userDivisionAssignment?.division ? 
      `${userDivisionAssignment.division.skill_level_range} • ${userDivisionAssignment.division.competitiveness} • ${userDivisionAssignment.division.age_range}` :
      'Competitive league for tennis players',
    season: userDivisionAssignment?.division?.season || 'Current Season',
    type: 'League Play',
    status: 'ongoing',
    startDate: userRegistration?.registration_date || new Date().toISOString(),
    endDate: '2024-05-31',
    totalRounds: 10,
    currentRound: 7,
    registrationFee: '$150',
    prizePool: '$2,400',
    location: 'Multiple Courts',
    format: 'Round Robin + Playoffs',
    division: userDivisionAssignment?.division
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return null;
  };

  const getFormColor = (result: string) => {
    return result === 'W' ? 'bg-green-500' : 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <div className="pt-20 pb-8">
        <div className="container mx-auto px-4">
          {/* Header Section */}
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div className="bg-gradient-primary rounded-lg p-6 text-primary-foreground">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{leagueData.name}</h1>
                  <p className="text-primary-foreground/80 mb-4">{leagueData.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{leagueData.season}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{leagueData.type}</span>
                    </div>
                    {leagueData.division && (
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4" />
                        <span>{leagueData.division.division_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{leagueData.location}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 md:mt-0 text-center">
                  <div className="text-2xl font-bold">#{currentUser?.rank || '—'}</div>
                  <div className="text-sm text-primary-foreground/80">Your Position</div>
                  {userDivisionAssignment && (
                    <div className="text-xs text-primary-foreground/60 mt-1">
                      {userDivisionAssignment.matches_completed}/{userDivisionAssignment.matches_required} matches completed
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{currentUser?.points || 0}</p>
                    <p className="text-xs text-muted-foreground">Points</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{currentUser?.wins || 0}</p>
                    <p className="text-xs text-muted-foreground">Wins</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{userDivisionAssignment?.matches_completed || 0}</p>
                    <p className="text-xs text-muted-foreground">Played</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.round((currentUser?.wins || 0) / Math.max(currentUser?.total_matches || 1, 1) * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* League Progress */}
          {userDivisionAssignment && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Match Progress
                </CardTitle>
                <CardDescription>
                  Complete {userDivisionAssignment.matches_required} matches to qualify for playoffs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Matches Completed: {userDivisionAssignment.matches_completed} of {userDivisionAssignment.matches_required}</span>
                    <span>{Math.round((userDivisionAssignment.matches_completed / userDivisionAssignment.matches_required) * 100)}% Complete</span>
                  </div>
                  <Progress 
                    value={(userDivisionAssignment.matches_completed / userDivisionAssignment.matches_required) * 100} 
                    className="h-3" 
                  />
                  {userDivisionAssignment.playoff_eligible && (
                    <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                      <Trophy className="w-4 h-4" />
                      Playoff Eligible!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 h-auto p-1">
              <TabsTrigger value="leaderboard" className="text-xs sm:text-sm py-2">Leaderboard</TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs sm:text-sm py-2">Schedule</TabsTrigger>
              <TabsTrigger value="matches" className="text-xs sm:text-sm py-2">My Matches</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm py-2">Analytics</TabsTrigger>
              <TabsTrigger value="chat" className="text-xs sm:text-sm py-2">Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="leaderboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    League Leaderboard
                  </CardTitle>
                  <CardDescription>
                    Current standings in {leagueData.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {leaderboard.length > 0 ? leaderboard.map((player) => (
                      <div 
                        key={player.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          player.isCurrentUser ? 'bg-primary/5 border-primary' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2 min-w-[60px]">
                            {getRankIcon(player.rank)}
                            <span className="text-xl font-bold">#{player.rank}</span>
                          </div>
                          
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={player.avatar_url} />
                            <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{player.name}</h3>
                              {player.isCurrentUser && (
                                <Badge variant="outline">You</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {player.wins}W-{player.losses}L ({player.total_matches} played)
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <div className="text-lg font-bold text-primary">{player.points}</div>
                            <div className="text-xs text-muted-foreground">Points</div>
                          </div>
                          
                          <div className="flex space-x-1">
                            {player.recentForm.map((result, index) => (
                              <div
                                key={index}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium ${getFormColor(result)}`}
                              >
                                {result}
                              </div>
                            ))}
                          </div>
                          
                          {player.winStreak > 0 && (
                            <Badge className="bg-green-100 text-green-800">
                              🔥 {player.winStreak}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No players in your division yet</p>
                        <p className="text-sm">More players will be added as they register</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    Upcoming Matches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingMatches.map((match) => (
                      <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">vs {match.player1_id === user?.id ? match.player2_name : match.player1_name}</h3>
                            <Badge variant="outline">Scheduled</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(match.match_date).toLocaleDateString()} at {new Date(match.match_date).toLocaleTimeString()}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center space-x-1">
                            <MapPin className="w-3 h-3" />
                            <span>{match.court_location || 'TBD'}</span>
                          </div>
                        </div>
                        <Button size="sm">View Details</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="matches" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recent Matches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentMatches.map((match) => (
                      <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium ${match.winner_id === user?.id ? 'bg-green-500' : 'bg-red-500'}`}>
                              {match.winner_id === user?.id ? 'W' : 'L'}
                            </div>
                            <h3 className="font-semibold">vs {match.player1_id === user?.id ? match.player2_name : match.player1_name}</h3>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(match.match_date).toLocaleDateString()} • {match.status}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Duration: {match.duration_minutes || 0} min • {match.court_location || 'TBD'}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Win Rate</span>
                      <span className="font-semibold">{Math.round((currentUser?.wins || 0) / (currentUser?.total_matches || 1) * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sets Won</span>
                      <span className="font-semibold">{currentUser?.sets_won}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sets Lost</span>
                      <span className="font-semibold">{currentUser?.sets_lost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Points Per Match</span>
                      <span className="font-semibold">{((currentUser?.points || 0) / (currentUser?.total_matches || 1)).toFixed(1)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>League Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Prize Pool</span>
                      <span className="font-semibold text-green-600">{leagueData.prizePool}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Format</span>
                      <span className="font-semibold">{leagueData.format}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Players</span>
                      <span className="font-semibold">{leaderboard.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>End Date</span>
                      <span className="font-semibold">{new Date(leagueData.endDate).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default League;