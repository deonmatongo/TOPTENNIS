import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { logger } from '@/utils/logger';

type Player = Tables<'players'>;

export const usePlayerProfile = () => {
  const { user } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPlayerProfile = async () => {
      try {
        logger.debug('Fetching player profile for user', { userId: user.id });
        
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          logger.error('Error fetching player profile', { message: error.message });
          setError(error.message);
          return;
        }

        logger.debug('Player profile fetched', { hasProfile: !!data });
        setPlayer(data);
      } catch (err) {
        logger.error('Unexpected error fetching player profile', { err });
        setError('Failed to fetch player profile');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerProfile();
  }, [user]);

  const createPlayerProfile = async (playerData: {
    name: string;
    email: string;
    phone?: string;
    skill_level?: number;
    age_range?: string;
    age_competition_preference?: string;
    travel_distance?: string;
    gender_preference?: string;
    competitiveness?: string;
    usta_rating?: string;
    gender?: string;
    location?: string;
    city?: string;
    zip_code?: string;
  }) => {
    if (!user) {
      throw new Error('No authenticated user found');
    }

    try {
      logger.info('Creating player profile', { userId: user.id });
      
      // First check if a player profile already exists for this user
      const { data: existingPlayer, error: checkError } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking for existing player', { message: checkError.message });
        throw new Error('Failed to check for existing profile');
      }

      if (existingPlayer) {
        logger.info('Player profile already exists, updating instead');
        const { data, error } = await supabase
          .from('players')
          .update(playerData)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          logger.error('Error updating player profile', { message: error.message });
          throw error;
        }
        
        logger.info('Player profile updated successfully');
        setPlayer(data);
        
        // Update the user profile to mark as completed and add location data
        try {
          const profileUpdates: any = { profile_completed: true };
          
          if (playerData.location) profileUpdates.location = playerData.location;
          if (playerData.city) profileUpdates.city = playerData.city;
          if (playerData.zip_code) profileUpdates.zip_code = playerData.zip_code;
          
          await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', user.id);
          logger.debug('Profile marked as completed and location data saved');
        } catch (profileError) {
          logger.warn('Error updating profile', { profileError });
          // Don't throw here as the player profile was updated successfully
        }
        
        return data;
      }

      // Create new player profile
      const profileToInsert = {
        user_id: user.id,
        ...playerData
      };

      logger.debug('Inserting new player profile');

      const { data, error } = await supabase
        .from('players')
        .insert(profileToInsert)
        .select()
        .single();

      if (error) {
        logger.error('Error creating player profile', {
          message: error.message,
          code: error.code,
          details: error.details,
        });
        
        // Handle specific duplicate email error
        if (error.code === '23505') {
          if (error.message.includes('players_email_key')) {
            throw new Error('An account with this email already exists. Please use a different email address.');
          }
          if (error.message.includes('players_user_id_key')) {
            throw new Error('A profile already exists for this user. Please refresh the page.');
          }
        }
        
        throw new Error(`Database error: ${error.message}`);
      }
      
      logger.info('Player profile created successfully');
      setPlayer(data);
      
      // Update the user profile to mark as completed and add location data
      try {
        const profileUpdates: any = { profile_completed: true };
        
        if (playerData.location) profileUpdates.location = playerData.location;
        if (playerData.city) profileUpdates.city = playerData.city;
        if (playerData.zip_code) profileUpdates.zip_code = playerData.zip_code;
        
        await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', user.id);
        logger.debug('Profile marked as completed and location data saved');
      } catch (profileError) {
        logger.warn('Error updating profile', { profileError });
        // Don't throw here as the player profile was created successfully
      }
      
      return data;
    } catch (err: any) {
      logger.error('Error in createPlayerProfile', { err });
      
      // Provide user-friendly error messages
      if (err.message.includes('players_email_key')) {
        throw new Error('An account with this email already exists. Please use a different email address.');
      }
      
      if (err.message && typeof err.message === 'string') {
        throw err;
      }
      
      throw new Error('Failed to create player profile. Please try again.');
    }
  };

  return {
    player,
    loading,
    error,
    createPlayerProfile
  };
};
