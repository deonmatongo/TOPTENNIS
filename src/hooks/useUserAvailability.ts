import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type UserAvailability = Tables<'user_availability'>;

export const useUserAvailability = () => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  const { subscribeToUserChanges } = useRealtime();
  const { notifyAvailabilityUpdate } = useRealtimeNotifications();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchAvailability();

    // Set up real-time subscription using context
    const unsubscribe = subscribeToUserChanges((payload) => {
      if (payload.table === 'user_availability') {
        fetchAvailability();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user, subscribeToUserChanges]);

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
    const availDate = new Date(availabilityData.date + 'T' + availabilityData.start_time);
    
    // Only check if it's clearly in the past (give 1 minute buffer for processing time)
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    if (availDate < oneMinuteAgo) {
      toast.error('Cannot create availability for past dates or times');
      throw new Error('Cannot create availability for past dates or times');
    }

    // Optimistic update - add to UI immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticData = {
      id: tempId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_blocked: false,
      ...availabilityData,
    } as UserAvailability;

    setAvailability(prev => [...prev, optimisticData].sort((a, b) => 
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

      if (error) {
        // Rollback optimistic update on error
        setAvailability(prev => prev.filter(item => item.id !== tempId));
        throw error;
      }
      
      // Replace optimistic data with real data
      setAvailability(prev => 
        prev.map(item => item.id === tempId ? data : item)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );
      
      toast.success('Availability updated');
      notifyAvailabilityUpdate(data, 'created');
      return data;
    } catch (error) {
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
      notifyAvailabilityUpdate(data, 'updated');
      return data;
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
      throw error;
    }
  };

  const deleteAvailability = async (id: string) => {
    try {
      // Get the availability data before deletion for notification
      const availabilityToDelete = availability.find(item => item.id === id);
      
      const { error } = await supabase
        .from('user_availability')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setAvailability(prev => prev.filter(item => item.id !== id));
      toast.success('Availability removed');
      
      if (availabilityToDelete) {
        notifyAvailabilityUpdate(availabilityToDelete, 'deleted');
      }
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