import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardPlayer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  wins: number;
  losses: number;
  total_matches: number;
  skill_level: number;
  usta_rating?: string;
  points: number;
  sets_won: number;
  sets_lost: number;
  matches_completed: number;
  matches_required: number;
  playoff_eligible: boolean;
  isCurrentUser: boolean;
  rank?: number;
  winStreak?: number;
  recentForm?: string[];
}

export const useDivisionLeaderboard = (divisionId?: string) => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!divisionId) {
      setLoading(false);
      return;
    }

    const fetchLeaderboard = async () => {
      try {
        // Get all players in the division with their stats
        const { data: divisionAssignments, error: assignmentsError } = await supabase
          .from('division_assignments')
          .select(`
            user_id,
            matches_completed,
            matches_required,
            playoff_eligible,
            profiles!inner(
              id,
              first_name,
              last_name,
              email,
              profile_picture_url
            ),
            players!inner(
              id,
              name,
              wins,
              losses,
              total_matches,
              skill_level,
              usta_rating
            )
          `)
          .eq('division_id', divisionId)
          .eq('status', 'active');

        if (assignmentsError) throw assignmentsError;

        // Calculate points and create leaderboard entries
        const leaderboardData: LeaderboardPlayer[] = (divisionAssignments || []).map((assignment: any) => {
          const player = assignment.players;
          const profile = assignment.profiles;
          
          // Calculate points (3 points per win, bonus for matches completed)
          const points = (player.wins * 3) + Math.floor(assignment.matches_completed / 2);
          
          // Calculate sets (mock calculation based on matches)
          const estimatedSets = player.total_matches * 2.5;
          const sets_won = Math.floor(estimatedSets * (player.wins / Math.max(player.total_matches, 1)));
          const sets_lost = Math.floor(estimatedSets - sets_won);

          return {
            id: player.id,
            user_id: assignment.user_id,
            name: player.name || `${profile.first_name} ${profile.last_name}`,
            email: profile.email,
            avatar_url: profile.profile_picture_url,
            wins: player.wins,
            losses: player.losses,
            total_matches: player.total_matches,
            skill_level: player.skill_level,
            usta_rating: player.usta_rating,
            points,
            sets_won,
            sets_lost,
            matches_completed: assignment.matches_completed,
            matches_required: assignment.matches_required,
            playoff_eligible: assignment.playoff_eligible,
            isCurrentUser: assignment.user_id === user?.id
          };
        });

        // Sort by points (descending) and then by win percentage
        const sortedLeaderboard = leaderboardData
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const aWinRate = a.total_matches > 0 ? a.wins / a.total_matches : 0;
            const bWinRate = b.total_matches > 0 ? b.wins / b.total_matches : 0;
            return bWinRate - aWinRate;
          })
          .map((player, index) => ({
            ...player,
            rank: index + 1,
            winStreak: Math.floor(Math.random() * 5), // Mock for now
            recentForm: ['W', 'W', 'L', 'W', 'L'].slice(0, 5) // Mock for now
          }));

        setLeaderboard(sortedLeaderboard);
      } catch (err) {
        console.error('Error fetching division leaderboard:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();

    // Set up real-time subscription for leaderboard updates
    const channel = supabase
      .channel('division-leaderboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          // Refetch leaderboard when matches are updated
          fetchLeaderboard();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'division_assignments',
          filter: `division_id=eq.${divisionId}`
        },
        () => {
          // Refetch when division assignments change
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [divisionId, user?.id]);

  return {
    leaderboard,
    loading,
    error,
    currentUser: leaderboard.find(player => player.isCurrentUser),
  };
};