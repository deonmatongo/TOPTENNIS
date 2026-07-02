import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AvailabilitySlot {
  date: Date;
  startTime: Date;
  endTime: Date;
  status: 'busy' | 'free';
}

export interface ParticipantAvailability {
  userId: string;
  userName: string;
  availability: AvailabilitySlot[];
  loading: boolean;
  error?: string;
}

interface TimeSlot {
  start: Date;
  end: Date;
  reason: string;
}

interface DateRange {
  start: Date;
  end: Date;
}

export const useParticipantAvailability = (
  participantIds: string[],
  dateRange: DateRange
) => {
  const [availabilityData, setAvailabilityData] = useState<ParticipantAvailability[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (participantIds.length === 0) {
      setAvailabilityData([]);
      return;
    }

    const fetchAvailability = async () => {
      setLoading(true);
      
      const results: ParticipantAvailability[] = [];

      for (const userId of participantIds) {
        try {
          // Fetch user profile for name
          const profileQuery = (supabase as any)
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
          const profileResponse: any = await profileQuery;

          const profile = profileResponse.data;
          const userName = profile 
            ? `${profile.first_name} ${profile.last_name}`
            : 'Unknown User';

          // Fetch user's existing bookings/availability
          const bookingsQuery = (supabase as any)
            .from('match_bookings')
            .select('match_date, start_time, end_time')
            .eq('player1_id', userId)
            .gte('match_date', dateRange.start.toISOString())
            .lte('match_date', dateRange.end.toISOString());
          const bookingsResponse: any = await bookingsQuery;

          if (bookingsResponse.error) {
            results.push({
              userId,
              userName,
              availability: [],
              loading: false,
              error: 'Could not fetch availability',
            });
            continue;
          }

          // Transform bookings to availability slots
          const bookings = bookingsResponse.data || [];
          const availability: AvailabilitySlot[] = bookings.map((booking: any) => ({
            date: new Date(booking.match_date),
            startTime: new Date(`${booking.match_date}T${booking.start_time}`),
            endTime: new Date(`${booking.match_date}T${booking.end_time}`),
            status: 'busy' as const,
          }));

          results.push({
            userId,
            userName,
            availability,
            loading: false,
          });
        } catch (error) {
          results.push({
            userId,
            userName: 'Error loading user',
            availability: [],
            loading: false,
            error: 'Failed to load availability',
          });
        }
      }

      setAvailabilityData(results);
      setLoading(false);
    };

    fetchAvailability();
  }, [participantIds, dateRange.start, dateRange.end]);

  // Find common available time slots
  const suggestBestTimes = (): TimeSlot[] => {
    if (availabilityData.length === 0) return [];

    const suggestions: TimeSlot[] = [];
    
    // Simple algorithm: find slots where all participants are free
    const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM to 9 PM
    const currentDate = new Date(dateRange.start);

    hours.forEach((hour) => {
      const slotStart = new Date(currentDate);
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(hour + 1, 0, 0, 0);

      const allFree = availabilityData.every((participant) => {
        return !participant.availability.some((slot) => {
          return (
            slot.status === 'busy' &&
            ((slotStart >= slot.startTime && slotStart < slot.endTime) ||
              (slotEnd > slot.startTime && slotEnd <= slot.endTime))
          );
        });
      });

      if (allFree && slotStart > new Date()) {
        suggestions.push({
          start: slotStart,
          end: slotEnd,
          reason: 'All participants available',
        });
      }
    });

    return suggestions.slice(0, 5); // Return top 5 suggestions
  };

  return {
    availabilityData,
    loading,
    suggestBestTimes,
  };
};
