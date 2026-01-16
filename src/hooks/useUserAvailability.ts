import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type UserAvailability = Tables<'user_availability'>;

export const useUserAvailability = () => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchAvailability();

    // Set up real-time subscription for user availability
    const channel = supabase
      .channel('user-availability-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'user_availability',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Real-time availability update:', payload);
          fetchAvailability();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', user?.id)
        .order('date', { ascending: true });

      if (error) throw error;
      setAvailability(data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
      toast.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const createAvailability = async (availabilityData: {
    date: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
    notes?: string;
    privacy_level?: string;
    recurrence_rule?: string;
  }) => {
    if (!user) return;

    // Validate that date/time is not in the past
    const now = new Date();
    const availDate = new Date(availabilityData.date);
    const [hours, minutes] = availabilityData.start_time.split(':').map(Number);
    availDate.setHours(hours, minutes, 0, 0);
    
    if (availDate < now) {
      toast.error('Cannot create availability for past dates or times');
      throw new Error('Cannot create availability for past dates or times');
    }

    // Create optimistic update data
    const optimisticData = {
      id: crypto.randomUUID(),
      user_id: user.id,
      privacy_level: 'public' as const,
      is_blocked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...availabilityData,
    };

    // Optimistically update UI immediately
    setAvailability(prev => [...prev, optimisticData as UserAvailability].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ));

    try {
      const { data, error } = await supabase
        .from('user_availability')
        .insert({
          user_id: user.id,
          ...availabilityData,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Replace optimistic data with real data from server
      setAvailability(prev => 
        prev.map(item => item.id === optimisticData.id ? data : item)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );
      
      toast.success('Availability updated');
      return data;
    } catch (error) {
      // Rollback optimistic update on error
      setAvailability(prev => prev.filter(item => item.id !== optimisticData.id));
      console.error('Error creating availability:', error);
      toast.error('Failed to update availability');
      throw error;
    }
  };

  const updateAvailability = async (id: string, updates: Partial<UserAvailability>) => {
    try {
      const { data, error } = await supabase
        .from('user_availability')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setAvailability(prev => 
        prev.map(item => item.id === id ? data : item)
      );
      
      toast.success('Availability updated');
      return data;
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
      throw error;
    }
  };

  const deleteAvailability = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setAvailability(prev => prev.filter(item => item.id !== id));
      toast.success('Availability removed');
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Failed to remove availability');
      throw error;
    }
  };

  return {
    availability,
    loading,
    createAvailability,
    updateAvailability,
    deleteAvailability,
    fetchAvailability,
  };
};