/**
 * useOnlinePresence — unified online-presence hook.
 *
 * Priority:
 *   1. Socket.io presence (when VITE_SOCKET_URL is set and connected) — lower latency
 *   2. Supabase Realtime Presence via GlobalPresenceContext (always available as fallback)
 *
 * Consumers (e.g. FriendsMessagesTab) only need to call `isOnline(userId)` —
 * they don't need to know which transport answered.
 *
 * NOTE: This hook reads from GlobalPresenceContext, which is mounted once at the
 * app root by GlobalPresenceProvider. Do NOT call useGlobalPresence() directly in
 * components — that would create a second channel that tears down when the component
 * unmounts, making users appear offline on other tabs.
 */

import { useCallback } from 'react';
import { useGlobalPresenceContext } from '@/contexts/GlobalPresenceContext';
import { useSocketPresence } from './useSocketPresence';

export const useOnlinePresence = () => {
  const supabasePresence = useGlobalPresenceContext();
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
