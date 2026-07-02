import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Activity, 
  Clock,
  Award,
  BarChart3,
  Calendar
} from 'lucide-react';

interface DivisionAnalyticsProps {
  currentUser: any;
  leaderboard: any[];
  matches: any[];
  divisionAssignment: any;
}

export const DivisionAnalytics: React.FC<DivisionAnalyticsProps> = ({
  currentUser,
  leaderboard,
  matches,
  divisionAssignment
}) => {
  // Calculate analytics
  const userMatches = matches.filter(m => m.isUserMatch && m.status === 'completed');
  const recentMatches = userMatches.slice(0, 5);
  const winStreak = calculateWinStreak(recentMatches);
  const averageMatchDuration = userMatches.length > 0 
    ? Math.round(userMatches.reduce((acc, m) => acc + (m.duration_minutes || 90), 0) / userMatches.length)
    : 0;
  
  // Performance trends
  const last5Matches = recentMatches.slice(0, 5);
  const last5Wins = last5Matches.filter(m => m.result === 'win').length;
  const recentForm = last5Matches.map(m => m.result === 'win' ? 'W' : 'L');
  
  // Division insights
  const divisionSize = leaderboard.length;
  const userRank = currentUser?.rank || divisionSize;
  const topQuartile = Math.ceil(divisionSize * 0.25);
  const isTopQuartile = userRank <= topQuartile;
  
  // Calculate rank change (mock for now)
  const rankChange = Math.floor(Math.random() * 5) - 2; // -2 to +2

  function calculateWinStreak(matches: any[]): number {
    let streak = 0;
    for (const match of matches) {
      if (match.result === 'win') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  const performanceMetrics = [
    {
      label: 'Win Rate',
      value: currentUser ? Math.round((currentUser.wins / Math.max(currentUser.total_matches, 1)) * 100) : 0,
      suffix: '%',
      icon: Target,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Current Streak',
      value: winStreak,
      suffix: winStreak > 0 ? ' wins' : ' matches',
      icon: TrendingUp,
      color: winStreak > 0 ? 'text-green-600' : 'text-gray-500',
      bgColor: winStreak > 0 ? 'bg-green-100' : 'bg-gray-100'
    },
    {
      label: 'Avg Match Time',
      value: averageMatchDuration,
      suffix: ' min',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Sets Won',
      value: currentUser?.sets_won || 0,
      suffix: '',
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {performanceMetrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`w-5 h-5 ${metric.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metric.value}{metric.suffix}</p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Division Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Division Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-primary">#{userRank}</div>
              <div className="text-sm text-muted-foreground">Current Rank</div>
              {rankChange !== 0 && (
                <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${
                  rankChange > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {rankChange > 0 ? (
                    <>
                      <TrendingDown className="w-3 h-3" />
                      -{rankChange}
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-3 h-3" />
                      +{Math.abs(rankChange)}
                    </>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-primary">{currentUser?.points || 0}</div>
              <div className="text-sm text-muted-foreground">League Points</div>
              <div className="text-xs text-muted-foreground mt-1">
                3 pts per win + completion bonus
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-primary">{divisionSize}</div>
              <div className="text-sm text-muted-foreground">Division Size</div>
              {isTopQuartile && (
                <Badge className="text-xs mt-1 bg-yellow-100 text-yellow-800">
                  Top 25%
                </Badge>
              )}
            </div>
          </div>
          
          {/* Recent Form */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Recent Form (Last 5 matches)</span>
              <span className="text-xs text-muted-foreground">{last5Wins}/5 wins</span>
            </div>
            <div className="flex space-x-2">
              {recentForm.map((result, index) => (
                <div
                  key={index}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    result === 'W' ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  {result}
                </div>
              ))}
              {recentForm.length < 5 && (
                Array.from({ length: 5 - recentForm.length }).map((_, index) => (
                  <div key={`empty-${index}`} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-400">-</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Completion Progress */}
      {divisionAssignment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Season Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Matches Completed</span>
                  <span>{divisionAssignment.matches_completed} / {divisionAssignment.matches_required}</span>
                </div>
                <Progress 
                  value={(divisionAssignment.matches_completed / divisionAssignment.matches_required) * 100}
                  className="h-3"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Remaining Matches:</span>
                  <span className="ml-2 font-medium">
                    {Math.max(0, divisionAssignment.matches_required - divisionAssignment.matches_completed)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Playoff Status:</span>
                  {divisionAssignment.playoff_eligible ? (
                    <Badge className="ml-2 bg-green-100 text-green-800">
                      <Award className="w-3 h-3 mr-1" />
                      Eligible
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2">
                      Need {Math.max(0, divisionAssignment.matches_required - divisionAssignment.matches_completed)} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};