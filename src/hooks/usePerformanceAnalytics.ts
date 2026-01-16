import { useMemo } from 'react';
import { format, startOfMonth, parseISO } from 'date-fns';

interface Match {
  id: string;
  match_date: string;
  status: string;
  winner_id: string;
  player1_id: string;
  player2_id: string;
  duration_minutes?: number;
}

interface MonthlyPerformance {
  month: string;
  winRate: number;
  avgPosition: number;
  points: number;
  matches: number;
  wins: number;
  losses: number;
}

export const usePerformanceAnalytics = (matches: Match[], playerId: string) => {
  const analytics = useMemo(() => {
    if (!playerId || !matches.length) {
      return {
        monthlyData: [],
        overall: {
          totalMatches: 0,
          totalWins: 0,
          totalLosses: 0,
          winRate: 0,
          totalHours: 0
        }
      };
    }

    // Filter matches for this player
    const playerMatches = matches.filter(
      match => (match.player1_id === playerId || match.player2_id === playerId) && 
               match.status === 'completed'
    );

    // Group matches by month
    const matchesByMonth = playerMatches.reduce((acc, match) => {
      try {
        const date = parseISO(match.match_date);
        const monthKey = format(startOfMonth(date), 'MMM yyyy');
        
        if (!acc[monthKey]) {
          acc[monthKey] = {
            matches: [],
            wins: 0,
            losses: 0,
            totalMinutes: 0
          };
        }

        acc[monthKey].matches.push(match);
        
        if (match.winner_id === playerId) {
          acc[monthKey].wins += 1;
        } else {
          acc[monthKey].losses += 1;
        }

        acc[monthKey].totalMinutes += match.duration_minutes || 120;
      } catch (error) {
        console.error('Error parsing match date:', error);
      }

      return acc;
    }, {} as Record<string, { matches: Match[], wins: number, losses: number, totalMinutes: number }>);

    // Convert to array and calculate metrics
    const monthlyData: MonthlyPerformance[] = Object.entries(matchesByMonth)
      .sort((a, b) => {
        const dateA = new Date(a[0]);
        const dateB = new Date(b[0]);
        return dateA.getTime() - dateB.getTime();
      })
      .map(([month, data], index) => {
        const totalMatches = data.matches.length;
        const winRate = totalMatches > 0 ? Math.round((data.wins / totalMatches) * 100) : 0;
        
        // Calculate cumulative points (simplified: 10 points per win, 5 for participation)
        const points = (data.wins * 10) + (totalMatches * 5);

        return {
          month: format(new Date(month), 'MMM'),
          winRate,
          avgPosition: 0, // Would need division standings data
          points,
          matches: totalMatches,
          wins: data.wins,
          losses: data.losses
        };
      });

    // Calculate overall stats
    const totalWins = playerMatches.filter(m => m.winner_id === playerId).length;
    const totalMatches = playerMatches.length;
    const totalMinutes = playerMatches.reduce((sum, m) => sum + (m.duration_minutes || 120), 0);

    return {
      monthlyData,
      overall: {
        totalMatches,
        totalWins,
        totalLosses: totalMatches - totalWins,
        winRate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
        totalHours: Math.round(totalMinutes / 60)
      }
    };
  }, [matches, playerId]);

  return analytics;
};
