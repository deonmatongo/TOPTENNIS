import { useMemo } from 'react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { PerformanceMatch } from './usePlayerPerformance';

interface MonthlyPerformance {
  month: string;
  winRate: number;
  setWinRate: number;
  matches: number;
  wins: number;
  losses: number;
}

export const usePerformanceAnalytics = (matches: PerformanceMatch[]) => {
  const analytics = useMemo(() => {
    if (!matches.length) {
      return {
        monthlyData: [],
        overall: {
          totalMatches: 0,
          totalWins: 0,
          totalLosses: 0,
          winRate: 0,
          totalHours: 0,
        },
      };
    }

    // Sort ascending for the chart
    const sorted = [...matches].sort(
      (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
    );

    const matchesByMonth = sorted.reduce((acc, match) => {
      try {
        const date = parseISO(match.matchDate);
        const monthKey = format(startOfMonth(date), 'MMM yyyy');

        if (!acc[monthKey]) {
          acc[monthKey] = { matches: [] as PerformanceMatch[], wins: 0, losses: 0, setsWon: 0, setsLost: 0 };
        }

        acc[monthKey].matches.push(match);
        if (match.isWin) acc[monthKey].wins++;
        else acc[monthKey].losses++;
        acc[monthKey].setsWon += match.setsWon;
        acc[monthKey].setsLost += match.setsLost;
      } catch {
        // ignore unparseable dates
      }
      return acc;
    }, {} as Record<string, { matches: PerformanceMatch[]; wins: number; losses: number; setsWon: number; setsLost: number }>);

    const monthlyData: MonthlyPerformance[] = Object.entries(matchesByMonth).map(([monthLabel, data]) => {
      const totalM = data.matches.length;
      const winRate = totalM > 0 ? Math.round((data.wins / totalM) * 100) : 0;
      const totalSets = data.setsWon + data.setsLost;
      const setWinRate = totalSets > 0 ? Math.round((data.setsWon / totalSets) * 100) : 0;

      return {
        month: format(new Date(monthLabel), 'MMM'),
        winRate,
        setWinRate,
        matches: totalM,
        wins: data.wins,
        losses: data.losses,
      };
    });

    const totalWins = matches.filter(m => m.isWin).length;
    const totalMatches = matches.length;
    const totalMinutes = matches.reduce((sum, m) => sum + (m.durationMinutes ?? 90), 0);

    return {
      monthlyData,
      overall: {
        totalMatches,
        totalWins,
        totalLosses: totalMatches - totalWins,
        winRate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
        totalHours: Math.round(totalMinutes / 60),
      },
    };
  }, [matches]);

  return analytics;
};
