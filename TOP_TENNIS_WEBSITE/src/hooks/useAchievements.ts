import { useMemo } from 'react';
import { Trophy, Flame, Medal, Star, Target, Award, Zap, TrendingUp, Shield, RotateCcw, Clock } from 'lucide-react';
import { PlayerPerformanceStats } from './usePlayerPerformance';

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

export const useAchievements = (stats: PlayerPerformanceStats | null) => {
  const achievements = useMemo(() => {
    if (!stats) return [];

    const {
      totalMatches,
      wins,
      winRate,
      currentStreak,
      bestStreak,
      straightSetsWins,
      comebackWins,
      bagels,
      tiebreakMatches,
      matches,
    } = stats;

    // Find first win date (matches are newest-first, so reverse to get oldest first)
    const firstWinMatch = [...matches].reverse().find(m => m.isWin);
    const firstWinDate = firstWinMatch
      ? new Date(firstWinMatch.matchDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null;

    const achievementsList: Achievement[] = [
      {
        id: 'first_victory',
        title: 'First Victory',
        description: 'Won your first match',
        date: wins >= 1 ? firstWinDate : null,
        icon: Trophy,
        color: 'text-yellow-600',
        unlocked: wins >= 1,
        progress: Math.min(wins, 1),
        target: 1,
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
        target: 5,
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
        target: 10,
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
        target: 10,
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
        target: 50,
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
        target: 100,
      },
      {
        id: 'wins_25',
        title: 'Rising Star',
        description: 'Win 25 matches',
        date: wins >= 25 ? 'Achieved' : null,
        icon: Star,
        color: 'text-amber-600',
        unlocked: wins >= 25,
        progress: Math.min(wins, 25),
        target: 25,
      },
      {
        id: 'wins_50',
        title: 'Champion',
        description: 'Win 50 matches',
        date: wins >= 50 ? 'Achieved' : null,
        icon: Trophy,
        color: 'text-yellow-600',
        unlocked: wins >= 50,
        progress: Math.min(wins, 50),
        target: 50,
      },
      {
        id: 'win_rate_70',
        title: 'Consistent Performer',
        description: '70%+ win rate (min 10 matches)',
        date: totalMatches >= 10 && winRate >= 70 ? 'Achieved' : null,
        icon: TrendingUp,
        color: 'text-emerald-600',
        unlocked: totalMatches >= 10 && winRate >= 70,
        progress: totalMatches >= 10 ? Math.min(winRate, 70) : 0,
        target: 70,
      },
      // Tennis-specific achievements
      {
        id: 'bagel_artist',
        title: 'Bagel Artist',
        description: 'Win a set 6–0',
        date: bagels >= 1 ? 'Achieved' : null,
        icon: Award,
        color: 'text-rose-600',
        unlocked: bagels >= 1,
        progress: Math.min(bagels, 1),
        target: 1,
      },
      {
        id: 'straight_set_specialist',
        title: 'Straight Set Specialist',
        description: 'Win 5 matches without dropping a set',
        date: straightSetsWins >= 5 ? 'Achieved' : null,
        icon: Shield,
        color: 'text-cyan-600',
        unlocked: straightSetsWins >= 5,
        progress: Math.min(straightSetsWins, 5),
        target: 5,
      },
      {
        id: 'comeback_king',
        title: 'Comeback King',
        description: 'Win 3 matches after losing the first set',
        date: comebackWins >= 3 ? 'Achieved' : null,
        icon: RotateCcw,
        color: 'text-violet-600',
        unlocked: comebackWins >= 3,
        progress: Math.min(comebackWins, 3),
        target: 3,
      },
      {
        id: 'tiebreak_titan',
        title: 'Tiebreak Titan',
        description: 'Play 5 matches that include a tiebreak',
        date: tiebreakMatches >= 5 ? 'Achieved' : null,
        icon: Clock,
        color: 'text-sky-600',
        unlocked: tiebreakMatches >= 5,
        progress: Math.min(tiebreakMatches, 5),
        target: 5,
      },
    ];

    return achievementsList;
  }, [stats]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return {
    achievements,
    unlockedCount,
    totalCount,
    completionPercentage,
  };
};
