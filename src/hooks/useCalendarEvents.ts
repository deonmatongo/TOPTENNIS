import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CalendarEvent {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  location?: string;
  type: 'match_invite' | 'league_match';
  status: string;
  opponent_name?: string;
}

export const useCalendarEvents = () => {
  const { user } = useAuth();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const allEvents: CalendarEvent[] = [];

      // Fetch match invites (casual matches)
      const { data: invites, error: invitesError } = await supabase
        .from('match_invites')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (!invitesError && invites) {
        // Fetch sender and receiver profiles separately
        const userIds = [...new Set(invites.flatMap(i => [i.sender_id, i.receiver_id]))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        invites.forEach(invite => {
          const sender = profileMap.get(invite.sender_id);
          const receiver = profileMap.get(invite.receiver_id);
          
          const opponentProfile = invite.sender_id === user.id ? receiver : sender;
          const opponentName = opponentProfile 
            ? `${opponentProfile.first_name} ${opponentProfile.last_name}`
            : 'Unknown';

          allEvents.push({
            id: invite.id,
            date: invite.date,
            start_time: invite.start_time,
            end_time: invite.end_time,
            title: 'Tennis Match',
            location: invite.court_location,
            type: 'match_invite',
            status: 'confirmed',
            opponent_name: opponentName
          });
        });
      }

      // Fetch confirmed league/division matches
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (player) {
        const { data: matches, error: matchesError } = await supabase
          .from('matches')
          .select(`
            *,
            player1:players!matches_player1_id_fkey(name, user_id),
            player2:players!matches_player2_id_fkey(name, user_id)
          `)
          .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
          .eq('invitation_status', 'confirmed');

        if (!matchesError && matches) {
          matches.forEach(match => {
            // Convert match_date to date and time components
            const matchDateTime = new Date(match.match_date);
            const dateStr = matchDateTime.toISOString().split('T')[0];
            const timeStr = matchDateTime.toTimeString().slice(0, 5);
            
            // Calculate end time (assume 1.5 hour matches)
            const endDateTime = new Date(matchDateTime.getTime() + 90 * 60000);
            const endTimeStr = endDateTime.toTimeString().slice(0, 5);

            const opponentName = match.player1?.user_id === user.id
              ? match.player2?.name
              : match.player1?.name;

            allEvents.push({
              id: match.id,
              date: dateStr,
              start_time: timeStr,
              end_time: endTimeStr,
              title: 'League Match',
              location: match.court_location,
              type: 'league_match',
              status: 'confirmed',
              opponent_name: opponentName
            });
          });
        }
      }

      // Sort by date and time
      return allEvents.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });
    },
    enabled: !!user
  });

  return {
    events,
    isLoading
  };
};
