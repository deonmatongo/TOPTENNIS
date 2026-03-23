import { useCallback } from 'react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { useAuth } from '@/contexts/AuthContext';

// Real-time notification event types
type NotificationEventType =
  | 'match_invite_sent'
  | 'match_invite_accepted'
  | 'match_invite_declined'
  | 'match_rescheduled'
  | 'match_cancelled'
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'friend_request_declined'
  | 'message_received'
  | 'group_invite_sent'
  | 'availability_updated';

/**
 * useRealtimeNotifications
 *
 * Exposes broadcasting utilities for sending real-time events to other
 * connected clients via Supabase Broadcast.
 *
 * NOTE: All user-facing toasts and sounds are handled by useNotifications,
 * which listens to the `notifications` DB table.  This hook no longer
 * duplicates that work by subscribing to individual tables.
 */
export const useRealtimeNotifications = () => {
  const { broadcastUpdate } = useRealtime();
  const { user } = useAuth();

  const broadcastNotificationEvent = useCallback(
    (type: NotificationEventType, data: any) => {
      if (!user) return;
      broadcastUpdate('notification_event', {
        type,
        data,
        userId: user.id,
        timestamp: Date.now(),
      });
    },
    [user, broadcastUpdate],
  );

  return {
    broadcastNotificationEvent,

    // Legacy helpers kept for backward compatibility
    notifyAvailabilityUpdate: (
      availability: any,
      action: 'created' | 'updated' | 'deleted',
    ) => {
      broadcastNotificationEvent('availability_updated', { ...availability, action });
    },

    notifyInviteUpdate: (invite: any, action: 'created' | 'updated') => {
      const type: NotificationEventType =
        action === 'created'
          ? 'match_invite_sent'
          : invite.status === 'accepted'
          ? 'match_invite_accepted'
          : invite.status === 'declined'
          ? 'match_invite_declined'
          : 'match_invite_sent';
      broadcastNotificationEvent(type, invite);
    },
  };
};
