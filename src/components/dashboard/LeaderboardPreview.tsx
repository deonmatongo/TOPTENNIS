import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Trophy, 
  Medal, 
  Crown, 
  TrendingUp, 
  ArrowRight,
  Users,
  Target
} from 'lucide-react';

interface LeaderboardPreviewProps {
  player: any;
  onViewFullLeaderboard: () => void;
}

const LeaderboardPreview: React.FC<LeaderboardPreviewProps> = ({ 
  player, 
  onViewFullLeaderboard 
}) => {
  // Mock current leaderboard data
  const leaderboardData = [
    {
      rank: 1,
      name: 'Alex Rodriguez',
      points: 2650,
      wins: 28,
      losses: 4,
      winRate: 87.5,
      avatar: null,
      trend: 'up'
    },
    {
      rank: 2,
      name: 'Sarah Chen', 
      points: 2580,
      wins: 26,
      losses: 6,
      winRate: 81.3,
      avatar: null,
      trend: 'up'
    },
    {
      rank: 3,
      name: 'Mike Johnson',
      points: 2520,
      wins: 24,
      losses: 7,
      winRate: 77.4,
      avatar: null,
      trend: 'down'
    },
    {
      rank: 4,
      name: player?.name || 'You',
      points: 2400,
      wins: player?.wins || 32,
      losses: player?.losses || 13,
      winRate: player?.total_matches ? Math.round((player.wins / player.total_matches) * 100) : 71,
      avatar: null,
      trend: 'up',
      isCurrentPlayer: true
    },
    {
      rank: 5,
      name: 'Emma Wilson',
      points: 2350,
      wins: 22,
      losses: 9,
      winRate: 71.0,
      avatar: null,
      trend: 'stable'
    }
  ];

  const currentPlayerRank = leaderboardData.find(p => p.isCurrentPlayer)?.rank || 4;
  const totalPlayers = 156; // Mock total
  const percentile = Math.round(((totalPlayers - currentPlayerRank) / totalPlayers) * 100);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2: return <Medal className="h-5 w-5 text-gray-400" />;
      case 3: return <Medal className="h-5 w-5 text-amber-600" />;
      default: return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down': return <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />;
      default: return <div className="h-3 w-3 rounded-full bg-gray-400" />;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Current Rank Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Your League Standing
            </CardTitle>
            <Button variant="outline" size="sm" onClick={onViewFullLeaderboard}>
              <Users className="h-4 w-4 mr-1" />
              Full Rankings
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">#{currentPlayerRank}</div>
                <div className="text-sm text-muted-foreground">Rank</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">2,400</div>
                <div className="text-sm text-muted-foreground">Points</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{percentile}%</div>
                <div className="text-sm text-muted-foreground">Percentile</div>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="secondary" className="flex items-center gap-1 mb-2">
                <TrendingUp className="h-3 w-3" />
                Rising
              </Badge>
              <p className="text-sm text-muted-foreground">
                {totalPlayers - currentPlayerRank} players behind you
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Players Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Leaderboard Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaderboardData.map((player, index) => (
              <div 
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  player.isCurrentPlayer 
                    ? 'bg-primary/10 border-primary/20' 
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8">
                    {getRankIcon(player.rank)}
                  </div>
                  
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={player.avatar} />
                    <AvatarFallback className="text-xs">
                      {getInitials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${player.isCurrentPlayer ? 'text-primary' : ''}`}>
                        {player.name}
                      </span>
                      {player.isCurrentPlayer && (
                        <Badge variant="outline">You</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {player.wins}W - {player.losses}L ({player.winRate}%)
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium">{player.points.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">points</div>
                  </div>
                  
                  <div className="flex items-center">
                    {getTrendIcon(player.trend)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing top 5 players</span>
              <Button variant="ghost" size="sm" onClick={onViewFullLeaderboard}>
                View all {totalPlayers} players
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Climb the Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Next Challenge</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Beat Mike Johnson to move to #3
              </p>
              <Button size="sm" className="w-full">
                Challenge Player
              </Button>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Points to #3</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Earn 120 more points to rank up
              </p>
              <Button variant="outline" size="sm" className="w-full">
                View Point System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaderboardPreview;