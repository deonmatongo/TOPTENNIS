import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { captureError } from '@/services/sentry';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';

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
  const channelTopic = useUniqueChannel('league-leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeagueLeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      try {
        // league_standings is the server-side standings source (same one the
        // web app's points formula came from): names + avatars from profiles,
        // stats from players, points = wins*3 + floor(matches_completed/2).
        const { data, error } = await supabase
          .from('league_standings')
          .select('*')
          .eq('league_id', leagueId);

        if (error) throw error;

        const sorted: LeagueLeaderboardPlayer[] = (data || [])
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
            profile_picture_url: r.avatar_url ?? undefined,
            points: r.points || 0,
            matches_completed: r.matches_completed || 0,
            matches_required: r.matches_required || 5,
            playoff_eligible: r.playoff_eligible || false,
            division_name: r.division_name || 'Division',
            division_id: r.division_id,
            isCurrentUser: r.user_id === user?.id,
            rank: 0,
          }))
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

    const channel = supabase
      .channel(`${channelTopic}-${leagueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'division_assignments' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetch)
      // Bug fix: league scores go through submit_league_match_score (RPC) which
      // writes to league_matches, not directly to players. Without this listener
      // the league-wide leaderboard missed every league score submission — only
      // division-level (useDivisionLeaderboard) caught it. No column filter here
      // because league_matches has no league_id column; the re-fetch is already
      // scoped by leagueId via the league_standings query.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'league_matches' }, (payload: any) => {
        if (__DEV__) console.log('[league-leaderboard] league_matches UPDATE', payload);
        fetch();
      })
      .subscribe((status: string) => {
        if (__DEV__) console.log('[league-leaderboard] channel status', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [leagueId, user?.id]);

  return {
    leaderboard,
    loading,
    currentUser: leaderboard.find(p => p.isCurrentUser),
    topPlayers: leaderboard.slice(0, 10),
  };
};
