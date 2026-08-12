import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { logger } from '@/services/logger';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';

export interface LeaderboardPlayer {
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
  isCurrentUser: boolean;
  rank: number;
}

export const useDivisionLeaderboard = (divisionId?: string) => {
  const { user } = useAuth();
  const channelTopic = useUniqueChannel('division-leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!divisionId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      try {
        // league_standings computes points server-side (wins*3 + bonus) and
        // already joins players + profiles, so one query covers everything.
        const { data: rows, error } = await supabase
          .from('league_standings')
          .select('*')
          .eq('division_id', divisionId);

        if (error) throw error;

        const data: LeaderboardPlayer[] = (rows || [])
          .filter((r: any) => r.player_name)
          .map((r: any) => ({
            id: r.user_id,
            user_id: r.user_id,
            name: r.player_name,
            wins: r.wins || 0,
            losses: r.losses || 0,
            total_matches: r.total_matches || 0,
            skill_level: r.skill_level || 0,
            usta_rating: r.usta_rating,
            points: r.points || 0,
            matches_completed: r.matches_completed || 0,
            matches_required: r.matches_required || 5,
            playoff_eligible: r.playoff_eligible || false,
            isCurrentUser: r.user_id === user?.id,
            rank: 0,
          }));

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
        logger.warn('useDivisionLeaderboard', 'fetch failed', e);
      } finally {
        setLoading(false);
      }
    };

    fetch();

    const channel = supabase
      .channel(`${channelTopic}-${divisionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_matches', filter: `division_id=eq.${divisionId}` }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'division_assignments', filter: `division_id=eq.${divisionId}` }, fetch)
      .subscribe((status: string) => {
        if (__DEV__) console.log('[division-leaderboard] channel status', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [divisionId, user?.id]);

  return {
    leaderboard,
    loading,
    currentUser: leaderboard.find(p => p.isCurrentUser),
  };
};
