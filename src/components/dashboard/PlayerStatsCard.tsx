import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  Target,
  TrendingUp,
  Clock,
  Award,
  Zap,
  RotateCcw,
  Shield,
  Trophy,
} from 'lucide-react';
import { PlayerPerformanceStats } from '@/hooks/usePlayerPerformance';

interface PlayerStatsCardProps {
  stats: PlayerPerformanceStats | null;
  registrations: any[];
}

const PlayerStatsCard: React.FC<PlayerStatsCardProps> = ({ stats, registrations }) => {
  const [animatedWinRate, setAnimatedWinRate] = useState(0);
  const [animatedStreak, setAnimatedStreak] = useState(0);

  const totalLeagues = registrations.length;
  const completedLeagues = registrations.filter(reg => reg.status === 'completed').length;
  const currentLeagues = registrations.filter(reg => reg.status === 'active').length;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWinRate(stats?.winRate ?? 0);
      setAnimatedStreak(stats?.currentStreak ?? 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [stats?.winRate, stats?.currentStreak]);

  const statCards = [
    {
      title: 'Total Leagues',
      value: totalLeagues,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: `${currentLeagues} active • ${completedLeagues} completed`,
    },
    {
      title: 'Match Win Rate',
      value: `${animatedWinRate}%`,
      icon: Target,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      description: stats ? `${stats.wins}W – ${stats.losses}L` : '—',
    },
    {
      title: 'Current Streak',
      value: animatedStreak,
      icon: Zap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: stats ? `Best: ${stats.bestStreak} wins` : '—',
    },
    {
      title: 'Hours Played',
      value: stats?.hoursPlayed ?? 0,
      icon: Clock,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      description: 'Estimated court time',
    },
    {
      title: 'Sets Win Rate',
      value: stats ? `${stats.setWinRate}%` : '—',
      icon: TrendingUp,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      description: stats ? `${stats.setsWon}W – ${stats.setsLost}L` : '—',
    },
    {
      title: 'Games Win Rate',
      value: stats ? `${stats.gameWinRate}%` : '—',
      icon: Award,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: stats ? `${stats.gamesWon}W – ${stats.gamesLost}L` : '—',
    },
    {
      title: 'Straight Set Wins',
      value: stats?.straightSetsWins ?? 0,
      icon: Shield,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      description: 'Won without dropping a set',
    },
    {
      title: 'Comeback Wins',
      value: stats?.comebackWins ?? 0,
      icon: RotateCcw,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
      description: 'Won after losing first set',
    },
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
            {stats && (
              <Badge variant="secondary" className="text-xs">
                {stats.totalMatches} matches
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Match Win Rate</span>
                <span className="font-medium">{stats?.winRate ?? 0}%</span>
              </div>
              <Progress value={animatedWinRate} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sets Win Rate</span>
                <span className="font-medium">{stats?.setWinRate ?? 0}%</span>
              </div>
              <Progress value={stats?.setWinRate ?? 0} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Games Win Rate</span>
                <span className="font-medium">{stats?.gameWinRate ?? 0}%</span>
              </div>
              <Progress value={stats?.gameWinRate ?? 0} className="h-2" />
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
                    <p
                      className="text-2xl font-bold text-foreground animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
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
