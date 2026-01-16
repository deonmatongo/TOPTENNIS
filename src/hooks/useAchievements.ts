import { useMemo } from 'react';
import { Trophy, Flame, Medal, Star, Target, Award, Zap, TrendingUp } from 'lucide-react';

interface Match {
  id: string;
  match_date: string;
  status: string;
  winner_id: string;
  player1_id: string;
  player2_id: string;
}

interface Player {
  id: string;
  wins?: number;
  losses?: number;
  total_matches?: number;
  current_streak?: number;
  best_streak?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string | null;
  icon: any;
  color: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

export const useAchievements = (matches: Match[], player: Player) => {
  const achievements = useMemo(() => {
    if (!player?.id) return [];

    const completedMatches = matches.filter(
      m => (m.player1_id === player.id || m.player2_id === player.id) && m.status === 'completed'
    );

    const wonMatches = completedMatches.filter(m => m.winner_id === player.id);
    const totalMatches = completedMatches.length;
    const totalWins = wonMatches.length;
    const currentStreak = player.current_streak || 0;
    const bestStreak = player.best_streak || 0;

    // Find first win date
    const firstWin = wonMatches.sort((a, b) => 
      new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    )[0];

    const achievementsList: Achievement[] = [
      {
        id: 'first_victory',
        title: 'First Victory',
        description: 'Won your first match',
        date: firstWin ? new Date(firstWin.match_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null,
        icon: Trophy,
        color: 'text-yellow-600',
        unlocked: totalWins >= 1,
        progress: Math.min(totalWins, 1),
        target: 1
      },
      {
        id: 'win_streak_5',
        title: 'Win Streak',
        description: '5 consecutive wins',
        date: bestStreak >= 5 ? 'Achieved' : null,
        icon: Flame,
        color: 'text-orange-600',
        unlocked: bestStreak >= 5,
        progress: Math.min(currentStreak, 5),
        target: 5
      },
      {
        id: 'win_streak_10',
        title: 'Unstoppable',
        description: '10 consecutive wins',
        date: bestStreak >= 10 ? 'Achieved' : null,
        icon: Zap,
        color: 'text-purple-600',
        unlocked: bestStreak >= 10,
        progress: Math.min(currentStreak, 10),
        target: 10
      },
      {
        id: 'matches_10',
        title: 'Getting Started',
        description: 'Play 10 matches',
        date: totalMatches >= 10 ? 'Achieved' : null,
        icon: Target,
        color: 'text-blue-600',
        unlocked: totalMatches >= 10,
        progress: Math.min(totalMatches, 10),
        target: 10
      },
      {
        id: 'matches_50',
        title: 'Dedication Award',
        description: '50 matches played',
        date: totalMatches >= 50 ? 'Achieved' : null,
        icon: Medal,
        color: 'text-green-600',
        unlocked: totalMatches >= 50,
        progress: Math.min(totalMatches, 50),
        target: 50
      },
      {
        id: 'matches_100',
        title: 'Century Club',
        description: '100 matches played',
        date: totalMatches >= 100 ? 'Achieved' : null,
        icon: Award,
        color: 'text-indigo-600',
        unlocked: totalMatches >= 100,
        progress: Math.min(totalMatches, 100),
        target: 100
      },
      {
        id: 'wins_25',
        title: 'Rising Star',
        description: 'Win 25 matches',
        date: totalWins >= 25 ? 'Achieved' : null,
        icon: Star,
        color: 'text-amber-600',
        unlocked: totalWins >= 25,
        progress: Math.min(totalWins, 25),
        target: 25
      },
      {
        id: 'wins_50',
        title: 'Champion',
        description: 'Win 50 matches',
        date: totalWins >= 50 ? 'Achieved' : null,
        icon: Trophy,
        color: 'text-yellow-600',
        unlocked: totalWins >= 50,
        progress: Math.min(totalWins, 50),
        target: 50
      },
      {
        id: 'win_rate_70',
        title: 'Consistent Performer',
        description: '70%+ win rate (min 10 matches)',
        date: totalMatches >= 10 && (totalWins / totalMatches) >= 0.7 ? 'Achieved' : null,
        icon: TrendingUp,
        color: 'text-emerald-600',
        unlocked: totalMatches >= 10 && (totalWins / totalMatches) >= 0.7,
        progress: totalMatches >= 10 ? Math.min((totalWins / totalMatches) * 100, 70) : 0,
        target: 70
      }
    ];

    return achievementsList;
  }, [matches, player]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = Math.round((unlockedCount / totalCount) * 100);

  return {
    achievements,
    unlockedCount,
    totalCount,
    completionPercentage
  };
};
