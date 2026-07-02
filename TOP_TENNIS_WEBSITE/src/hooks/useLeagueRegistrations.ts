
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type LeagueRegistration = Tables<'league_registrations'>;

export const useLeagueRegistrations = () => {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<LeagueRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistrations = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching league registrations for user:', user.id);
      
      const { data, error } = await supabase
        .from('league_registrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching registrations:', error);
        setError(error.message);
        return;
      }

      console.log('League registrations:', data);
      setRegistrations(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch registrations');
    } finally {
      setLoading(false);
    }
  };

  const registerForLeague = async (leagueId: string, leagueName: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // First get the player profile to use for division assignment
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (playerError) throw new Error('Player profile not found. Please complete your profile first.');

      // Create the league registration
      const { data, error } = await supabase
        .from('league_registrations')
        .insert({
          user_id: user.id,
          league_id: leagueId,
          league_name: leagueName,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Assign player to division based on their preferences
      const skillLevelText = playerData.usta_rating || `Level ${playerData.skill_level || 'Beginner'}`;
      
      const { error: divisionError } = await supabase
        .rpc('assign_player_to_division', {
          p_user_id: user.id,
          p_league_registration_id: data.id,
          p_league_id: leagueId,
          p_skill_level: skillLevelText,
          p_competitiveness: playerData.competitiveness || 'casual',
          p_age_range: playerData.age_range || '30-39',
          p_gender_preference: playerData.gender_preference || 'no-preference'
        });

      if (divisionError) {
        console.error('Error assigning to division:', divisionError);
        // Don't throw here - registration succeeded, division assignment can be manual
      }

      setRegistrations(prev => [...prev, data]);
      return data;
    } catch (err) {
      console.error('Error registering for league:', err);
      throw err;
    }
  };

  const isRegisteredForLeague = (leagueId: string) => {
    return registrations.some(reg => reg.league_id === leagueId && reg.status === 'active');
  };

  const getRegisteredLeagueIds = () => {
    return registrations.map(reg => reg.league_id);
  };

  useEffect(() => {
    fetchRegistrations();
  }, [user]);

  return {
    registrations,
    loading,
    error,
    refetch: fetchRegistrations,
    registerForLeague,
    isRegisteredForLeague,
    getRegisteredLeagueIds
  };
};
