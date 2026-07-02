import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface MatchSuggestion {
  id: string;
  name: string;
  skill_level?: number;
  usta_rating?: string;
  city?: string;
  wins: number;
  losses: number;
  competitiveness?: string;
  profile_picture_url?: string;
  compatibility_score?: number;
}

export function useMatchSuggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      const { data: me } = await supabase.from('players').select('*').eq('user_id', user.id).maybeSingle();
      if (!me) { setLoading(false); return; }

      // networking_enabled and avatars live on profiles, not players
      const { data } = await supabase
        .from('players')
        .select('*')
        .neq('user_id', user.id)
        .gte('skill_level', (me.skill_level || 5) - 2)
        .lte('skill_level', (me.skill_level || 5) + 2)
        .limit(40);

      const candidates = data || [];
      const userIds = candidates.map(p => p.user_id).filter(Boolean);
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, networking_enabled, profile_picture_url')
            .in('id', userIds)
        : { data: [] as any[] };
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const scored = candidates
        .filter(p => profileMap.get(p.user_id)?.networking_enabled !== false)
        .slice(0, 20)
        .map(p => ({
          ...p,
          profile_picture_url: profileMap.get(p.user_id)?.profile_picture_url ?? undefined,
          compatibility_score: Math.max(0, 100 - Math.abs((p.skill_level || 5) - (me.skill_level || 5)) * 15),
        })).sort((a, b) => (b.compatibility_score || 0) - (a.compatibility_score || 0));

      setSuggestions(scored);
      setLoading(false);
    };
    fetch();
  }, [user?.id]);

  return { suggestions, loading };
}
