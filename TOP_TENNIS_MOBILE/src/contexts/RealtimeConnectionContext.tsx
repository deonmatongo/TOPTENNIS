import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';

interface RealtimeConnectionContextValue {
  /**
   * Increments every time the app returns to foreground after the socket was
   * disconnected. Hooks should include this in their useEffect dependency array
   * so they resubscribe and catch-up-fetch automatically after a reconnect.
   */
  connectionGeneration: number;
}

const RealtimeConnectionContext = createContext<RealtimeConnectionContextValue>({
  connectionGeneration: 0,
});

export function RealtimeConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connectionGeneration, setConnectionGeneration] = useState(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Keep the Supabase Realtime token in sync with the auth session.
  // The realtime socket authenticates independently from REST calls — a
  // refreshed access token is NOT automatically forwarded to the socket,
  // so postgres_changes subscriptions silently stop working after expiry.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      try {
        supabase.realtime.setAuth(session?.access_token ?? null);
      } catch {
        // Realtime may not have connected yet on first mount — safe to ignore
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Disconnect the WebSocket when the app is backgrounded so the OS doesn't
  // silently kill a stale connection after ~30 s, then reconnect and bump the
  // generation counter when the user returns so every subscribed hook
  // resubscribes and runs its catch-up fetch.
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;

      if (prev === 'active' && nextState.match(/inactive|background/)) {
        try { supabase.realtime.disconnect(); } catch { /* ignore */ }
      }

      if (prev.match(/inactive|background/) && nextState === 'active') {
        try { supabase.realtime.connect(); } catch { /* ignore */ }
        setConnectionGeneration(g => g + 1);
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);

  return (
    <RealtimeConnectionContext.Provider value={{ connectionGeneration }}>
      {children}
    </RealtimeConnectionContext.Provider>
  );
}

export function useRealtimeConnection() {
  return useContext(RealtimeConnectionContext);
}
