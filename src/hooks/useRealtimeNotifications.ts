import { useEffect } from 'react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export const useRealtimeNotifications = () => {
  const { subscribeToTable, broadcastUpdate } = useRealtime();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Subscribe to availability changes for other users
    const unsubscribeAvailability = subscribeToTable('user_availability', (payload) => {
      if (payload.eventType === 'INSERT' && payload.new.user_id !== user.id) {
        toast.success('New availability slot added', {
          description: `${payload.new.start_time} - ${payload.new.end_time} on ${new Date(payload.new.date).toLocaleDateString()}`,
          duration: 3000,
        });
      } else if (payload.eventType === 'UPDATE' && payload.old.user_id !== user.id) {
        toast.info('Availability slot updated', {
          description: `${payload.new.start_time} - ${payload.new.end_time} on ${new Date(payload.new.date).toLocaleDateString()}`,
          duration: 3000,
        });
      } else if (payload.eventType === 'DELETE' && payload.old.user_id !== user.id) {
        toast.warning('Availability slot removed', {
          description: `${payload.old.start_time} - ${payload.old.end_time} on ${new Date(payload.old.date).toLocaleDateString()}`,
          duration: 3000,
        });
      }
    });

    return () => {
      unsubscribeAvailability();
    };
  }, [user, subscribeToTable]);

  const notifyAvailabilityUpdate = (availability: any, action: 'created' | 'updated' | 'deleted') => {
    broadcastUpdate('availability_change', {
      type: action,
      availability,
      userId: user?.id,
    });
  };

  const notifyInviteUpdate = (invite: any, action: 'created' | 'updated') => {
    broadcastUpdate('invite_change', {
      type: action,
      invite,
      userId: user?.id,
    });
  };

  return {
    notifyAvailabilityUpdate,
    notifyInviteUpdate,
  };
};
