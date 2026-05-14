import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { captureError } from '@/services/sentry';

export interface LeagueLeaderboardPlayer {
  id: string;
  user_id: string;
  name: string;
  wins: number;
  losses: number;
  total_matches: number;
  skill_level: number;
  usta_rating?: string;
  points: number;
  matches_completed: number;
  matches_required: number;
  playoff_eligible: boolean;
  division_name: string;
  division_id: string;
  isCurrentUser: boolean;
  rank: number;
  profile_picture_url?: string;
}

export const useLeagueLeaderboard = (leagueId?: string) => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeagueLeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      try {
        // Get all divisions for this league
        const { data: divisions } = await supabase
          .from('divisions')
          .select('id, division_name')
          .eq('league_id', leagueId)
          .eq('status', 'active');

        if (!divisions || divisions.length === 0) {
          setLeaderboard([]);
          setLoading(false);
          return;
        }

        const divisionIds = divisions.map(d => d.id);
        const divisionMap = new Map(divisions.map(d => [d.id, d.division_name]));

        // Get all assignments across all divisions
        const { data: assignments, error } = await supabase
          .from('division_assignments')
          .select(`
            user_id,
            division_id,
            matches_completed,
            matches_required,
            playoff_eligible,
            players!inner(id, name, wins, losses, total_matches, skill_level, usta_rating, profile_picture_url)
          `)
          .in('division_id', divisionIds)
          .eq('status', 'active');

        if (error) throw error;

        const data: LeagueLeaderboardPlayer[] = (assignments || []).map((a: any) => {
          const p = a.players;
          const points = (p.wins * 3) + Math.floor((a.matches_completed || 0) / 2);
          return {
            id: p.id,
            user_id: a.user_id,
            name: p.name || 'Unknown',
            wins: p.wins || 0,
            losses: p.losses || 0,
            total_matches: p.total_matches || 0,
            skill_level: p.skill_level || 0,
            usta_rating: p.usta_rating,
            profile_picture_url: p.profile_picture_url,
            points,
            matches_completed: a.matches_completed || 0,
            matches_required: a.matches_required || 5,
            playoff_eligible: a.playoff_eligible || false,
            division_name: divisionMap.get(a.division_id) || 'Division',
            division_id: a.division_id,
            isCurrentUser: a.user_id === user?.id,
            rank: 0,
          };
        });

        const sorted = data
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const aWR = a.total_matches > 0 ? a.wins / a.total_matches : 0;
            const bWR = b.total_matches > 0 ? b.wins / b.total_matches : 0;
            return bWR - aWR;
          })
          .map((p, i) => ({ ...p, rank: i + 1 }));

        setLeaderboard(sorted);
      } catch (e: any) {
        captureError(e);
        if (__DEV__) console.error('[useLeagueLeaderboard]', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [leagueId, user?.id]);

  return {
    leaderboard,
    loading,
    currentUser: leaderboard.find(p => p.isCurrentUser),
    topPlayers: leaderboard.slice(0, 10),
  };
};
