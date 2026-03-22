import { useCallback } from 'react';
import { useGlobalPresence } from './useGlobalPresence';
import { useSocketPresence } from './useSocketPresence';

/**
 * Unified online-presence hook.
 *
 * Priority:
 *   1. Socket.io presence (when VITE_SOCKET_URL is set and connected) — lower latency
 *   2. Supabase Realtime Presence (always available as fallback)
 *
 * Consumers (e.g. FriendsMessagesTab) only need to call `isOnline(userId)` —
 * they don't need to know which transport answered.
 */
export const useOnlinePresence = () => {
  const supabasePresence = useGlobalPresence();
  const socketPresence   = useSocketPresence();

  const isOnline = useCallback(
    (userId: string): boolean => {
      if (socketPresence.isAvailable && socketPresence.connected) {
        // Socket.io is the primary source when connected; Supabase is the safety net
        return socketPresence.isOnline(userId) || supabasePresence.isOnline(userId);
      }
      return supabasePresence.isOnline(userId);
    },
    [socketPresence, supabasePresence],
  );

  return {
    onlineUserIds:       supabasePresence.onlineUserIds,
    stableOnlineUserIds: supabasePresence.stableOnlineUserIds,
    isOnline,
  };
};
