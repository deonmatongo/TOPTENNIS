import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ConflictCheckParams {
  userId?: string;
  date: string;
  startTime: string;
  endTime: string;
  excludeId?: string;
}

export const useConflictDetection = () => {
  const { user } = useAuth();

  const checkConflict = async ({
    userId,
    date,
    startTime,
    endTime,
    excludeId,
  }: ConflictCheckParams): Promise<boolean> => {
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) return false;

    try {
      // Check for overlapping availability slots only (no match_bookings table)
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('date', date)
        .eq('is_available', true)
        .eq('is_blocked', false)
        .neq('id', excludeId || '')
        .or(`(start_time.lte.${startTime} AND end_time.gt.${startTime}), (start_time.lt.${endTime} AND end_time.gte.${endTime}), (start_time.gte.${startTime} AND end_time.lte.${endTime})`);

      if (error) {
        console.error('Error checking conflict:', error);
        return false;
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      console.error('Error checking conflict:', error);
      return false;
    }
  };

  const getAvailableSlots = async (
    userId: string,
    startDate: string,
    endDate: string
  ) => {
    try {
      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('is_available', true)
        .eq('is_blocked', false)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error getting available slots:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting available slots:', error);
      return [];
    }
  };

  return {
    checkConflict,
    getAvailableSlots,
  };
};
