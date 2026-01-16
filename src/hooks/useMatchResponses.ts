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

      // Combine matches with responses
      return matches?.map(match => {
        const myResponse = responses?.find(r => r.user_id === user.id && r.match_id === match.id);
        const opponentUserId = match.player1?.user_id === user.id 
          ? match.player2?.user_id 
          : match.player1?.user_id;
        const opponentResponse = responses?.find(r => r.user_id === opponentUserId && r.match_id === match.id);

        return {
          ...match,
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
