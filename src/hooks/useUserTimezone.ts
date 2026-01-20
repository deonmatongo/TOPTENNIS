import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook to manage user's timezone preference
 * Stores timezone in localStorage and syncs with user profile
 */
export const useUserTimezone = () => {
  const { user } = useAuth();
  const [timezone, setTimezone] = useState<string>(() => {
    // Try to get from localStorage first
    const stored = localStorage.getItem('userTimezone');
    if (stored) return stored;
    
    // Try to detect user's timezone
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Map to supported US timezones
      const timezoneMap: Record<string, string> = {
        'America/New_York': 'America/New_York',
        'US/Eastern': 'America/New_York',
        'America/Chicago': 'America/Chicago',
        'US/Central': 'America/Chicago',
        'America/Denver': 'America/Denver',
        'US/Mountain': 'America/Denver',
        'America/Los_Angeles': 'America/Los_Angeles',
        'US/Pacific': 'America/Los_Angeles',
        'America/Anchorage': 'America/Anchorage',
        'US/Alaska': 'America/Anchorage',
        'Pacific/Honolulu': 'Pacific/Honolulu',
        'US/Hawaii': 'Pacific/Honolulu',
      };
      return timezoneMap[detected] || 'America/New_York';
    } catch {
      return 'America/New_York'; // Default to Eastern Time
    }
  });

  const [loading, setLoading] = useState(false);

  // Load timezone preference from user profile on mount
  useEffect(() => {
    if (!user) return;

    const loadTimezonePreference = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('preferred_timezone')
          .eq('id', user.id)
          .single();

        // Only update if column exists and has a value
        if (!error && data?.preferred_timezone) {
          setTimezone(data.preferred_timezone);
          localStorage.setItem('userTimezone', data.preferred_timezone);
        }
        // Silently ignore error if column doesn't exist yet
      } catch (error) {
        // Silently ignore - column may not exist yet
        console.debug('Timezone preference not available in database yet');
      }
    };

    loadTimezonePreference();
  }, [user]);

  // Update timezone preference
  const updateTimezone = useCallback(async (newTimezone: string) => {
    setTimezone(newTimezone);
    localStorage.setItem('userTimezone', newTimezone);

    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_timezone: newTimezone })
        .eq('id', user.id);

      // Only show error if it's not a column-doesn't-exist error
      if (error) {
        if (error.message?.includes('column') || error.message?.includes('preferred_timezone')) {
          // Column doesn't exist yet - silently use localStorage only
          console.debug('Timezone saved to localStorage (database column not yet created)');
          toast.success('Timezone updated');
        } else {
          throw error;
        }
      } else {
        toast.success('Timezone preference saved');
      }
    } catch (error) {
      console.error('Error updating timezone preference:', error);
      toast.error('Failed to save timezone preference');
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    timezone,
    updateTimezone,
    loading,
  };
};
