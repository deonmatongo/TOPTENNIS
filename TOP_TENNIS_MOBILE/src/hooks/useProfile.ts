import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  /** Phone-only accounts have no email. */
  email?: string | null;
  /** Case-insensitive unique handle. Null for legacy email-only accounts. */
  username?: string | null;
  phone?: string;
  city?: string;
  zip_code?: string;
  skill_level?: number;
  usta_rating?: string;
  competitiveness?: string;
  age_range?: string;
  gender?: string;
  wins?: number;
  losses?: number;
  profile_picture_url?: string;
  bio?: string;
  networking_enabled?: boolean;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (err) throw err;
      setProfile(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    // Strip server-controlled fields: username (claim_identity only), identity
    // columns, and aggregate counters that are updated by DB functions.
    const { id: _id, user_id: _uid, username: _u, phone: _ph, wins: _w, losses: _l, ...safe } = updates;
    const { error: err } = await supabase
      .from('profiles')
      .update(safe)
      .eq('id', user.id);
    if (err) throw err;
    setProfile(prev => prev ? { ...prev, ...updates } : prev);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : '';

  return { profile, loading, error, fullName, refetch: fetchProfile, updateProfile };
};
