import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const hasErrorRef = useRef(false);

  const { subscribeToUserChanges } = useRealtime();
  const { notifyAvailabilityUpdate } = useRealtimeNotifications();

  // Define fetchAvailability before useEffect to avoid 'used before declaration' error
  const fetchAvailability = useCallback(async () => {
    // Step 1: Authentication verification
    console.log('Step 1: Fetch triggered for userId:', user?.id);
    console.log('Step 2: Auth token present:', !!user);
    
    // Strict auth guard
    if (!user?.id) {
      console.warn('Availability fetch blocked — auth not ready');
      setLoading(false);
      return;
    }

    // Prevent fetching if already in error state
    if (hasErrorRef.current) {
      console.warn('Availability fetch blocked — error state active');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Step 3: Query params:', { userId: user.id, excludeBooked: true });
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', user.id)
        .neq('booking_status', 'booked')  // Exclude booked slots
        .order('date', { ascending: true });

      console.log('Step 4: Raw response:', { data, error });

      if (error) {
        console.error('Step 5: Database error:', error);
        throw error;
      }

      console.log('Step 5: Parsed data:', data);
      
      // Step 6: Data shape validation
      if (!data) {
        console.warn('Availability data is null');
        setAvailability([]);
        return;
      }

      if (!Array.isArray(data)) {
        console.warn('Availability data is not an array:', data);
        setAvailability([]);
        return;
      }

      console.log('✅ Availability fetched successfully:', data.length, 'slots');
      setAvailability(data);
      
      // Reset error state on success
      hasErrorRef.current = false;
      setError(null);
      
    } catch (error) {
      console.error('❌ Error fetching availability:', error);
      
      // Set error state to prevent automatic retries
      hasErrorRef.current = true;
      setError('Failed to load availability');
      
      // Show user-friendly error with retry option
      toast.error('Failed to load availability', {
        action: {
          label: 'Retry',
          onClick: () => {
            console.log('Manual retry triggered by user');
            hasErrorRef.current = false;
            setError(null);
            fetchAvailability();
          },
        },
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // Only depend on user ID, not the entire user object

  // Use refs to prevent dependency changes from triggering re-renders
  const subscribeToUserChangesRef = useRef(subscribeToUserChanges);
  
  // Update refs when functions change
  useEffect(() => {
    subscribeToUserChangesRef.current = subscribeToUserChanges;
  }, [subscribeToUserChanges]);

  useEffect(() => {
    console.log('useUserAvailability useEffect triggered');
    
    if (!user?.id) {
      console.log('User not available, setting loading to false');
      setLoading(false);
      setError(null);
      return;
    }

    // Only fetch if not in error state
    if (!hasErrorRef.current) {
      fetchAvailability();
    } else {
      setLoading(false);
    }

    // Set up real-time subscription using context
    const unsubscribe = subscribeToUserChangesRef.current((payload) => {
      console.log('🔄 Real-time availability update received:', payload);
      if (payload.table === 'user_availability') {
        // Check if booking_status changed to 'booked' - if so, remove from availability immediately
        if (payload.eventType === 'UPDATE' && payload.new.booking_status === 'booked') {
          console.log('🔒 Slot booked - removing from availability:', payload.new.id);
          setAvailability(prev => prev.filter(slot => slot.id !== payload.new.id));
        } else {
          console.log('✅ Real-time update - checking if refetch needed');
          // Only refetch if not in error state and it's a meaningful change
          if (!hasErrorRef.current && 
              (payload.eventType === 'INSERT' || 
               payload.eventType === 'DELETE' ||
               (payload.eventType === 'UPDATE' && payload.new.booking_status !== 'booked'))) {
            // Debounce the refetch to prevent rapid successive calls
            setTimeout(() => {
              if (!hasErrorRef.current) {
                console.log('✅ Refetching availability due to real-time update');
                fetchAvailability();
              }
            }, 500);
          }
        }
      }
    });

    return () => {
      console.log('Cleaning up availability subscription');
      unsubscribe();
    };
  }, [user?.id]); // Only depend on user ID, not on functions that might change

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

    console.log('⚡ Optimistic update: Adding availability to UI immediately');
    setAvailability(prev => [...prev, optimisticData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ));

    try {
      const { data, error } = await supabase
        .from('user_availability')
        .insert({
          user_id: user.id,
          ...availabilityData,
          booking_status: 'available',  // Set default booking status
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database insert failed, rolling back optimistic update');
        // Rollback optimistic update on error
        setAvailability(prev => prev.filter(item => item.id !== tempId));
        throw error;
      }
      
      console.log('✅ Database insert successful, replacing optimistic data with real data');
      // Replace optimistic data with real data
      setAvailability(prev => 
        prev.map(item => item.id === tempId ? data : item)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      );
      
      toast.success('Availability updated');
      notifyAvailabilityUpdate(data, 'created');
      
      // Force a refetch to ensure we have the latest data (only if not in error state)
      if (!hasErrorRef.current) {
        console.log('🔄 Forcing refetch to sync with database');
        await fetchAvailability();
      } else {
        console.log('Skipping refetch due to error state');
      }
      
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
    error,
    createAvailability,
    updateAvailability,
    deleteAvailability,
    fetchAvailability,
  };
};