import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';

export interface DivisionAssignment {
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
    tournament_status: string;
  };
}

export const useDivisionAssignments = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<DivisionAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('division_assignments')
      .select('*, division:divisions(*)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (error) console.error('[useDivisionAssignments]', error.message);
    setAssignments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAssignments(); }, [user?.id]);

  return { assignments, loading, refetch: fetchAssignments };
};
