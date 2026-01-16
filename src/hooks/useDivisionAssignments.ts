import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type DivisionAssignment = {
  id: string;
  user_id: string;
  division_id: string;
  league_registration_id: string;
  assigned_at: string;
  status: string;
  matches_completed: number;
  matches_required: number;
  playoff_eligible: boolean;
  division?: {
    id: string;
    league_id: string;
    division_name: string;
    season: string;
    max_players: number;
    current_players: number;
    status: string;
    skill_level_range: string;
    competitiveness: string;
    age_range: string;
    gender_preference: string;
  };
};

export const useDivisionAssignments = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<DivisionAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching division assignments for user:', user.id);
      
      const { data, error } = await supabase
        .from('division_assignments')
        .select(`
          *,
          division:divisions(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching division assignments:', error);
        setError(error.message);
        return;
      }

      console.log('Division assignments:', data);
      setAssignments(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Failed to fetch division assignments');
    } finally {
      setLoading(false);
    }
  };

  const getDivisionMembers = async (divisionId: string) => {
    try {
      const { data, error } = await supabase
        .from('division_assignments')
        .select(`
          user_id,
          matches_completed,
          matches_required,
          playoff_eligible,
          profiles:user_id(first_name, last_name, profile_picture_url)
        `)
        .eq('division_id', divisionId)
        .eq('status', 'active');

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching division members:', err);
      return [];
    }
  };

  const updateMatchProgress = async (assignmentId: string, matchesCompleted: number) => {
    try {
      const { error } = await supabase
        .from('division_assignments')
        .update({ 
          matches_completed: matchesCompleted,
          playoff_eligible: matchesCompleted >= 5
        })
        .eq('id', assignmentId);

      if (error) throw error;
      await fetchAssignments();
    } catch (err) {
      console.error('Error updating match progress:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [user]);

  return {
    assignments,
    loading,
    error,
    refetch: fetchAssignments,
    getDivisionMembers,
    updateMatchProgress
  };
};