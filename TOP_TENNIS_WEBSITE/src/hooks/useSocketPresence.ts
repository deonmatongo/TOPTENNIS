/**
 * useSocketPresence — subscribes to Socket.io presence events from SocketContext.
 *
 * Server → Client events handled:
 *   presence:state  string[]           — full list of online user IDs (sent on connect)
 *   presence:join   { userId: string } — a user came online
 *   presence:leave  { userId: string } — a user went offline
 *
 * When Socket.io is not configured (VITE_SOCKET_URL unset), `isAvailable` is false
 * and the returned set will always be empty — callers should fall back to Supabase Presence.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/contexts/SocketContext';

export const useSocketPresence = () => {
  const { socketRef, connected, isAvailable } = useSocket();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAvailable || !connected) {
      // Clear local state when socket goes away so stale IDs don't persist
      setOnlineUserIds(new Set());
      return;
    }

    const socket = socketRef.current;
    if (!socket) return;

    const handleState = (ids: string[]) => {
      setOnlineUserIds(new Set(ids));
    };

    const handleJoin = ({ userId }: { userId: string }) => {
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    };

    const handleLeave = ({ userId }: { userId: string }) => {
      setOnlineUserIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    socket.on('presence:state', handleState);
    socket.on('presence:join',  handleJoin);
    socket.on('presence:leave', handleLeave);

    return () => {
      socket.off('presence:state', handleState);
      socket.off('presence:join',  handleJoin);
      socket.off('presence:leave', handleLeave);
    };
  }, [socketRef, connected, isAvailable]);

  const isOnline = useCallback(
    (userId: string) => onlineUserIds.has(userId),
    [onlineUserIds],
  );

  return { onlineUserIds, isOnline, isAvailable, connected };
};
