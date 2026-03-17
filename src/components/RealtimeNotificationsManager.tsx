import React from 'react';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

/**
 * RealtimeNotificationsManager
 * 
 * This component sets up and manages all real-time notification subscriptions.
 * It's mounted at the app root level to ensure notifications work regardless
 * of which screen the user is on.
 * 
 * Features:
 * - Industry-standard real-time delivery (like WhatsApp, Instagram, Uber)
 * - Instant toast notifications with actions
 * - Browser push notifications with click-to-navigate
 * - Audio notifications with different tones per event type
 * - Deduplication to prevent duplicate notifications
 * - Automatic reconnection with exponential backoff
 * - Background/foreground handling
 */
export const RealtimeNotificationsManager: React.FC = () => {
  // The hook handles all the real-time subscription logic
  useRealtimeNotifications();

  // This component doesn't render anything - it's just for managing subscriptions
  return null;
};

export default RealtimeNotificationsManager;
