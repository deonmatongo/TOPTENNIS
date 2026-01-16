import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Trophy, TrendingUp, Target, Star, Calendar, MapPin, Flame, Crown, Zap, Award, Activity, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";

interface OverviewTabProps {
  player: any;
  matches: any[];
  leaderboard: any[];
  selectedLeague: string;
  setSelectedLeague: (league: string) => void;
}

const OverviewTab = ({ player, matches, leaderboard, selectedLeague, setSelectedLeague }: OverviewTabProps) => {
  const { registrations, loading: registrationsLoading } = useLeagueRegistrations();

  // Set the first league as selected by default when registrations load
  useEffect(() => {
    if (registrations.length > 0 && !selectedLeague) {
      setSelectedLeague(registrations[0].league_id);
    }
  }, [registrations, selectedLeague, setSelectedLeague]);

  // Filter matches for the selected league (for now, we'll show all matches as league-specific filtering would need additional data structure)
  const userMatches = matches.filter(match => 
    match.player1_id === player?.id || match.player2_id === player?.id
  );
  
  const completedMatches = userMatches.filter(match => match.status === 'completed');
  const wonMatches = completedMatches.filter(match => match.winner_id === player?.id);
  const winRate = completedMatches.length > 0 ? Math.round((wonMatches.length / completedMatches.length) * 100) : 0;
  const playerRank = leaderboard.findIndex(p => p.id === player?.id) + 1;

  // Calculate current streak
  const recentMatches = completedMatches
    .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
    .slice(0, 10);
  
  let currentStreak = 0;
  for (const match of recentMatches) {
    if (match.winner_id === player?.id) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Real achievements based on actual data
  const achievements = [
    { 
      title: `${currentStreak}-Match Win Streak`, 
      icon: Flame, 
      achieved: currentStreak >= 3 
    },
    { 
      title: "Top 10 Player", 
      icon: Crown, 
      achieved: playerRank <= 10 && playerRank > 0 
    },
    { 
      title: "Match Winner", 
      icon: Trophy, 
      achieved: wonMatches.length > 0 
    },
    { 
      title: "Active Player", 
      icon: Zap, 
      achieved: userMatches.length >= 5 
    },
  ];

  const nextMatch = userMatches
    .filter(match => match.status === 'scheduled')
    .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())[0];

  // Generate performance trends from real data
  const generatePerformanceTrends = () => {
    const monthlyData: { [key: string]: { wins: number; total: number } } = {};
    
    completedMatches.forEach(match => {
      const date = new Date(match.match_date);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { wins: 0, total: 0 };
      }
      
      monthlyData[monthYear].total++;
      if (match.winner_id === player?.id) {
        monthlyData[monthYear].wins++;
      }
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month: month,
        winRate: data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0,
        matchesPlayed: data.total
      }))
      .slice(-6); // Last 6 months
  };

  // Analyze court location performance
  const analyzeLocationPerformance = () => {
    const locationData: { [key: string]: { matches: number; wins: number } } = {};
    
    completedMatches.forEach(match => {
      const location = match.court_location || 'Unknown Location';
      
      if (!locationData[location]) {
        locationData[location] = { matches: 0, wins: 0 };
      }
      
      locationData[location].matches++;
      if (match.winner_id === player?.id) {
        locationData[location].wins++;
      }
    });

    return Object.entries(locationData).map(([location, data]) => ({
      location,
      matches: data.matches,
      wins: data.wins,
      winRate: data.matches > 0 ? Math.round((data.wins / data.matches) * 100) : 0
    }));
  };

  // Calculate opponent analysis
  const analyzeOpponents = () => {
    const opponentData: { [key: string]: { matches: number; wins: number; opponent: any } } = {};
    
    completedMatches.forEach(match => {
      const isPlayer1 = match.player1_id === player?.id;
      const opponent = isPlayer1 ? match.player2 : match.player1;
      const opponentId = opponent?.id;
      
      if (opponentId && !opponentData[opponentId]) {
        opponentData[opponentId] = { matches: 0, wins: 0, opponent };
      }
      
      if (opponentId) {
        opponentData[opponentId].matches++;
        if (match.winner_id === player?.id) {
          opponentData[opponentId].wins++;
        }
      }
    });

    return Object.values(opponentData).filter(data => data.matches > 0);
  };

  const performanceTrends = generatePerformanceTrends();
  const locationPerformance = analyzeLocationPerformance();
  const opponentAnalysis = analyzeOpponents();

  // Calculate match readiness based on real factors
  const calculateMatchReadiness = () => {
    const recentWins = recentMatches.slice(0, 5).filter(m => m.winner_id === player?.id).length;
    const daysSinceLastMatch = completedMatches.length > 0 
      ? Math.floor((Date.now() - new Date(completedMatches[0].match_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    let score = 50; // Base score
    score += recentWins * 10; // Recent performance
    score += Math.min(daysSinceLastMatch * 2, 30); // Rest days (max 30 points)
    
    return Math.min(100, Math.max(0, score));
  };

  const readinessScore = calculateMatchReadiness();

  const selectedLeagueInfo = registrations.find(reg => reg.league_id === selectedLeague);

  if (registrationsLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your league information...</p>
        </div>
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-center">
            <Trophy className="w-12 h-12 text-amber-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-amber-800 mb-2">Congratulations you have successfully registered.</h3>
            <p className="text-amber-700 mb-4">
              The next step is sign up for a league.
            </p>
            <p className="text-sm text-amber-600">
              On your dashboard click "Sign up for a League"
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5 p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-r from-primary via-primary/90 to-accent shadow-2xl">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
        <div className="relative p-4 md:p-6 lg:p-8 text-white">
          <div className="flex items-center justify-between">
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="w-3 h-3 md:w-4 md:h-4 bg-white/30 rounded-full animate-pulse"></div>
                <Badge className="bg-white/20 text-white border-white/30 px-2 py-1 md:px-3 backdrop-blur-sm text-xs md:text-sm">
                  Live Dashboard
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight">
                Welcome back, {player?.name?.split(' ')[0] || 'Player'}
              </h1>
              <p className="text-white/80 text-sm md:text-base lg:text-lg">
                Ready to dominate the court today?
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 bg-white/20 rounded-2xl md:rounded-3xl backdrop-blur-sm flex items-center justify-center">
                <Trophy className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* League Selection Card */}
      <Card className="bg-white/80 backdrop-blur-lg border-0 shadow-xl rounded-2xl overflow-hidden">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 md:gap-6">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-primary to-accent rounded-lg md:rounded-xl flex items-center justify-center">
                  <Trophy className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground">Active League</h2>
              </div>
              
              {registrations.length === 1 ? (
                <div className="space-y-3 md:space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
                      {selectedLeagueInfo?.league_name}
                    </h3>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm w-fit">
                      ✓ Registered
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 md:space-y-6">
                  <p className="text-muted-foreground text-sm md:text-base lg:text-lg">Select your active league:</p>
                  <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                    <SelectTrigger className="w-full max-w-md bg-white border-2 border-border/20 h-12 md:h-14 rounded-xl text-sm md:text-base lg:text-lg">
                      <SelectValue placeholder="Choose league" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-0 shadow-2xl">
                      {registrations.map((registration) => (
                        <SelectItem key={registration.id} value={registration.league_id} className="rounded-lg text-sm md:text-base lg:text-lg p-3 md:p-4">
                          {registration.league_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLeagueInfo && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm w-fit">
                      ✓ Active Registration
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {/* Win Rate */}
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 md:p-6 lg:p-8 relative">
            <div className="absolute top-3 right-3 md:top-4 md:right-4 w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Trophy className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
            </div>
            <div className="space-y-1 md:space-y-2">
              <p className="text-emerald-100 font-medium text-sm md:text-base">Win Rate</p>
              <p className="text-3xl md:text-4xl lg:text-5xl font-black">{winRate}%</p>
              <p className="text-emerald-200 text-xs md:text-sm">
                {wonMatches.length} wins out of {completedMatches.length}
              </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 rounded-full">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${winRate}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Current Rank */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 md:p-6 lg:p-8 relative">
            <div className="absolute top-3 right-3 md:top-4 md:right-4 w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <TrendingUp className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
            </div>
            <div className="space-y-1 md:space-y-2">
              <p className="text-blue-100 font-medium text-sm md:text-base">League Rank</p>
              <p className="text-3xl md:text-4xl lg:text-5xl font-black">#{playerRank || 'N/A'}</p>
              <p className="text-blue-200 text-xs md:text-sm">
                of {leaderboard.length} players
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Match Readiness */}
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 md:p-6 lg:p-8 relative">
            <div className="absolute top-3 right-3 md:top-4 md:right-4 w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Target className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
            </div>
            <div className="space-y-1 md:space-y-2">
              <p className="text-purple-100 font-medium text-sm md:text-base">Readiness</p>
              <p className="text-3xl md:text-4xl lg:text-5xl font-black">{readinessScore}%</p>
              <p className="text-purple-200 text-xs md:text-sm">
                {readinessScore >= 80 ? 'Excellent' : readinessScore >= 60 ? 'Good' : 'Fair'}
              </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 rounded-full">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${readinessScore}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Skill Rating */}
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-xl rounded-2xl overflow-hidden group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-4 md:p-6 lg:p-8 relative">
            <div className="absolute top-3 right-3 md:top-4 md:right-4 w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Star className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
            </div>
            <div className="space-y-1 md:space-y-2">
              <p className="text-orange-100 font-medium text-sm md:text-base">
                {player?.usta_rating ? 'Level Rating' : 'Skill Level'}
              </p>
              <p className="text-3xl md:text-4xl lg:text-5xl font-black">
                {player?.usta_rating || `${player?.skill_level || 5}.0`}
              </p>
              <p className="text-orange-200 text-xs md:text-sm">
                Skill Rating
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
        {/* Achievements Section */}
        <Card className="xl:col-span-2 bg-white/80 backdrop-blur-lg border-0 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 lg:p-8 pb-4 md:pb-6">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3 md:space-x-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-primary to-accent rounded-lg md:rounded-xl flex items-center justify-center">
                  <Award className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground">Achievements</h3>
                  <p className="text-sm md:text-base text-muted-foreground">Your tennis milestones</p>
                </div>
              </div>
              {selectedLeagueInfo && (
                <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm w-fit">
                  {selectedLeagueInfo.league_name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {achievements.map((achievement, index) => (
                <div 
                  key={index} 
                  className={`relative p-4 md:p-6 rounded-xl md:rounded-2xl border-2 transition-all duration-300 group hover:shadow-lg ${
                    achievement.achieved 
                      ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 shadow-emerald-100/50' 
                      : 'bg-muted/30 border-muted/40 opacity-70'
                  }`}
                >
                  {achievement.achieved && (
                    <div className="absolute top-3 right-3 md:top-4 md:right-4 w-5 h-5 md:w-6 md:h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                  <div className="flex items-start space-x-3 md:space-x-4">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-lg md:rounded-xl flex items-center justify-center transition-all duration-300 ${
                      achievement.achieved 
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30' 
                        : 'bg-muted'
                    }`}>
                      <achievement.icon className={`w-6 h-6 md:w-7 md:h-7 ${
                        achievement.achieved ? 'text-white' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="flex-1 space-y-1 md:space-y-2">
                      <h4 className={`font-bold text-sm md:text-base lg:text-lg ${
                        achievement.achieved ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {achievement.title}
                      </h4>
                      <Badge 
                        className={`text-xs font-medium ${
                          achievement.achieved 
                            ? "bg-emerald-500 text-white shadow-sm" 
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {achievement.achieved ? "✓ Achieved" : "🔒 Locked"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Next Match */}
        <Card className="bg-white/80 backdrop-blur-lg border-0 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 lg:p-8 pb-4 md:pb-6">
            <CardTitle className="flex items-center space-x-3 md:space-x-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-primary to-accent rounded-lg md:rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground">Next Match</h3>
                <p className="text-sm md:text-base text-muted-foreground">Upcoming competition</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
            {nextMatch ? (
              <div className="space-y-4 md:space-y-6">
                <div className="p-4 md:p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl md:rounded-2xl border border-primary/20">
                  <div className="flex items-center space-x-2 md:space-x-3 mb-3 md:mb-4">
                    <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    <span className="text-xs md:text-sm font-semibold text-primary">
                      {nextMatch.court_location}
                    </span>
                  </div>
                  <h4 className="text-lg md:text-xl font-bold text-foreground mb-2 md:mb-3">
                    vs {nextMatch.player1_id === player?.id ? nextMatch.player2?.name : nextMatch.player1?.name}
                  </h4>
                  <div className="space-y-1 md:space-y-2 text-xs md:text-sm text-muted-foreground">
                    <p>{new Date(nextMatch.match_date).toLocaleDateString()}</p>
                    <p>{new Date(nextMatch.match_date).toLocaleTimeString()}</p>
                  </div>
                </div>
                
                <div className="space-y-3 md:space-y-4">
                  <h5 className="font-semibold text-sm md:text-base text-foreground">Match Details</h5>
                  <div className="p-3 md:p-4 bg-muted/30 rounded-lg md:rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs md:text-sm text-muted-foreground">Opponent Rating</span>
                      <span className="text-base md:text-lg font-bold text-foreground">
                        {nextMatch.player1_id === player?.id ? nextMatch.player2?.skill_level : nextMatch.player1?.skill_level}/10
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 md:py-12">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-muted/30 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6">
                  <Calendar className="w-8 h-8 md:w-10 md:h-10 text-muted-foreground" />
                </div>
                <h4 className="text-base md:text-lg font-semibold text-foreground mb-2">No upcoming matches</h4>
                <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">
                  Ready to schedule your next game?
                </p>
                <Button className="bg-gradient-to-r from-primary to-accent text-white rounded-lg md:rounded-xl px-4 py-2 md:px-6 md:py-3 text-sm md:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                  Schedule Match
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Analytics with Charts */}
      {completedMatches.length > 0 ? (
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-11 touch-target">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Performance</TabsTrigger>
            <TabsTrigger value="locations" className="text-xs sm:text-sm">Locations</TabsTrigger>
            <TabsTrigger value="opponents" className="text-xs sm:text-sm">Head-to-Head</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            {performanceTrends.length > 0 && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <span className="text-base sm:text-lg">Win Rate Over Time</span>
                    </div>
                    {selectedLeagueInfo && (
                      <Badge variant="outline" className="text-xs self-start sm:self-center">
                        {selectedLeagueInfo.league_name}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
                    <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] bg-[length:16px_16px]"></div>
                    <div className="relative">
                      <div className="h-80 sm:h-96">
                        <ChartContainer
                          config={{
                            winRate: {
                              label: "Win Rate %",
                              color: "hsl(var(--primary))",
                            },
                            matchesPlayed: {
                              label: "Matches Played",
                              color: "hsl(var(--chart-2))",
                            },
                          }}
                          className="h-full w-full"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                              data={performanceTrends} 
                              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                            >
                              <defs>
                                <linearGradient id="winRateGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                </linearGradient>
                                <filter id="glow">
                                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                  <feMerge> 
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                  </feMerge>
                                </filter>
                              </defs>
                              <XAxis 
                                dataKey="month" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                className="text-xs"
                              />
                              <YAxis 
                                domain={[0, 100]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                className="text-xs"
                                label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }}
                              />
                              <ChartTooltip 
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="rounded-lg bg-white/95 backdrop-blur-sm border border-border/50 p-3 shadow-lg animate-fade-in">
                                        <p className="font-semibold text-sm text-foreground mb-2">{label}</p>
                                        <div className="space-y-1">
                                          <p className="text-sm flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-primary"></div>
                                            Win Rate: <span className="font-bold text-primary">{payload[0]?.value}%</span>
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Matches: {payload[0]?.payload?.matchesPlayed || 0}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line 
                                type="natural" 
                                dataKey="winRate" 
                                stroke="hsl(var(--primary))"
                                strokeWidth={4}
                                fill="url(#winRateGradient)"
                                dot={{ 
                                  fill: 'hsl(var(--primary))', 
                                  strokeWidth: 3, 
                                  r: 8,
                                  stroke: 'white',
                                  filter: 'url(#glow)'
                                }}
                                activeDot={{ 
                                  r: 12, 
                                  stroke: 'hsl(var(--primary))',
                                  strokeWidth: 3,
                                  fill: 'white',
                                  className: 'animate-pulse'
                                }}
                                className="animate-fade-in"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </div>
                      
                      {/* Performance insights */}
                      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Trend</span>
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            {performanceTrends.length > 1 
                              ? performanceTrends[performanceTrends.length - 1].winRate > performanceTrends[0].winRate 
                                ? '↗' : '↘'
                              : '→'
                            } 
                            {performanceTrends.length > 1 
                              ? Math.abs(performanceTrends[performanceTrends.length - 1].winRate - performanceTrends[0].winRate)
                              : 0
                            }%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {performanceTrends.length > 1 
                              ? performanceTrends[performanceTrends.length - 1].winRate > performanceTrends[0].winRate 
                                ? 'Improving' : 'Declining'
                              : 'Stable'
                            }
                          </div>
                        </div>
                        
                        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Best Month</span>
                            <Target className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            {performanceTrends.length > 0 
                              ? Math.max(...performanceTrends.map(p => p.winRate))
                              : 0
                            }%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {performanceTrends.find(p => p.winRate === Math.max(...performanceTrends.map(pt => pt.winRate)))?.month || 'N/A'}
                          </div>
                        </div>
                        
                        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Total Games</span>
                            <Activity className="w-4 h-4 text-purple-500" />
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            {performanceTrends.reduce((sum, p) => sum + p.matchesPlayed, 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last 6 months
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-base sm:text-lg">Performance Summary</span>
                  {selectedLeagueInfo && (
                    <Badge variant="outline" className="text-xs self-start sm:self-center">
                      {selectedLeagueInfo.league_name}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
                  <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                    <div className="text-xl sm:text-3xl font-bold text-green-600">{winRate}%</div>
                    <div className="text-xs sm:text-sm text-green-800">League Win Rate</div>
                    <div className="text-xs text-green-600 hidden sm:block">{wonMatches.length} wins of {completedMatches.length} matches</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                    <div className="text-xl sm:text-3xl font-bold text-blue-600">{completedMatches.length}</div>
                    <div className="text-xs sm:text-sm text-blue-800">League Matches</div>
                    <div className="text-xs text-blue-600 hidden sm:block">Total completed</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
                    <div className="text-xl sm:text-3xl font-bold text-purple-600">#{playerRank || 'N/A'}</div>
                    <div className="text-xs sm:text-sm text-purple-800">League Rank</div>
                    <div className="text-xs text-purple-600 hidden sm:block">of {leaderboard.length} players</div>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg">
                    <div className="text-xl sm:text-3xl font-bold text-orange-600">{currentStreak}</div>
                    <div className="text-xs sm:text-sm text-orange-800">Win Streak</div>
                    <div className="text-xs text-orange-600 hidden sm:block">Current streak</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <span className="text-base sm:text-lg">Performance by Location</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {locationPerformance.length > 0 ? (
                  <div className="space-y-4">
                    {locationPerformance.map((location, index) => (
                      <div key={index} className="p-4 rounded-lg border bg-gradient-to-r from-background to-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-foreground">{location.location}</h4>
                          <Badge variant={location.winRate >= 60 ? "default" : "secondary"}>
                            {location.winRate}% Win Rate
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{location.matches} matches played</span>
                          <span>{location.wins} wins, {location.matches - location.wins} losses</span>
                        </div>
                        <div className="mt-3 w-full bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              location.winRate >= 70 ? 'bg-green-500' : 
                              location.winRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${location.winRate}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No location data available yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opponents" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  <span className="text-base sm:text-lg">Head-to-Head Records</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {opponentAnalysis.length > 0 ? (
                  <div className="space-y-4">
                    {opponentAnalysis.slice(0, 10).map((opponent, index) => {
                      const winRate = Math.round((opponent.wins / opponent.matches) * 100);
                      return (
                        <div key={index} className="p-4 rounded-lg border bg-gradient-to-r from-background to-muted/20">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {opponent.opponent?.name?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <h4 className="font-semibold text-foreground">{opponent.opponent?.name || 'Unknown Player'}</h4>
                                <p className="text-xs text-muted-foreground">Level {opponent.opponent?.skill_level || 'N/A'}</p>
                              </div>
                            </div>
                            <Badge variant={winRate >= 60 ? "default" : winRate >= 40 ? "secondary" : "destructive"}>
                              {winRate}% Win Rate
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                            <span>{opponent.matches} matches played</span>
                            <span>{opponent.wins}W - {opponent.matches - opponent.wins}L</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-500 ${
                                winRate >= 70 ? 'bg-green-500' : 
                                winRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${winRate}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No opponent data available yet.</p>
                    <p className="text-sm text-muted-foreground mt-2">Play some matches to see your head-to-head records!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="bg-white/80 backdrop-blur-lg border-0 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 lg:p-8 pb-4 md:pb-6">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3 md:space-x-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-primary to-accent rounded-lg md:rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground">Performance Analytics</h3>
                  <p className="text-sm md:text-base text-muted-foreground">Your tennis journey insights</p>
                </div>
              </div>
              {selectedLeagueInfo && (
                <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 md:px-4 md:py-2 rounded-full text-xs md:text-sm w-fit">
                  {selectedLeagueInfo.league_name}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
            <div className="text-center py-8 md:py-12">
              <BarChart3 className="w-16 h-16 md:w-20 md:h-20 text-muted-foreground/30 mx-auto mb-4 md:mb-6" />
              <h4 className="text-base md:text-lg font-semibold text-foreground mb-2">No Match Data Available</h4>
              <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">
                Complete some matches in {selectedLeagueInfo?.league_name || 'your selected league'} to see your performance analytics here.
              </p>
              <Button className="bg-gradient-to-r from-primary to-accent text-white rounded-lg md:rounded-xl px-4 py-2 md:px-6 md:py-3 text-sm md:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                Schedule Your First Match
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OverviewTab;