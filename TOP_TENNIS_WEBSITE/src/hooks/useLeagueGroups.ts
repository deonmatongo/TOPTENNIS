import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface GroupPlayer {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  wins: number;
  losses: number;
  total_matches: number;
  points: number;
  matches_completed: number;
  matches_required: number;
  playoff_eligible: boolean;
  isCurrentUser: boolean;
  rank: number;
  win_rate: number;
  recentForm?: ('W' | 'L')[];
}

export interface LeagueGroup {
  id: string;
  division_name: string;
  gender_preference: string;
  skill_level_range: string;
  competitiveness: string;
  season: string;
  status: string;
  tournament_status: string | null;
  current_players: number;
  max_players: number;
  isCurrentUserGroup: boolean;
  players: GroupPlayer[];
}

export interface OverallStandingPlayer extends GroupPlayer {
  division_name: string;
  overall_rank: number;
}

/**
 * Fetches all groups (divisions) for a league along with per-group standings
 * and aggregated cross-group overall standings.
 *
 * Groups are naturally filtered by sex/skill because the division records carry
 * gender_preference and skill_level_range.  Max-10 is enforced at DB level by
 * the 20260323 migration.
 */
export const useLeagueGroups = (leagueId?: string, currentDivisionId?: string) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<LeagueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        setLoading(true);

        // 1. All divisions for this league
        const { data: divisions, error: divErr } = await supabase
          .from('divisions')
          .select('*')
          .eq('league_id', leagueId)
          .order('division_name', { ascending: true });

        if (divErr) throw divErr;

        if (!divisions || divisions.length === 0) {
          setGroups([]);
          return;
        }

        const divisionIds = divisions.map((d) => d.id);

        // 2. All active assignments for these divisions (one query)
        const { data: assignments, error: asgErr } = await supabase
          .from('division_assignments')
          .select('*')
          .in('division_id', divisionIds)
          .eq('status', 'active');

        if (asgErr) throw asgErr;

        const userIds = [...new Set((assignments || []).map((a) => a.user_id))];

        // 3. Player stats
        const { data: players } = await supabase
          .from('players')
          .select('user_id, name, wins, losses, total_matches, skill_level, usta_rating')
          .in('user_id', userIds);

        // 4. Profile pictures & display names
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, profile_picture_url')
          .in('id', userIds);

        const playerMap = new Map((players || []).map((p) => [p.user_id, p]));
        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

        const resolvePlayer = (userId: string, asn: (typeof assignments)[0]): GroupPlayer => {
          const p = playerMap.get(userId);
          const prof = profileMap.get(userId);
          const w = p?.wins ?? 0;
          const l = p?.losses ?? 0;
          const tm = p?.total_matches ?? 0;
          const points = w * 3 + Math.floor(asn.matches_completed / 2);
          const name =
            p?.name ||
            [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') ||
            'Unknown';

          return {
            user_id: userId,
            name,
            avatar_url: prof?.profile_picture_url,
            wins: w,
            losses: l,
            total_matches: tm,
            points,
            matches_completed: asn.matches_completed,
            matches_required: asn.matches_required,
            playoff_eligible: asn.playoff_eligible,
            isCurrentUser: userId === user?.id,
            win_rate: tm > 0 ? Math.round((w / tm) * 100) : 0,
            rank: 0, // filled below after sorting
          };
        };

        // 5. Build per-group data
        const groupData: LeagueGroup[] = divisions.map((div) => {
          const divAssignments = (assignments || []).filter(
            (a) => a.division_id === div.id,
          );

          const players: GroupPlayer[] = divAssignments
            .map((a) => resolvePlayer(a.user_id, a))
            .sort((a, b) => {
              if (b.points !== a.points) return b.points - a.points;
              return b.win_rate - a.win_rate;
            })
            .map((p, i) => ({ ...p, rank: i + 1 }));

          return {
            id: div.id,
            division_name: div.division_name,
            gender_preference: div.gender_preference,
            skill_level_range: div.skill_level_range,
            competitiveness: div.competitiveness,
            season: div.season,
            status: div.status,
            tournament_status: div.tournament_status,
            current_players: div.current_players,
            max_players: div.max_players,
            isCurrentUserGroup: div.id === currentDivisionId,
            players,
          };
        });

        setGroups(groupData);
        setError(null);
      } catch (err) {
        console.error('useLeagueGroups error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load groups');
      } finally {
        setLoading(false);
      }
    };

    fetch();

    // Real-time: refresh when division_assignments change within these divisions
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase
      .from('divisions')
      .select('id')
      .eq('league_id', leagueId)
      .then(({ data: divs }) => {
        if (!divs?.length) return;
        channel = supabase
          .channel(`league-groups-${leagueId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'division_assignments',
          }, fetch)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'matches',
          }, fetch)
          .subscribe();
      });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [leagueId, currentDivisionId, user?.id]);

  /** All players across all groups, sorted by points (cross-group ranking) */
  const overallStandings: OverallStandingPlayer[] = groups
    .flatMap((g) =>
      g.players.map((p) => ({ ...p, division_name: g.division_name })),
    )
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.win_rate - a.win_rate;
    })
    .map((p, i) => ({ ...p, overall_rank: i + 1 }));

  return { groups, overallStandings, loading, error };
};
