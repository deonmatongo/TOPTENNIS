import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Trophy, Target, Calendar, Award, Zap, AlertCircle, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLeagueRegistrations } from "@/hooks/useLeagueRegistrations";
import { useAchievements } from "@/hooks/useAchievements";
import { usePlayerPerformance } from "@/hooks/usePlayerPerformance";
import { useNavigate } from "react-router-dom";
import PerformanceChart from "./PerformanceChart";
import PlayerStatsCard from "./PlayerStatsCard";

interface PerformanceTabProps {
  player: any;
}

const PerformanceTab = ({ player }: PerformanceTabProps) => {
  const navigate = useNavigate();
  const { registrations, loading: loadingRegistrations } = useLeagueRegistrations();
  const { stats, loading: loadingStats } = usePlayerPerformance(player?.id);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("all");

  const { achievements, unlockedCount, totalCount, completionPercentage } = useAchievements(stats);

  // Filter matches for the selected league (or all)
  const leagueMatches = useMemo(() => {
    if (!stats) return [];
    if (selectedLeagueId === "all") return stats.matches;
    return stats.matches.filter(m => m.leagueId === selectedLeagueId);
  }, [stats, selectedLeagueId]);

  // Per-league stats for the performance metrics section
  const leagueWins = leagueMatches.filter(m => m.isWin).length;
  const leagueTotal = leagueMatches.length;
  const leagueWinRate = leagueTotal > 0 ? Math.round((leagueWins / leagueTotal) * 100) : 0;
  const leagueSetsWon = leagueMatches.reduce((a, m) => a + m.setsWon, 0);
  const leagueSetsLost = leagueMatches.reduce((a, m) => a + m.setsLost, 0);
  const leagueMinutes = leagueMatches.reduce((a, m) => a + (m.durationMinutes ?? 90), 0);

  const performanceMetrics = [
    {
      title: "Matches Played",
      value: leagueTotal,
      description: "Completed matches",
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Win Rate",
      value: `${leagueWinRate}%`,
      description: `${leagueWins}W – ${leagueTotal - leagueWins}L`,
      icon: Trophy,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Sets Record",
      value: `${leagueSetsWon}–${leagueSetsLost}`,
      description: leagueSetsWon + leagueSetsLost > 0
        ? `${Math.round((leagueSetsWon / (leagueSetsWon + leagueSetsLost)) * 100)}% sets won`
        : "No sets recorded",
      icon: Award,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Hours Played",
      value: Math.round(leagueMinutes / 60),
      description: "Estimated court time",
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  const isLoading = loadingRegistrations || loadingStats;

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading performance data…</div>;
  }

  if (registrations.length === 0) {
    return (
      <div className="space-y-8">
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
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
          <CardTitle className="text-lg">Filter by League</CardTitle>
          <CardDescription>View your performance for a specific league or across all leagues</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select a league" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leagues</SelectItem>
              {registrations.map(reg => (
                <SelectItem key={reg.id} value={reg.league_id}>
                  {reg.league_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2 border-b pb-3">
          <Zap className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            {selectedLeagueId === "all" ? "Overall Performance" : "League Performance"}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {performanceMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card key={index} className="relative overflow-hidden hover:shadow-md transition-shadow">
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
              </Card>
            );
          })}
        </div>
      </div>

      {/* Performance Charts — all-time data */}
      <PerformanceChart matches={stats?.matches ?? []} />

      {/* Player Stats Card — all-time data */}
      <PlayerStatsCard stats={stats} registrations={registrations} />

      {/* Achievements */}
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

      {/* Match History */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2 border-b pb-3">
          <Calendar className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Match History</h2>
        </div>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Recent Matches</span>
            </CardTitle>
            <CardDescription>
              Your most recent completed matches, newest first
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leagueMatches.length > 0 ? (
              <div className="space-y-3">
                {leagueMatches.slice(0, 20).map((match, index) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-muted-foreground w-6 text-right">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">vs {match.opponentName}</span>
                          <Badge
                            variant={match.isWin ? "default" : "secondary"}
                            className={match.isWin ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
                          >
                            {match.isWin ? "Won" : "Lost"}
                          </Badge>
                          {match.wonInStraightSets && (
                            <Badge variant="outline" className="text-xs text-cyan-600 border-cyan-300">
                              Straight Sets
                            </Badge>
                          )}
                          {match.wasComeback && (
                            <Badge variant="outline" className="text-xs text-violet-600 border-violet-300">
                              Comeback
                            </Badge>
                          )}
                          {match.hasBagel && match.isWin && (
                            <Badge variant="outline" className="text-xs text-rose-600 border-rose-300">
                              Bagel
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {new Date(match.matchDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {match.courtLocation ? ` • ${match.courtLocation}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-medium">{match.score}</div>
                      <div className="text-xs text-muted-foreground">
                        {match.durationMinutes ? `${match.durationMinutes} min` : '~90 min'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No match history yet</p>
                <p className="text-sm mt-2">Complete some matches to see your performance stats</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PerformanceTab;
