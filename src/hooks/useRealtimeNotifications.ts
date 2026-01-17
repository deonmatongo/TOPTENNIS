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

    // Subscribe to match invite changes
    const unsubscribeInvites = subscribeToTable('match_invites', (payload) => {
      if (payload.eventType === 'INSERT') {
        const invite = payload.new;
        if (invite.receiver_id === user.id) {
          toast.info('New match invitation!', {
            description: `You have a new match invitation to respond to`,
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => window.location.href = '/dashboard?tab=matching',
            },
          });
        } else if (invite.sender_id === user.id) {
          toast.success('Match invitation sent!', {
            description: 'Your invitation has been delivered',
            duration: 3000,
          });
        }
      } else if (payload.eventType === 'UPDATE') {
        const invite = payload.new;
        if (invite.receiver_id === user.id || invite.sender_id === user.id) {
          const action = invite.status === 'accepted' ? 'accepted' : 'declined';
          const otherUser = invite.receiver_id === user.id ? invite.sender_id : invite.receiver_id;
          
          if (invite.status === 'accepted') {
            toast.success('Match invitation accepted!', {
              description: `Your match has been scheduled`,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => window.location.href = '/dashboard?tab=matches',
              },
            });
          } else if (invite.status === 'declined') {
            toast.info('Match invitation declined', {
              description: `The invitation was declined`,
              duration: 3000,
            });
          }
        }
      }
    });

    return () => {
      unsubscribeAvailability();
      unsubscribeInvites();
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
