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

      const { data } = await supabase
        .from('players')
        .select('*')
        .neq('user_id', user.id)
        .eq('networking_enabled', true)
        .gte('skill_level', (me.skill_level || 5) - 2)
        .lte('skill_level', (me.skill_level || 5) + 2)
        .limit(20);

      const scored = (data || []).map(p => ({
        ...p,
        compatibility_score: Math.max(0, 100 - Math.abs((p.skill_level || 5) - (me.skill_level || 5)) * 15),
      })).sort((a, b) => (b.compatibility_score || 0) - (a.compatibility_score || 0));

      setSuggestions(scored);
      setLoading(false);
    };
    fetch();
  }, [user?.id]);

  return { suggestions, loading };
}
