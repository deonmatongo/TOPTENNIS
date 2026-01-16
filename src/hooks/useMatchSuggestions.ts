
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';

type MatchSuggestion = Tables<'match_suggestions'> & {
  suggested_player?: Tables<'players'>;
};

export const useMatchSuggestions = (competitivenessFilter?: string) => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchMatchSuggestions();
  }, [user]);

  const fetchMatchSuggestions = async () => {
    try {
      setLoading(true);
      console.log('Fetching match suggestions for user:', user?.id);

      // First get the current player's ID
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (playerError) {
        console.error('Error fetching player:', playerError);
        setError('Failed to fetch player profile');
        return;
      }

      if (!playerData) {
        console.log('No player profile found');
        setSuggestions([]);
        return;
      }

      // Fetch match suggestions with suggested player details - fix the relationship issue
      const { data, error } = await supabase
        .from('match_suggestions')
        .select(`
          *,
          suggested_player:players!match_suggestions_suggested_player_id_fkey(*)
        `)
        .eq('player_id', playerData.id)
        .order('compatibility_score', { ascending: false });

      if (error) {
        console.error('Error fetching match suggestions:', error);
        setError(error.message);
        return;
      }

      console.log('Match suggestions data:', data);
      
      // If no data and competitivenessFilter is 'casual', use dummy data
      if ((!data || data.length === 0) && competitivenessFilter === 'casual') {
        const dummyCasualPlayers: MatchSuggestion[] = [
          {
            id: 'dummy-1',
            player_id: playerData.id,
            suggested_player_id: 'dummy-player-1',
            compatibility_score: 92,
            match_reasons: ['Similar skill level', 'Both prefer casual play', 'Close location'],
            status: 'pending',
            created_at: new Date().toISOString(),
            suggested_player: {
              id: 'dummy-player-1',
              user_id: 'dummy-user-1',
              name: 'Sarah Johnson',
              email: 'sarah.johnson@example.com',
              phone: '555-0101',
              skill_level: 6,
              competitiveness: 'casual',
              age_range: '25-34',
              gender: 'female',
              city: 'Austin',
              zip_code: '78701',
              location: 'Austin, TX',
              wins: 12,
              losses: 8,
              total_matches: 20,
              current_streak: 2,
              best_streak: 4,
              hours_played: 15,
              usta_rating: '3.5',
              gender_preference: 'no-preference',
              age_competition_preference: 'no-preference',
              travel_distance: '0-10',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          },
          {
            id: 'dummy-2',
            player_id: playerData.id,
            suggested_player_id: 'dummy-player-2',
            compatibility_score: 88,
            match_reasons: ['Casual play style', 'Available weekends', 'Similar experience'],
            status: 'pending',
            created_at: new Date().toISOString(),
            suggested_player: {
              id: 'dummy-player-2',
              user_id: 'dummy-user-2',
              name: 'Mike Chen',
              email: 'mike.chen@example.com',
              phone: '555-0102',
              skill_level: 5,
              competitiveness: 'casual',
              age_range: '35-44',
              gender: 'male',
              city: 'Austin',
              zip_code: '78702',
              location: 'Austin, TX',
              wins: 15,
              losses: 12,
              total_matches: 27,
              current_streak: 1,
              best_streak: 3,
              hours_played: 18,
              usta_rating: '3.0',
              gender_preference: 'no-preference',
              age_competition_preference: 'within-bracket',
              travel_distance: '0-15',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          },
          {
            id: 'dummy-3',
            player_id: playerData.id,
            suggested_player_id: 'dummy-player-3',
            compatibility_score: 85,
            match_reasons: ['Enjoys friendly matches', 'Similar schedule', 'Local player'],
            status: 'pending',
            created_at: new Date().toISOString(),
            suggested_player: {
              id: 'dummy-player-3',
              user_id: 'dummy-user-3',
              name: 'Emily Rodriguez',
              email: 'emily.r@example.com',
              phone: '555-0103',
              skill_level: 6,
              competitiveness: 'casual',
              age_range: '25-34',
              gender: 'female',
              city: 'Austin',
              zip_code: '78703',
              location: 'Austin, TX',
              wins: 18,
              losses: 10,
              total_matches: 28,
              current_streak: 3,
              best_streak: 5,
              hours_played: 22,
              usta_rating: '3.5',
              gender_preference: 'no-preference',
              age_competition_preference: 'below-bracket',
              travel_distance: '0-20',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          },
          {
            id: 'dummy-4',
            player_id: playerData.id,
            suggested_player_id: 'dummy-player-4',
            compatibility_score: 81,
            match_reasons: ['Relaxed play style', 'Weekend availability', 'Good match'],
            status: 'pending',
            created_at: new Date().toISOString(),
            suggested_player: {
              id: 'dummy-player-4',
              user_id: 'dummy-user-4',
              name: 'James Wilson',
              email: 'james.w@example.com',
              phone: '555-0104',
              skill_level: 5,
              competitiveness: 'casual',
              age_range: '45-54',
              gender: 'male',
              city: 'Austin',
              zip_code: '78704',
              location: 'Austin, TX',
              wins: 10,
              losses: 9,
              total_matches: 19,
              current_streak: 0,
              best_streak: 2,
              hours_played: 14,
              usta_rating: '3.0',
              gender_preference: 'no-preference',
              age_competition_preference: 'no-preference',
              travel_distance: '0-5',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }
        ];
        
        setSuggestions(dummyCasualPlayers);
      } else {
        setSuggestions(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch match suggestions');
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    try {
      console.log('Generating match suggestions...');
      
      // Get current player ID
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (playerError || !playerData) {
        throw new Error('Player profile not found');
      }

      // Call the generate_match_suggestions function with competitiveness filter
      const { data, error } = await supabase.rpc('generate_match_suggestions', {
        target_player_id: playerData.id,
        competitiveness_filter: competitivenessFilter || null
      });

      if (error) {
        console.error('Error generating suggestions:', error);
        throw error;
      }

      console.log(`Generated ${data} match suggestions`);
      
      // Refresh the suggestions list
      await fetchMatchSuggestions();
      
      return data;
    } catch (err) {
      console.error('Error generating match suggestions:', err);
      throw err;
    }
  };

  const updateSuggestionStatus = async (suggestionId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('match_suggestions')
        .update({ status })
        .eq('id', suggestionId);

      if (error) throw error;

      // Update local state
      setSuggestions(prev => 
        prev.map(suggestion => 
          suggestion.id === suggestionId 
            ? { ...suggestion, status } 
            : suggestion
        )
      );
    } catch (err) {
      console.error('Error updating suggestion status:', err);
      throw err;
    }
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
