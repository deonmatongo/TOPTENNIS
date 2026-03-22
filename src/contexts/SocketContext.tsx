/**
 * SocketContext — singleton Socket.io connection for the whole app.
 *
 * One connection per user session. All hooks that need real-time Socket.io
 * events (presence, notification badge) consume this context instead of
 * each creating their own connection.
 *
 * Socket.io server URL is read from VITE_SOCKET_URL.
 * When the env var is not set the context still mounts but `isAvailable`
 * is false and all hooks fall back to Supabase Realtime.
 *
 * Protocol expected from the server:
 *
 * Client → Server
 *   presence:join   { userId }   — announce this user is online
 *   presence:leave  { userId }   — announce this user is offline
 *
 * Server → Client (broadcast to all connected clients)
 *   presence:state  string[]            — full list of online user IDs (on connect)
 *   presence:join   { userId: string }  — a user just came online
 *   presence:leave  { userId: string }  — a user just went offline
 *
 * Server → Client (targeted to recipient only)
 *   notification:new { id, title, message, type, actionUrl? }
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL as string | undefined;

// ── Context shape ─────────────────────────────────────────────────────────────

interface SocketContextValue {
  /** Direct access to the Socket.io instance — use for emitting events. */
  socketRef: React.MutableRefObject<Socket | null>;
  /** True when the socket is currently connected. */
  connected: boolean;
  /** True when VITE_SOCKET_URL is set. False → all hooks use Supabase fallback. */
  isAvailable: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socketRef:   { current: null },
  connected:   false,
  isAvailable: false,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!SOCKET_URL || !user) return;

    const socket = io(SOCKET_URL, {
      transports:             ['websocket'],
      auth:                   { userId: user.id },
      reconnection:           true,
      reconnectionDelay:      1_000,
      reconnectionDelayMax:   10_000,
      reconnectionAttempts:   Infinity,
      timeout:                10_000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Announce presence to the server so other users see us online
      socket.emit('presence:join', { userId: user.id });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error:', err.message);
    });

    return () => {
      // Announce departure before disconnecting
      if (socket.connected) {
        socket.emit('presence:leave', { userId: user.id });
      }
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socketRef, connected, isAvailable: !!SOCKET_URL }}>
      {children}
    </SocketContext.Provider>
  );
};

// ── Consumer hook ─────────────────────────────────────────────────────────────

export const useSocket = () => useContext(SocketContext);
