import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Trophy, Target, Calendar, Award, Zap, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";
import { useAchievements } from "@/hooks/useAchievements";
import { useNavigate } from "react-router-dom";
import PerformanceChart from "./PerformanceChart";
import PlayerStatsCard from "./PlayerStatsCard";
interface PerformanceTabProps {
  player: any;
  matches: any[];
}
const PerformanceTab = ({
  player,
  matches
}: PerformanceTabProps) => {
  const navigate = useNavigate();
  const {
    registrations,
    loading: loadingRegistrations
  } = useLeagueRegistrations();
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  // Set default league when registrations load
  React.useEffect(() => {
    if (registrations.length > 0 && !selectedLeagueId) {
      setSelectedLeagueId(registrations[0].league_id);
    }
  }, [registrations, selectedLeagueId]);

  // Filter matches by selected league
  const leagueMatches = useMemo(() => {
    if (!selectedLeagueId) return [];
    return matches.filter(match => (match.player1_id === player?.id || match.player2_id === player?.id) && match.league_id === selectedLeagueId);
  }, [matches, player?.id, selectedLeagueId]);

  // Calculate performance stats
  const userMatches = leagueMatches;
  const completedMatches = userMatches.filter(match => match.status === 'completed');
  const wonMatches = completedMatches.filter(match => match.winner_id === player?.id);
  const winRate = completedMatches.length > 0 ? Math.round(wonMatches.length / completedMatches.length * 100) : 0;

  // Recent matches (last 10)
  const recentMatches = completedMatches.sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime()).slice(0, 10);
  const performanceMetrics = [{
    title: "Total Matches",
    value: completedMatches.length,
    description: "Matches played",
    icon: Target,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  }, {
    title: "Win Rate",
    value: `${winRate}%`,
    description: `${wonMatches.length}W - ${completedMatches.length - wonMatches.length}L`,
    icon: Trophy,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50"
  }, {
    title: "Current Win Streak",
    value: player?.current_streak || 0,
    description: "Consecutive wins",
    icon: Zap,
    color: "text-orange-600",
    bgColor: "bg-orange-50"
  }, {
    title: "Record Win Streak",
    value: player?.best_streak || 0,
    description: "Longest win streak",
    icon: Award,
    color: "text-purple-600",
    bgColor: "bg-purple-50"
  }];
  const { achievements, unlockedCount, totalCount, completionPercentage } = useAchievements(matches, player);
  // Show prompt if no league registrations
  if (loadingRegistrations) {
    return <div className="text-center py-12">Loading...</div>;
  }
  if (registrations.length === 0) {
    return <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center justify-center space-x-2">
            <TrendingUp className="w-8 h-8 text-primary" />
            <span>My Performance Dashboard</span>
          </h1>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>You are not signed up for any leagues yet. Join a league to track your performance.</span>
            <Button onClick={() => navigate('/dashboard?tab=register')} size="sm">
              Sign Up for League
            </Button>
          </AlertDescription>
        </Alert>
      </div>;
  }
  return <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center space-x-2">
          <TrendingUp className="w-8 h-8 text-primary" />
          <span>My Performance Dashboard</span>
        </h1>
        <p className="text-muted-foreground">
          Track your tennis journey with detailed performance analytics
        </p>
      </div>

      {/* League Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select League</CardTitle>
          <CardDescription>View your performance for a specific league</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select a league" />
            </SelectTrigger>
            <SelectContent>
              {registrations.map(reg => <SelectItem key={reg.id} value={reg.league_id}>
                  {reg.league_name}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Current Performance Section */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2 border-b pb-3">
          <Zap className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Current League Performance</h2>
        </div>

        {/* Performance Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {performanceMetrics.map((metric, index) => {
          const Icon = metric.icon;
          return <Card key={index} className="relative overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {metric.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                      <Icon className={`w-4 h-4 ${metric.color}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">{metric.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                </CardContent>
              </Card>;
        })}
        </div>
      </div>

      {/* Performance Charts */}
      <PerformanceChart registrations={registrations} player={player} matches={matches} />

      {/* Player Stats Cards */}
      <PlayerStatsCard player={player} registrations={registrations} />

      {/* Achievements Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Achievements
            </span>
            <Badge variant="outline">{unlockedCount} / {totalCount}</Badge>
          </CardTitle>
          <CardDescription>Your tennis milestones and accomplishments</CardDescription>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {achievements.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div 
                  key={achievement.id} 
                  className={`flex items-start gap-3 p-4 rounded-lg border bg-card transition-opacity ${!achievement.unlocked && 'opacity-50'}`}
                >
                  <div className={`p-2 rounded-lg bg-muted ${achievement.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm">{achievement.title}</h4>
                      {achievement.unlocked ? (
                        <Badge variant="secondary" className="text-xs">{achievement.date}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Locked</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                    {!achievement.unlocked && achievement.progress !== undefined && achievement.target && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span>{achievement.progress} / {achievement.target}</span>
                        </div>
                        <Progress value={(achievement.progress / achievement.target) * 100} className="h-1.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Historic Performance Section */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2 border-b pb-3">
          <Calendar className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Historic Performance</h2>
        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Career Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{completedMatches.length}</div>
              <p className="text-xs text-muted-foreground mt-1">All time matches played</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Career Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{winRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Overall success rate</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Career Record Win Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{player?.best_streak || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Longest winning streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Match History */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Match History</span>
            </CardTitle>
            <CardDescription>
              Your most recent matches, from newest to oldest
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentMatches.length > 0 ? <div className="space-y-4">
                {recentMatches.map((match, index) => {
              const isWinner = match.winner_id === player?.id;
              const opponentId = match.player1_id === player?.id ? match.player2_id : match.player1_id;
              return <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-muted-foreground">
                          #{recentMatches.length - index}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              vs Opponent
                            </span>
                            <Badge variant={isWinner ? "default" : "secondary"} className={isWinner ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                              {isWinner ? "Won" : "Lost"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(match.match_date).toLocaleDateString()} • {match.court_location || "Court TBD"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">
                          {match.player1_score || 0} - {match.player2_score || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {match.duration_minutes ? `${match.duration_minutes} min` : "Duration N/A"}
                        </div>
                      </div>
                    </div>;
            })}
              </div> : <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No match history yet</p>
                <p className="text-sm mt-2">Complete some matches to see your performance stats</p>
              </div>}
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default PerformanceTab;