import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type UserAvailability = Tables<'user_availability'>;
type Profile = Tables<'profiles'>;

export interface AvailabilityWithUser extends UserAvailability {
  profile: Profile;
}

export const useAllAvailability = () => {
  const { user } = useAuth();
  const [allAvailability, setAllAvailability] = useState<AvailabilityWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchAllAvailability();

    // Set up real-time subscription for all availability changes
    const channel = supabase
      .channel('all-availability-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_availability',
        },
        (payload) => {
          console.log('Real-time all availability update:', payload);
          fetchAllAvailability();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchAllAvailability = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_availability')
        .select(`
          *,
          profile:profiles!user_availability_user_id_fkey(*)
        `)
        .eq('is_available', true)
        .eq('is_blocked', false)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      // Filter out current user's availability and format the data
      const filteredData = (data || [])
        .filter((item: any) => item.profile && item.profile.id !== user.id)
        .map((item: any) => ({
          ...item,
          profile: item.profile
        })) as AvailabilityWithUser[];

      setAllAvailability(filteredData);
    } catch (error) {
      console.error('Error fetching all availability:', error);
      toast.error('Failed to load available slots');
    } finally {
      setLoading(false);
    }
  };

  // Group availability by user
  const getAvailabilityByUser = () => {
    const grouped = new Map<string, {
      profile: Profile;
      slots: UserAvailability[];
    }>();

    allAvailability.forEach((item) => {
      const userId = item.user_id;
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          profile: item.profile,
          slots: []
        });
      }
      grouped.get(userId)?.slots.push(item);
    });

    return Array.from(grouped.values());
  };

  // Get upcoming availability (next 7 days)
  const getUpcomingAvailability = (days: number = 7) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return allAvailability.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate <= futureDate;
    });
  };

  return {
    allAvailability,
    loading,
    fetchAllAvailability,
    getAvailabilityByUser,
    getUpcomingAvailability,
  };
};