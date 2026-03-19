import { useEffect, useCallback, useRef } from 'react';
import { useRealtime } from '@/contexts/RealtimeContext';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useBrowserNotifications } from './useBrowserNotifications';
import { playNotificationSound } from '@/utils/notificationSound';

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

interface NotificationEvent {
  type: NotificationEventType;
  data: any;
  userId: string;
  timestamp: number;
}

export const useRealtimeNotifications = () => {
  const { subscribeToTable, subscribeToUserChanges, broadcastUpdate, isConnected } = useRealtime();
  const { user } = useAuth();
  const { sendNotification, isSupported, permission } = useBrowserNotifications();
  
  // Track processed events to prevent duplicates
  const processedEvents = useRef<Set<string>>(new Set());
  
  // Generate unique event ID for deduplication
  const getEventId = useCallback((type: NotificationEventType, data: any) => {
    return `${type}-${data.id || data.match_id || data.request_id || data.message_id}-${data.user_id || user?.id}`;
  }, [user?.id]);
  
  // Process incoming real-time notification event
  const processNotificationEvent = useCallback((event: NotificationEvent) => {
    const eventId = getEventId(event.type, event.data);
    
    // Skip if already processed
    if (processedEvents.current.has(eventId)) {
      console.log('🔄 Skipping duplicate notification event:', eventId);
      return;
    }
    
    processedEvents.current.add(eventId);
    
    // Clean up old event IDs (keep last 1000)
    if (processedEvents.current.size > 1000) {
      const oldIds = Array.from(processedEvents.current).slice(0, 500);
      oldIds.forEach(id => processedEvents.current.delete(id));
    }
    
    console.log('🔔 Processing real-time notification event:', event);
    
    // Handle different event types with appropriate UI feedback
    switch (event.type) {
      case 'match_invite_sent':
        if (event.data.receiver_id === user?.id) {
          toast.info('New match invitation received!', {
            description: `From ${event.data.sender_name || 'Someone'}`,
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => window.location.href = '/dashboard?tab=schedule',
            },
          });
          
          // Play notification sound
          playNotificationSound(0.5).catch(err => 
            console.warn('Failed to play notification sound:', err)
          );
          
          // Send browser notification if permitted
          if (isSupported && permission === 'granted') {
            sendNotification('New Match Invitation', {
              body: `From ${event.data.sender_name || 'Someone'}`,
              tag: eventId,
              clickUrl: '/dashboard?tab=schedule',
            });
          }
        }
        break;
        
      case 'match_invite_accepted':
        if (event.data.sender_id === user?.id) {
          toast.success('Match invitation accepted!', {
            description: `${event.data.accepter_name || 'Your opponent'} accepted your match`,
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => window.location.href = '/dashboard?tab=schedule',
            },
          });
          
          playNotificationSound(0.3).catch(err => 
            console.warn('Failed to play notification sound:', err)
          );
          
          if (isSupported && permission === 'granted') {
            sendNotification('Match Accepted', {
              body: `${event.data.accepter_name || 'Your opponent'} accepted your match`,
              tag: eventId,
              clickUrl: '/dashboard?tab=schedule',
            });
          }
        }
        break;
        
      case 'match_invite_declined':
        if (event.data.sender_id === user?.id) {
          toast.info('Match invitation declined', {
            description: `${event.data.decliner_name || 'Your opponent'} declined the match`,
            duration: 5000,
          });
          
          if (isSupported && permission === 'granted') {
            sendNotification('Match Declined', {
              body: `${event.data.decliner_name || 'Your opponent'} declined the match`,
              tag: eventId,
              clickUrl: '/dashboard?tab=schedule',
            });
          }
        }
        break;
        
      case 'friend_request_sent':
        if (event.data.receiver_id === user?.id) {
          toast.info('New friend request!', {
            description: `From ${event.data.sender_name || 'Someone'}`,
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => window.location.href = '/dashboard?tab=social',
            },
          });
          
          playNotificationSound(0.4).catch(err => 
            console.warn('Failed to play notification sound:', err)
          );
          
          if (isSupported && permission === 'granted') {
            sendNotification('New Friend Request', {
              body: `From ${event.data.sender_name || 'Someone'}`,
              tag: eventId,
              clickUrl: '/dashboard?tab=social',
            });
          }
        }
        break;
        
      case 'friend_request_accepted':
        if (event.data.sender_id === user?.id) {
          toast.success('Friend request accepted!', {
            description: `${event.data.accepter_name || 'Someone'} accepted your request`,
            duration: 5000,
          });
          
          playNotificationSound(0.3).catch(err => 
            console.warn('Failed to play notification sound:', err)
          );
          
          if (isSupported && permission === 'granted') {
            sendNotification('Friend Request Accepted', {
              body: `${event.data.accepter_name || 'Someone'} accepted your request`,
              tag: eventId,
              clickUrl: '/dashboard?tab=social',
            });
          }
        }
        break;
        
      case 'message_received':
        if (event.data.receiver_id === user?.id) {
          // Only show toast for messages from non-current conversations
          toast.info('New message received', {
            description: `From ${event.data.sender_name || 'Someone'}`,
            duration: 3000,
          });
          
          playNotificationSound(0.2).catch(err => 
            console.warn('Failed to play notification sound:', err)
          );
          
          if (isSupported && permission === 'granted') {
            sendNotification('New Message', {
              body: `From ${event.data.sender_name || 'Someone'}`,
              tag: eventId,
              clickUrl: '/dashboard?tab=messages',
            });
          }
        }
        break;
        
      case 'group_invite_sent':
        if (event.data.receiver_id === user?.id) {
          toast.info('Group invitation received!', {
            description: `Join ${event.data.group_name || 'a group'}`,
            duration: 5000,
            action: {
              label: 'View',
              onClick: () => window.location.href = '/dashboard?tab=messages',
            },
          });
          
          playNotificationSound(0.4).catch(err => 
            console.warn('Failed to play notification sound:', err)
          );
          
          if (isSupported && permission === 'granted') {
            sendNotification('Group Invitation', {
              body: `Join ${event.data.group_name || 'a group'}`,
              tag: eventId,
              clickUrl: '/dashboard?tab=messages',
            });
          }
        }
        break;
        
      case 'availability_updated':
        // Only show availability updates for other users
        if (event.data.user_id !== user?.id) {
          toast.info('Availability updated', {
            description: `${event.data.user_name || 'Someone'} updated their availability`,
            duration: 3000,
          });
        }
        break;
    }
  }, [user?.id, getEventId, isSupported, permission, sendNotification]);

  // Set up real-time subscriptions for all notification-critical tables
  useEffect(() => {
    if (!user || !isConnected) return;

    console.log('🔔 Setting up real-time notification subscriptions for user:', user.id);

    // Subscribe to match invites (both sent and received)
    const unsubscribeInvitesSent = subscribeToTable('match_invites', (payload) => {
      if (payload.eventType === 'INSERT' && payload.new.sender_id === user.id) {
        processNotificationEvent({
          type: 'match_invite_sent',
          data: payload.new,
          userId: user.id,
          timestamp: Date.now(),
        });
      }
    });

    const unsubscribeInvitesReceived = subscribeToUserChanges((payload) => {
      if (payload.table === 'match_invites') {
        if (payload.eventType === 'INSERT' && payload.new.receiver_id === user.id) {
          processNotificationEvent({
            type: 'match_invite_sent',
            data: { ...payload.new, receiver_id: user.id },
            userId: user.id,
            timestamp: Date.now(),
          });
        } else if (payload.eventType === 'UPDATE') {
          const status = payload.new.status;
          if (status === 'accepted') {
            processNotificationEvent({
              type: 'match_invite_accepted',
              data: payload.new,
              userId: user.id,
              timestamp: Date.now(),
            });
          } else if (status === 'declined') {
            processNotificationEvent({
              type: 'match_invite_declined',
              data: payload.new,
              userId: user.id,
              timestamp: Date.now(),
            });
          }
        }
      }
    });

    // Subscribe to friend requests
    const unsubscribeFriendRequests = subscribeToTable('friend_requests', (payload) => {
      if (payload.eventType === 'INSERT') {
        if (payload.new.receiver_id === user.id) {
          processNotificationEvent({
            type: 'friend_request_sent',
            data: payload.new,
            userId: user.id,
            timestamp: Date.now(),
          });
        } else if (payload.new.sender_id === user.id) {
          // This will be handled by the UPDATE event below
        }
      } else if (payload.eventType === 'UPDATE' && payload.new.status === 'accepted') {
        if (payload.new.sender_id === user.id) {
          processNotificationEvent({
            type: 'friend_request_accepted',
            data: payload.new,
            userId: user.id,
            timestamp: Date.now(),
          });
        }
      }
    });

    // Subscribe to messages
    const unsubscribeMessages = subscribeToTable('conversation_messages', (payload) => {
      if (payload.eventType === 'INSERT' && payload.new.receiver_id === user.id) {
        processNotificationEvent({
          type: 'message_received',
          data: payload.new,
          userId: user.id,
          timestamp: Date.now(),
        });
      }
    });

    // Subscribe to availability changes
    const unsubscribeAvailability = subscribeToTable('user_availability', (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        if (payload.new.user_id !== user.id) {
          processNotificationEvent({
            type: 'availability_updated',
            data: payload.new,
            userId: user.id,
            timestamp: Date.now(),
          });
        }
      }
    });

    return () => {
      console.log('🔔 Cleaning up real-time notification subscriptions');
      unsubscribeInvitesSent();
      unsubscribeInvitesReceived();
      unsubscribeFriendRequests();
      unsubscribeMessages();
      unsubscribeAvailability();
    };
  }, [user, isConnected, subscribeToTable, subscribeToUserChanges, processNotificationEvent]);

  // Broadcast notification events
  const broadcastNotificationEvent = useCallback((type: NotificationEventType, data: any) => {
    if (!user) return;
    
    broadcastUpdate('notification_event', {
      type,
      data,
      userId: user.id,
      timestamp: Date.now(),
    });
  }, [user, broadcastUpdate]);

  return {
    // Event broadcasting
    broadcastNotificationEvent,
    
    // Legacy methods for backward compatibility
    notifyAvailabilityUpdate: (availability: any, action: 'created' | 'updated' | 'deleted') => {
      broadcastNotificationEvent('availability_updated', { ...availability, action });
    },
    
    notifyInviteUpdate: (invite: any, action: 'created' | 'updated') => {
      const type = action === 'created' ? 'match_invite_sent' : 
                  invite.status === 'accepted' ? 'match_invite_accepted' : 
                  invite.status === 'declined' ? 'match_invite_declined' : 'match_invite_sent';
      broadcastNotificationEvent(type, invite);
    },
  };
};
