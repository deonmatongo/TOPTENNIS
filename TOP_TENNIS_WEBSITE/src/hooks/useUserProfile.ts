
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';

type Profile = Tables<'profiles'>;

export const useUserProfile = () => {
  const { user } = useAuth();
  const channelTopic = useUniqueChannel('user-profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        console.log('Fetching profile for user:', user.id);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          setError(error.message);
          return;
        }

        console.log('Profile data:', data);
        setProfile(data);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('Failed to fetch profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Propagate avatar/name/bio changes made elsewhere (e.g. another tab,
    // or the mobile app) to every hook instance without a manual refetch.
    const channel = supabase
      .channel(channelTopic)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, () => {
        fetchProfile();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      setProfile(data);
      return data;
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile
  };
};
