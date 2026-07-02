import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface PlayoffMatchPlayer {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  seed?: number;
}

export interface PlayoffMatch {
  id: string;
  round_number: number;
  match_number: number;
  player1?: PlayoffMatchPlayer;
  player2?: PlayoffMatchPlayer;
  winner_id?: string | null;
  score?: { sets: [number, number][] } | null;
  status: 'pending' | 'scheduled' | 'completed' | 'bye' | 'cancelled';
  is_tbd: boolean;
  scheduled_date?: string | null;
  court_location?: string | null;
}

export interface PlayoffRound {
  round_number: number;
  label: string;
  matches: PlayoffMatch[];
}

const getRoundLabel = (roundNumber: number, totalRounds: number): string => {
  const fromEnd = totalRounds - roundNumber;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinals';
  if (fromEnd === 2) return 'Quarterfinals';
  return `Round ${roundNumber}`;
};

/**
 * Fetches the playoff bracket for a division from the `playoff_brackets` table
 * (created by the 20260323 migration).  Returns empty rounds with `hasData=false`
 * if the table is empty or the migration has not been applied yet, so the UI can
 * show a "Playoffs not configured yet" state gracefully.
 */
export const usePlayoffBracket = (divisionId?: string) => {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<PlayoffRound[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!divisionId) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        setLoading(true);

        // Query playoff_brackets (may not exist before migration is applied)
        const { data: brackets, error: bErr } = await (supabase as any)
          .from('playoff_brackets')
          .select(
            'id, round_number, match_number, player1_id, player2_id, winner_id, score, status, is_tbd, seed_player1, seed_player2, scheduled_date, court_location',
          )
          .eq('division_id', divisionId)
          .order('round_number', { ascending: true })
          .order('match_number', { ascending: true });

        // Table doesn't exist yet or is empty
        if (bErr || !brackets || brackets.length === 0) {
          setRounds([]);
          setHasData(false);
          setLoading(false);
          return;
        }

        // Collect unique player IDs
        const playerIds = [
          ...new Set(
            brackets
              .flatMap((b: any) => [b.player1_id, b.player2_id])
              .filter(Boolean),
          ),
        ] as string[];

        const [{ data: players }, { data: profiles }] = await Promise.all([
          supabase
            .from('players')
            .select('user_id, name')
            .in('user_id', playerIds),
          supabase
            .from('profiles')
            .select('id, first_name, last_name, profile_picture_url')
            .in('id', playerIds),
        ]);

        const playerMap = new Map((players || []).map((p) => [p.user_id, p]));
        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

        const resolvePlayerInfo = (
          userId?: string | null,
          seed?: number | null,
        ): PlayoffMatchPlayer | undefined => {
          if (!userId) return undefined;
          const p = playerMap.get(userId);
          const prof = profileMap.get(userId);
          const name =
            p?.name ||
            [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') ||
            'Player';
          return {
            user_id: userId,
            name,
            avatar_url: prof?.profile_picture_url ?? null,
            seed: seed ?? undefined,
          };
        };

        // Build typed match objects
        const formattedMatches: PlayoffMatch[] = brackets.map((b: any) => ({
          id: b.id,
          round_number: b.round_number,
          match_number: b.match_number,
          player1: b.is_tbd || !b.player1_id
            ? undefined
            : resolvePlayerInfo(b.player1_id, b.seed_player1),
          player2: b.is_tbd || !b.player2_id
            ? undefined
            : resolvePlayerInfo(b.player2_id, b.seed_player2),
          winner_id: b.winner_id,
          score: b.score,
          status: b.status,
          is_tbd: b.is_tbd,
          scheduled_date: b.scheduled_date,
          court_location: b.court_location,
        }));

        const maxRound = Math.max(...formattedMatches.map((m) => m.round_number));
        const roundsData: PlayoffRound[] = [];
        for (let r = 1; r <= maxRound; r++) {
          roundsData.push({
            round_number: r,
            label: getRoundLabel(r, maxRound),
            matches: formattedMatches.filter((m) => m.round_number === r),
          });
        }

        setRounds(roundsData);
        setHasData(true);
        setError(null);
      } catch (err) {
        console.error('usePlayoffBracket error:', err);
        setRounds([]);
        setHasData(false);
        // Don't surface as error — table may just not exist yet
      } finally {
        setLoading(false);
      }
    };

    fetch();

    // Real-time updates when bracket changes
    const channel = (supabase as any)
      .channel(`playoff-bracket-${divisionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'playoff_brackets',
        filter: `division_id=eq.${divisionId}`,
      }, fetch)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [divisionId, user?.id]);

  /** True if the current user has won their most recent playoff match */
  const currentUserIsInBracket = rounds
    .flatMap((r) => r.matches)
    .some(
      (m) => m.player1?.user_id === user?.id || m.player2?.user_id === user?.id,
    );

  return { rounds, hasData, loading, error, currentUserIsInBracket };
};
