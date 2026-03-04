import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface MatchResponse {
  id: string;
  match_id: string;
  user_id: string;
  response: 'pending' | 'accepted' | 'declined' | 'proposed';
  proposed_start?: string;
  proposed_end?: string;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface OpponentProfile {
  user_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  skill_level?: number;
  wins?: number;
  losses?: number;
  usta_rating?: string;
  competitiveness?: string;
  age_range?: string;
  city?: string;
  profile_picture_url?: string;
  networking_enabled?: boolean;
  gender?: string | null;
}

export interface MatchWithResponse {
  id: string;
  player1_id: string;
  player2_id: string;
  match_date: string;
  court_location?: string;
  status: string;
  invitation_status: string;
  proposed_start?: string;
  proposed_end?: string;
  reschedule_count: number;
  player1?: {
    name: string;
    user_id: string;
  };
  player2?: {
    name: string;
    user_id: string;
  };
  opponent_profile?: OpponentProfile;
  my_response?: MatchResponse;
  opponent_response?: MatchResponse;
}

export const useMatchResponses = () => {
  const queryClient = useQueryClient();

  // Set up real-time subscription for match responses
  useEffect(() => {
    const channel = supabase
      .channel('match-responses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_responses'
        },
        (payload) => {
          console.log('Match response changed:', payload);
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['match-invites-pending'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: 'invitation_status=in.(pending,rescheduled,accepted,confirmed)'
        },
        (payload) => {
          console.log('Match invitation status changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['match-invites-pending'] });
          
          // Show toast for confirmed matches
          if (payload.new.invitation_status === 'confirmed') {
            toast.success('Match confirmed! Check your schedule.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: pendingInvites = [], isLoading } = useQuery({
    queryKey: ['match-invites-pending'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the current user's player ID
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!player) return [];

      // Fetch matches where user is involved and status is pending/rescheduled
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:players!matches_player1_id_fkey(name, user_id),
          player2:players!matches_player2_id_fkey(name, user_id)
        `)
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .in('invitation_status', ['pending', 'rescheduled', 'accepted'])
        .order('match_date', { ascending: true });

      if (error) throw error;

      // Fetch all responses for these matches
      const matchIds = matches?.map(m => m.id) || [];
      const { data: responses } = await supabase
        .from('match_responses')
        .select('*')
        .in('match_id', matchIds);

      // Collect all unique opponent user IDs to batch-fetch profiles
      const opponentUserIds = Array.from(new Set(
        (matches || []).map(match => {
          return match.player1?.user_id === user.id
            ? match.player2?.user_id
            : match.player1?.user_id;
        }).filter(Boolean) as string[]
      ));

      // Batch-fetch profiles and player stats for all opponents
      const [{ data: profiles }, { data: playerStats }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email, profile_picture_url, city, networking_enabled')
          .in('id', opponentUserIds),
        supabase
          .from('players')
          .select('user_id, skill_level, wins, losses, usta_rating, competitiveness, age_range, gender')
          .in('user_id', opponentUserIds),
      ]);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const statsMap = new Map((playerStats || []).map(p => [p.user_id, p]));

      // Combine matches with responses and opponent profile
      return matches?.map(match => {
        const myResponse = responses?.find(r => r.user_id === user.id && r.match_id === match.id);
        const opponentUserId = match.player1?.user_id === user.id
          ? match.player2?.user_id
          : match.player1?.user_id;
        const opponentResponse = responses?.find(r => r.user_id === opponentUserId && r.match_id === match.id);

        const profile = opponentUserId ? profileMap.get(opponentUserId) : undefined;
        const stats = opponentUserId ? statsMap.get(opponentUserId) : undefined;
        const opponentName = match.player1?.user_id === user.id
          ? match.player2?.name
          : match.player1?.name;

        const opponent_profile: OpponentProfile | undefined = opponentUserId ? {
          user_id: opponentUserId,
          name: opponentName || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Opponent',
          first_name: profile?.first_name ?? undefined,
          last_name: profile?.last_name ?? undefined,
          email: profile?.email ?? undefined,
          profile_picture_url: profile?.profile_picture_url ?? undefined,
          city: profile?.city ?? undefined,
          networking_enabled: profile?.networking_enabled,
          skill_level: stats?.skill_level ?? undefined,
          wins: stats?.wins ?? undefined,
          losses: stats?.losses ?? undefined,
          usta_rating: stats?.usta_rating ?? undefined,
          competitiveness: stats?.competitiveness ?? undefined,
          age_range: stats?.age_range ?? undefined,
          gender: stats?.gender ?? undefined,
        } : undefined;

        return {
          ...match,
          opponent_profile,
          my_response: myResponse,
          opponent_response: opponentResponse
        };
      }) as MatchWithResponse[] || [];
    }
  });

  const respondToMatch = useMutation({
    mutationFn: async ({
      matchId,
      action,
      proposedStart,
      proposedEnd,
      comment
    }: {
      matchId: string;
      action: 'accept' | 'decline' | 'propose';
      proposedStart?: Date;
      proposedEnd?: Date;
      comment?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const responseData: any = {
        match_id: matchId,
        user_id: user.id,
        response: action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'proposed',
      };

      if (action === 'propose') {
        if (!proposedStart || !proposedEnd) {
          throw new Error('Proposed times are required');
        }
        responseData.proposed_start = proposedStart.toISOString();
        responseData.proposed_end = proposedEnd.toISOString();
      }

      if (comment) {
        responseData.comment = comment;
      }

      const { error } = await supabase
        .from('match_responses')
        .upsert(responseData, {
          onConflict: 'match_id,user_id'
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['match-invites-pending'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      const actionMessages = {
        accept: 'Match invitation accepted!',
        decline: 'Match invitation declined',
        propose: 'New time proposed successfully'
      };
      
      toast.success(actionMessages[variables.action]);
    },
    onError: (error: any) => {
      if (error.message.includes('Maximum reschedule attempts')) {
        toast.error('Maximum reschedule attempts reached (3)');
      } else {
        toast.error('Failed to respond to invitation');
      }
    }
  });

  return {
    pendingInvites,
    isLoading,
    respondToMatch
  };
};
