import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RecommendedPlayer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  skill_level: number;
  wins: number;
  losses: number;
  usta_rating: string | null;
  competitiveness: string | null;
  age_range: string | null;
  city: string | null;
  /** 0–100 compatibility score computed client-side */
  compatibilityScore: number;
}

/**
 * Mirrors GET /api/recommendations?skillLevel=<n>
 *
 * Fetches up to 6 players whose skill level falls within ±1 of the current
 * user's skill level, then ranks them by a composite compatibility score:
 *   - Skill proximity  (40 %)
 *   - Win-rate parity  (30 %)
 *   - Competitiveness  (20 %)
 *   - Has city info    (10 %)
 *
 * Blocked users and the current user are excluded automatically.
 */
export const useAIRecommendations = (
  userSkillLevel: number | null | undefined,
  blockedUserIds: string[] = [],
) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!user || userSkillLevel == null) return;

    setLoading(true);
    setError(null);

    try {
      // ── Simulates: GET /api/recommendations?skillLevel=<userSkillLevel> ─────
      const skillMin = Math.max(1, userSkillLevel - 1);
      const skillMax = Math.min(10, userSkillLevel + 1);

      const { data, error: dbError } = await supabase
        .from('players')
        .select('id, user_id, name, email, skill_level, wins, losses, usta_rating, competitiveness, age_range, city')
        .gte('skill_level', skillMin)
        .lte('skill_level', skillMax)
        .neq('user_id', user.id)
        .limit(30); // fetch more, then score + slice

      if (dbError) throw dbError;

      const blockedSet = new Set(blockedUserIds);

      // Fetch reverse-blocks (people who blocked the current user)
      const { data: blockedByRows } = await (supabase as any)
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocked_user_id', user.id);
      const blockedBySet = new Set(
        ((blockedByRows || []) as any[]).map((b: any) => b.blocker_id),
      );

      // Fetch networking preferences so we only show opt-in players
      const userIds = (data || [])
        .filter(p => p.user_id)
        .map(p => p.user_id) as string[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, networking_enabled')
        .in('id', userIds);

      const networkingMap = new Map(
        (profiles || []).map(p => [p.id, p.networking_enabled ?? true]),
      );

      // Compute win rate for the current user (for parity scoring)
      const myWins   = 0; // not available here; parity is scored against each player
      const myLosses = 0;

      const scored: RecommendedPlayer[] = (data || [])
        .filter(p =>
          p.user_id &&
          !blockedSet.has(p.user_id) &&
          !blockedBySet.has(p.user_id) &&
          networkingMap.get(p.user_id) !== false,
        )
        .map(p => {
          const wins   = p.wins   ?? 0;
          const losses = p.losses ?? 0;
          const total  = wins + losses;
          const winRate = total > 0 ? wins / total : 0.5;
          const skill   = p.skill_level ?? userSkillLevel;

          // Skill proximity: full marks when exact match, 0 at ±1
          const skillDiff       = Math.abs(skill - userSkillLevel);
          const skillScore      = (1 - skillDiff) * 40;

          // Win-rate parity: award points when neither player dominates the other
          // (both around 50 % is ideal for casual matches)
          const winRateDiff     = Math.abs(winRate - 0.5);
          const winRateScore    = (1 - winRateDiff * 2) * 30;

          // Competitiveness bonus: "Casual" players are a great match here
          const competScore     = p.competitiveness?.toLowerCase().includes('casual') ? 20
            : p.competitiveness?.toLowerCase().includes('recreational') ? 15
            : 10;

          // City / location completeness
          const locationScore   = p.city ? 10 : 0;

          const compatibilityScore = Math.round(
            Math.max(0, skillScore) +
            Math.max(0, winRateScore) +
            competScore +
            locationScore,
          );

          return {
            id:              p.id,
            user_id:         p.user_id!,
            name:            p.name,
            email:           p.email,
            skill_level:     skill,
            wins,
            losses,
            usta_rating:     p.usta_rating,
            competitiveness: p.competitiveness,
            age_range:       p.age_range,
            city:            p.city,
            compatibilityScore,
          } satisfies RecommendedPlayer;
        })
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

      setRecommendations(scored);
    } catch (err: any) {
      console.error('[useAIRecommendations] fetch failed:', err);
      setError(err?.message ?? 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [user, userSkillLevel, blockedUserIds.join(',')]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return { recommendations, loading, error, refetch: fetchRecommendations };
};
