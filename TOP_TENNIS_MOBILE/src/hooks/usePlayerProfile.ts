import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface PlayerProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  zip_code?: string;
  skill_level?: number;
  usta_rating?: string;
  competitiveness?: string;
  age_range?: string;
  bio?: string;
  networking_enabled?: boolean;
  gender?: string;
  location?: string;
  gender_preference?: string;
  age_competition_preference?: string;
  travel_distance?: string;
  wins: number;
  losses: number;
  current_streak?: number;
  best_streak?: number;
  profile_picture_url?: string;
  first_name?: string;
  last_name?: string;
}

export function usePlayerProfile() {
  const { user } = useAuth();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlayer = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [{ data: playerData }, { data: profileData }] = await Promise.all([
      supabase.from('players').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('profile_picture_url').eq('id', user.id).maybeSingle(),
    ]);
    if (playerData) {
      const picUrl = playerData.profile_picture_url || profileData?.profile_picture_url || null;
      setPlayer({ ...playerData, profile_picture_url: picUrl });
    } else {
      setPlayer(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPlayer(); }, [user?.id]);

  const createPlayerProfile = async (profileData: Partial<PlayerProfile>) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('players')
      .insert({ ...profileData, user_id: user.id, email: user.email, wins: 0, losses: 0 })
      .select()
      .single();
    if (error) throw error;
    setPlayer(data);
    return data;
  };

  const updatePlayerProfile = async (updates: Partial<PlayerProfile>) => {
    if (!player) throw new Error('No player profile');
    const { data, error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', player.id)
      .select()
      .single();
    if (error) throw error;
    setPlayer(data);
    return data;
  };

  return { player, loading, refetch: fetchPlayer, createPlayerProfile, updatePlayerProfile };
}
