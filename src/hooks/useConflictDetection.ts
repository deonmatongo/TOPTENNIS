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
      const { data, error } = await supabase.rpc('check_availability_conflict', {
        p_user_id: targetUserId,
        p_date: date,
        p_start_time: startTime,
        p_end_time: endTime,
        p_exclude_id: excludeId || null,
      });

      if (error) {
        console.error('Error checking conflict:', error);
        return false;
      }

      return data || false;
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
      const { data, error } = await supabase.rpc('get_available_slots', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
      });

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
