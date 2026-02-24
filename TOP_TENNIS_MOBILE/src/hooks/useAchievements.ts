import { useMemo } from 'react';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  date: string | null;
  icon: string;
  color: string;
  bgColor: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

interface Player {
  id?: string;
  wins?: number;
  losses?: number;
  total_matches?: number;
  current_streak?: number;
  best_streak?: number;
}

interface Match {
  id: string;
  match_date?: string;
  scheduled_date?: string;
  created_at?: string;
  status: string;
  winner_id?: string;
  player1_id?: string;
  player2_id?: string;
  user_id?: string;
}

export const useAchievements = (matches: Match[], player: Player | null) => {
  const achievements = useMemo((): Achievement[] => {
    if (!player) return [];

    const completedMatches = matches.filter(
      m => m.status === 'completed'
    );

    const wonMatches = completedMatches.filter(m => m.winner_id === player.id);
    const totalMatches = player.total_matches ?? completedMatches.length;
    const totalWins = player.wins ?? wonMatches.length;
    const currentStreak = player.current_streak ?? 0;
    const bestStreak = player.best_streak ?? 0;

    const firstWin = wonMatches
      .slice()
      .sort((a, b) => {
        const da = new Date(a.match_date || a.scheduled_date || a.created_at || 0).getTime();
        const db = new Date(b.match_date || b.scheduled_date || b.created_at || 0).getTime();
        return da - db;
      })[0];

    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return [
      {
        id: 'first_victory',
        title: 'First Victory',
        description: 'Won your first match',
        date: firstWin ? fmtDate(firstWin.match_date || firstWin.scheduled_date || firstWin.created_at || '') : null,
        icon: 'trophy',
        color: '#d97706',
        bgColor: '#fef3c7',
        unlocked: totalWins >= 1,
        progress: Math.min(totalWins, 1),
        target: 1,
      },
      {
        id: 'win_streak_5',
        title: 'Win Streak',
        description: '5 consecutive wins',
        date: bestStreak >= 5 ? 'Achieved' : null,
        icon: 'flame',
        color: '#ea580c',
        bgColor: '#ffedd5',
        unlocked: bestStreak >= 5,
        progress: Math.min(currentStreak, 5),
        target: 5,
      },
      {
        id: 'win_streak_10',
        title: 'Unstoppable',
        description: '10 consecutive wins',
        date: bestStreak >= 10 ? 'Achieved' : null,
        icon: 'flash',
        color: '#7c3aed',
        bgColor: '#ede9fe',
        unlocked: bestStreak >= 10,
        progress: Math.min(currentStreak, 10),
        target: 10,
      },
      {
        id: 'matches_10',
        title: 'Getting Started',
        description: 'Play 10 matches',
        date: totalMatches >= 10 ? 'Achieved' : null,
        icon: 'tennisball',
        color: '#2563eb',
        bgColor: '#dbeafe',
        unlocked: totalMatches >= 10,
        progress: Math.min(totalMatches, 10),
        target: 10,
      },
      {
        id: 'matches_50',
        title: 'Dedication Award',
        description: '50 matches played',
        date: totalMatches >= 50 ? 'Achieved' : null,
        icon: 'medal',
        color: '#16a34a',
        bgColor: '#dcfce7',
        unlocked: totalMatches >= 50,
        progress: Math.min(totalMatches, 50),
        target: 50,
      },
      {
        id: 'matches_100',
        title: 'Century Club',
        description: '100 matches played',
        date: totalMatches >= 100 ? 'Achieved' : null,
        icon: 'ribbon',
        color: '#4f46e5',
        bgColor: '#e0e7ff',
        unlocked: totalMatches >= 100,
        progress: Math.min(totalMatches, 100),
        target: 100,
      },
      {
        id: 'wins_25',
        title: 'Rising Star',
        description: 'Win 25 matches',
        date: totalWins >= 25 ? 'Achieved' : null,
        icon: 'star',
        color: '#b45309',
        bgColor: '#fef3c7',
        unlocked: totalWins >= 25,
        progress: Math.min(totalWins, 25),
        target: 25,
      },
      {
        id: 'wins_50',
        title: 'Champion',
        description: 'Win 50 matches',
        date: totalWins >= 50 ? 'Achieved' : null,
        icon: 'trophy',
        color: '#d97706',
        bgColor: '#fef9c3',
        unlocked: totalWins >= 50,
        progress: Math.min(totalWins, 50),
        target: 50,
      },
      {
        id: 'win_rate_70',
        title: 'Consistent Performer',
        description: '70%+ win rate (min 10 matches)',
        date: totalMatches >= 10 && totalWins / totalMatches >= 0.7 ? 'Achieved' : null,
        icon: 'trending-up',
        color: '#059669',
        bgColor: '#d1fae5',
        unlocked: totalMatches >= 10 && totalWins / totalMatches >= 0.7,
        progress: totalMatches >= 10 ? Math.min(Math.round((totalWins / totalMatches) * 100), 70) : 0,
        target: 70,
      },
    ];
  }, [matches, player]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return { achievements, unlockedCount, totalCount, completionPercentage };
};
