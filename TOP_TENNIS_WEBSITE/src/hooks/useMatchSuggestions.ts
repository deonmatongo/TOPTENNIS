
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';

type Player = Tables<'players'>;

type MatchSuggestion = Tables<'match_suggestions'> & {
  suggested_player?: Player;
};

// ── Client-side scoring (mirrors the DB function logic) ───────────────────────
// Used as a fallback when the DB has no stored suggestions yet.
type PlayerLike = Pick<Player, 'skill_level' | 'competitiveness' | 'wins' | 'losses'> & Partial<Player>;

function scoreCandidate(
  me: { skill_level: number | null; competitiveness: string | null; wins: number | null; losses: number | null },
  candidate: PlayerLike
): { score: number; reasons: string[] } {
  const mySkill = me.skill_level ?? 5;
  const cSkill  = candidate.skill_level ?? 5;
  const skillDiff = Math.abs(mySkill - cSkill);

  const myTotal = (me.wins ?? 0) + (me.losses ?? 0);
  const myWinRate = myTotal > 0 ? (me.wins ?? 0) / myTotal : 0.5;
  const cTotal = (candidate.wins ?? 0) + (candidate.losses ?? 0);
  const cWinRate = cTotal > 0 ? (candidate.wins ?? 0) / cTotal : 0.5;

  // Skill proximity (40 pts)
  const skillScore = skillDiff === 0 ? 40 : skillDiff === 1 ? 30 : skillDiff === 2 ? 18 : 8;

  // Competitiveness match (20 pts)
  const adjacent = (a: string | null, b: string | null) => {
    const groups = [['casual', 'intermediate'], ['intermediate', 'competitive']];
    return groups.some(g => g.includes(a ?? '') && g.includes(b ?? ''));
  };
  const compScore = candidate.competitiveness === me.competitiveness ? 20
    : adjacent(candidate.competitiveness, me.competitiveness) ? 10 : 0;

  // Activity score (20 pts) — linear up to 20 matches
  const activityScore = Math.min(20, cTotal);

  // Win-rate balance (10 pts)
  const rateDiff = Math.abs(myWinRate - cWinRate);
  const winRateScore = Math.max(0, Math.round(10 - rateDiff * 20));

  const total = skillScore + compScore + activityScore + winRateScore;

  const reasons: string[] = [];
  if (skillScore >= 30) reasons.push('Similar skill level');
  else if (skillScore >= 18) reasons.push('Close skill level');
  if (compScore === 20) reasons.push('Matching play style');
  else if (compScore === 10) reasons.push('Compatible play style');
  if (activityScore >= 15) reasons.push('Very active player');
  else if (activityScore >= 8) reasons.push('Active player');
  if (winRateScore >= 8) reasons.push('Balanced match-up');

  return { score: total, reasons };
}

export const useMatchSuggestions = (competitivenessFilter?: string, blockedUserIds: string[] = []) => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const blockedSet = new Set(blockedUserIds);

  const fetchMatchSuggestions = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);

      // Get current player profile
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id, skill_level, competitiveness, wins, losses')
        .eq('user_id', user.id)
        .single();

      if (playerError || !playerData) {
        setError('Failed to fetch player profile');
        return;
      }

      // Fetch stored suggestions from DB
      const { data, error: fetchErr } = await supabase
        .from('match_suggestions')
        .select(`
          *,
          suggested_player:players!match_suggestions_suggested_player_id_fkey(*)
        `)
        .eq('player_id', playerData.id)
        .eq('status', 'pending')
        .order('compatibility_score', { ascending: false });

      if (fetchErr) {
        setError(fetchErr.message);
        return;
      }

      // Filter out blocked/unfriended users
      const dbSuggestions = (data || []).filter(
        (s: MatchSuggestion) => !blockedSet.has(s.suggested_player?.user_id ?? '')
      );

      if (dbSuggestions.length > 0) {
        setSuggestions(dbSuggestions);
        return;
      }

      // ── Fallback: client-side scoring ────────────────────────────────────
      // DB has no stored suggestions yet (will be populated on generateSuggestions).
      // Build live candidates from the players table so the UI is never empty.
      const { data: allPlayers } = await supabase
        .from('players')
        .select('id, user_id, name, email, skill_level, competitiveness, wins, losses, total_matches, usta_rating, age_range, gender, location, city')
        .neq('user_id', user.id);

      if (!allPlayers || allPlayers.length === 0) {
        setSuggestions([]);
        return;
      }

      // Fetch profiles to check networking_enabled and blocked status
      const userIds = allPlayers.map(p => p.user_id).filter(Boolean) as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, networking_enabled')
        .in('id', userIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Fetch users who have blocked the current user (bidirectional)
      const { data: blockedBy } = await (supabase as any)
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocked_user_id', user.id);
      const blockedBySet = new Set(((blockedBy || []) as any[]).map((b: any) => b.blocker_id));

      const candidates = allPlayers.filter(p => {
        if (!p.user_id) return false;
        if (blockedSet.has(p.user_id)) return false;
        if (blockedBySet.has(p.user_id)) return false;
        const profile = profileMap.get(p.user_id);
        if (profile?.networking_enabled === false) return false;
        const skillDiff = Math.abs((p.skill_level ?? 5) - (playerData.skill_level ?? 5));
        if (skillDiff > 3) return false;
        if (competitivenessFilter && p.competitiveness !== competitivenessFilter) return false;
        return true;
      });

      const scored: MatchSuggestion[] = candidates
        .map(c => {
          const { score, reasons } = scoreCandidate(playerData, c);
          return {
            id: `live-${c.id}`,
            player_id: playerData.id,
            suggested_player_id: c.id,
            compatibility_score: score,
            match_reasons: reasons,
            status: 'pending',
            created_at: new Date().toISOString(),
            suggested_player: c as unknown as Player,
          } satisfies MatchSuggestion;
        })
        .filter(s => s.compatibility_score >= 20)
        .sort((a, b) => b.compatibility_score - a.compatibility_score)
        .slice(0, 10);

      setSuggestions(scored);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch match suggestions');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, competitivenessFilter, blockedUserIds.join(',')]);

  // Re-fetch whenever user, filter, or blocked list changes
  useEffect(() => {
    fetchMatchSuggestions();
  }, [fetchMatchSuggestions]);

  const generateSuggestions = async () => {
    if (!user) throw new Error('Not authenticated');

    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (playerError || !playerData) throw new Error('Player profile not found');

    const { data, error } = await supabase.rpc('generate_match_suggestions', {
      target_player_id: playerData.id,
      competitiveness_filter: competitivenessFilter || null
    });

    if (error) throw error;

    await fetchMatchSuggestions();
    return data as number;
  };

  const updateSuggestionStatus = async (suggestionId: string, status: string) => {
    // Live (client-side) suggestions don't have a DB row — just remove locally
    if (suggestionId.startsWith('live-')) {
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      return;
    }

    const { error } = await supabase
      .from('match_suggestions')
      .update({ status })
      .eq('id', suggestionId);

    if (error) throw error;

    setSuggestions(prev =>
      prev.map(s => s.id === suggestionId ? { ...s, status } : s)
    );
  };

  return {
    suggestions,
    loading,
    error,
    generateSuggestions,
    updateSuggestionStatus,
    refetch: fetchMatchSuggestions
  };
};
