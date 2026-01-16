import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Trophy, 
  Medal, 
  Users, 
  Target, 
  TrendingUp, 
  Clock, 
  Award,
  Zap
} from 'lucide-react';

interface PlayerStatsCardProps {
  player: any;
  registrations: any[];
}

const PlayerStatsCard: React.FC<PlayerStatsCardProps> = ({ player, registrations }) => {
  const [animatedValues, setAnimatedValues] = useState({
    winRate: 0,
    streak: 0,
    points: 0
  });

  // Calculate comprehensive stats
  const totalLeagues = registrations.length;
  const completedLeagues = registrations.filter(reg => reg.status === 'completed').length;
  const currentLeagues = registrations.filter(reg => reg.status === 'active').length;
  
  // Mock data for demonstration - in real app, calculate from matches
  const stats = {
    championships: 2,
    topThreeFinishes: 5,
    totalMatches: player?.total_matches || 45,
    wins: player?.wins || 32,
    losses: player?.losses || 13,
    winRate: player?.total_matches ? Math.round((player.wins / player.total_matches) * 100) : 71,
    currentStreak: player?.current_streak || 7,
    bestStreak: player?.best_streak || 12,
    leaguePoints: 1247,
    hoursPlayed: Math.round(player?.hours_played || 87),
    averagePosition: 3.2
  };

  // Animate numbers on load
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValues({
        winRate: stats.winRate,
        streak: stats.currentStreak,
        points: stats.leaguePoints
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [stats.winRate, stats.currentStreak, stats.leaguePoints]);

  const statCards = [
    {
      title: 'Championships',
      value: stats.championships,
      icon: Trophy,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'League titles won'
    },
    {
      title: 'Top 3 Finishes',
      value: stats.topThreeFinishes,
      icon: Medal,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Podium placements'
    },
    {
      title: 'Total Leagues',
      value: totalLeagues,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: `${currentLeagues} active • ${completedLeagues} completed`
    },
    {
      title: 'Win Rate',
      value: `${animatedValues.winRate}%`,
      icon: Target,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      description: `${stats.wins}W - ${stats.losses}L`
    },
    {
      title: 'Current Streak',
      value: animatedValues.streak,
      icon: Zap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: `Best: ${stats.bestStreak} wins`
    },
    {
      title: 'League Points',
      value: animatedValues.points.toLocaleString(),
      icon: Award,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: 'Ranked #12 overall'
    },
    {
      title: 'Hours Played',
      value: stats.hoursPlayed,
      icon: Clock,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      description: 'Court time logged'
    },
    {
      title: 'Avg. Position',
      value: stats.averagePosition.toFixed(1),
      icon: TrendingUp,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      description: 'League finishes'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Performance Overview
            </span>
            <Badge variant="secondary" className="text-xs">
              Season 2024
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Win Rate Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Win Rate</span>
                <span className="font-medium">{stats.winRate}%</span>
              </div>
              <Progress value={animatedValues.winRate} className="h-2" />
            </div>

            {/* League Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">League Progress</span>
                <span className="font-medium">{((completedLeagues / totalLeagues) * 100).toFixed(0)}%</span>
              </div>
              <Progress value={(completedLeagues / totalLeagues) * 100} className="h-2" />
            </div>

            {/* Streak Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Streak Progress</span>
                <span className="font-medium">{Math.round((stats.currentStreak / stats.bestStreak) * 100)}%</span>
              </div>
              <Progress value={(stats.currentStreak / stats.bestStreak) * 100} className="h-2" />
            </div>

            {/* Points to Next Rank */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">To Next Rank</span>
                <span className="font-medium">153 pts</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground animate-fade-in" 
                       style={{ animationDelay: `${index * 100}ms` }}>
                      {stat.value}
                    </p>
                    <p className="text-sm font-medium text-foreground">{stat.title}</p>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PlayerStatsCard;