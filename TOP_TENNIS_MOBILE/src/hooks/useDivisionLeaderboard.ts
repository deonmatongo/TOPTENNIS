import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';

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
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!divisionId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      try {
        const { data: assignments, error: aErr } = await supabase
          .from('division_assignments')
          .select('user_id, matches_completed, matches_required, playoff_eligible')
          .eq('division_id', divisionId)
          .eq('status', 'active');

        if (aErr) throw aErr;
        if (!assignments || assignments.length === 0) {
          setLeaderboard([]);
          return;
        }

        const userIds = assignments.map((a: any) => a.user_id);
        const { data: players, error: pErr } = await supabase
          .from('players')
          .select('id, user_id, name, wins, losses, total_matches, skill_level, usta_rating')
          .in('user_id', userIds);

        if (pErr) throw pErr;

        const playerMap = new Map((players || []).map((p: any) => [p.user_id, p]));

        const data: LeaderboardPlayer[] = assignments
          .filter((a: any) => {
            const p = playerMap.get(a.user_id);
            return p && p.name;
          })
          .map((a: any) => {
            const p = playerMap.get(a.user_id);
            const points = ((p.wins ?? 0) * 3) + Math.floor((a.matches_completed ?? 0) / 2);
            return {
              id: p.id,
              user_id: a.user_id,
              name: p.name,
              wins: p.wins || 0,
              losses: p.losses || 0,
              total_matches: p.total_matches || 0,
              skill_level: p.skill_level || 0,
              usta_rating: p.usta_rating,
              points,
              matches_completed: a.matches_completed || 0,
              matches_required: a.matches_required || 5,
              playoff_eligible: a.playoff_eligible || false,
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
        console.error('[useDivisionLeaderboard]', e.message);
      } finally {
        setLoading(false);
      }
    };

    fetch();

    const channel = supabase
      .channel(`division-leaderboard-${divisionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'division_assignments', filter: `division_id=eq.${divisionId}` }, fetch)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [divisionId, user?.id]);

  return {
    leaderboard,
    loading,
    currentUser: leaderboard.find(p => p.isCurrentUser),
  };
};
