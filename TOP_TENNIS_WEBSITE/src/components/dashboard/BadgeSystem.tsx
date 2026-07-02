import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Trophy, 
  Medal, 
  Star, 
  Target, 
  Zap, 
  Crown, 
  Award,
  Shield,
  Flame,
  Clock
} from 'lucide-react';

interface BadgeSystemProps {
  player: any;
  registrations: any[];
}

const BadgeSystem: React.FC<BadgeSystemProps> = ({ player, registrations }) => {
  // Define achievement badges with conditions
  const badges = [
    {
      id: 'first-league',
      name: 'League Rookie',
      description: 'Played your first league',
      icon: Trophy,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      earned: registrations.length > 0,
      rarity: 'common',
      earnedDate: registrations[0]?.registration_date
    },
    {
      id: 'first-win',
      name: 'First Victory',
      description: 'Won your first match',
      icon: Target,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      earned: (player?.wins || 0) > 0,
      rarity: 'common',
      earnedDate: '2024-01-15'
    },
    {
      id: 'win-streak-5',
      name: 'Hot Streak',
      description: 'Won 5 matches in a row',
      icon: Flame,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      earned: (player?.best_streak || 0) >= 5,
      rarity: 'uncommon',
      earnedDate: '2024-03-22'
    },
    {
      id: 'first-final',
      name: 'Finalist',
      description: 'Reached your first league final',
      icon: Medal,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      earned: true, // Mock data
      rarity: 'rare',
      earnedDate: '2024-06-10'
    },
    {
      id: 'champion',
      name: 'Champion',
      description: 'Won your first league championship',
      icon: Crown,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      earned: true, // Mock data
      rarity: 'epic',
      earnedDate: '2024-08-15'
    },
    {
      id: 'veteran',
      name: 'League Veteran',
      description: 'Completed 10 leagues',
      icon: Shield,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      earned: registrations.length >= 10,
      rarity: 'rare',
      earnedDate: registrations.length >= 10 ? '2024-10-01' : null
    },
    {
      id: 'speed-demon',
      name: 'Speed Demon',
      description: 'Won a match in under 45 minutes',
      icon: Zap,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100',
      earned: false, // Not earned yet
      rarity: 'uncommon',
      earnedDate: null
    },
    {
      id: 'marathon-man',
      name: 'Marathon Player',
      description: 'Played for over 50 hours total',
      icon: Clock,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100',
      earned: (player?.hours_played || 0) >= 50,
      rarity: 'rare',
      earnedDate: '2024-09-30'
    }
  ];

  // Define milestones with progress tracking
  const milestones = [
    {
      name: '50 Career Wins',
      current: player?.wins || 32,
      target: 50,
      reward: 'Elite Player Badge',
      icon: Star,
      color: 'text-amber-600'
    },
    {
      name: '5 Championships',
      current: 2, // Mock data
      target: 5,
      reward: 'Tennis Master Badge',
      icon: Crown,
      color: 'text-purple-600'
    },
    {
      name: '100 Hours Played',
      current: Math.round(player?.hours_played || 87),
      target: 100,
      reward: 'Dedicated Player Badge',
      icon: Clock,
      color: 'text-blue-600'
    },
    {
      name: '20 League Streak',
      current: player?.current_streak || 7,
      target: 20,
      reward: 'Unstoppable Badge',
      icon: Flame,
      color: 'text-red-600'
    }
  ];

  const earnedBadges = badges.filter(badge => badge.earned);
  const unearnedBadges = badges.filter(badge => !badge.earned);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-gray-300';
      case 'uncommon': return 'border-green-300';
      case 'rare': return 'border-blue-300';
      case 'epic': return 'border-purple-300';
      case 'legendary': return 'border-yellow-300';
      default: return 'border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Earned Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Achievements
            <Badge variant="secondary">{earnedBadges.length}/{badges.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {earnedBadges.map((badge) => (
              <TooltipProvider key={badge.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`relative p-4 rounded-lg border-2 ${getRarityColor(badge.rarity)} ${badge.bgColor} cursor-help hover:shadow-md transition-shadow`}>
                      <div className="text-center space-y-2">
                        <div className="mx-auto w-fit">
                          <badge.icon className={`h-8 w-8 ${badge.color}`} />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-foreground">
                            {badge.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {badge.rarity}
                          </p>
                        </div>
                      </div>
                      {/* Rarity indicator */}
                      <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                        badge.rarity === 'epic' ? 'bg-purple-500' :
                        badge.rarity === 'rare' ? 'bg-blue-500' :
                        badge.rarity === 'uncommon' ? 'bg-green-500' :
                        'bg-gray-500'
                      }`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-sm text-muted-foreground">{badge.description}</p>
                      {badge.earnedDate && (
                        <p className="text-xs text-muted-foreground">
                          Earned: {new Date(badge.earnedDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            
            {/* Show first few unearned badges as locked */}
            {unearnedBadges.slice(0, 2).map((badge) => (
              <TooltipProvider key={badge.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 cursor-help opacity-60">
                      <div className="text-center space-y-2">
                        <div className="mx-auto w-fit">
                          <badge.icon className="h-8 w-8 text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-gray-600">
                            ???
                          </h4>
                          <p className="text-xs text-gray-400">
                            Locked
                          </p>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-sm text-muted-foreground">{badge.description}</p>
                      <p className="text-xs text-amber-600">Keep playing to unlock!</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress to Next Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Next Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestones.map((milestone, index) => {
              const progress = Math.min((milestone.current / milestone.target) * 100, 100);
              const remaining = Math.max(milestone.target - milestone.current, 0);
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <milestone.icon className={`h-4 w-4 ${milestone.color}`} />
                      <span className="font-medium text-sm">{milestone.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">
                        {milestone.current}/{milestone.target}
                      </span>
                      {remaining > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {remaining} to go
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Progress value={progress} className="h-2" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      Reward: {milestone.reward}
                    </span>
                    <span className="text-xs font-medium text-primary">
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BadgeSystem;