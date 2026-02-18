import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

// Custom event class for Supabase Realtime
class CustomEvent {
  type: string;
  payload: any;
  timestamp: number;

  constructor(type: string, payload: any) {
    this.type = type;
    this.payload = payload;
    this.timestamp = Date.now();
  }
}

interface RealtimeContextType {
  isConnected: boolean;
  isReconnecting: boolean;
  lastUpdate: string | null;
  subscribeToTable: (table: string, callback: (payload: any) => void) => () => void;
  subscribeToUserChanges: (callback: (payload: any) => void) => () => void;
  broadcastUpdate: (event: string, data: any) => void;
  forceRefresh: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};

interface RealtimeProviderProps {
  children: ReactNode;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Connect to Supabase Realtime
    const channel = supabase.channel('realtime-updates');

    channel
      .on('system', {}, (payload) => {
        console.log('System event:', payload);
        setIsConnected(true);
        setIsReconnecting(false);
        setLastUpdate(new Date().toISOString());
      })
      .on('broadcast', { event: 'force-refresh' }, (payload) => {
        console.log('Force refresh broadcast:', payload);
        // Handle forced refresh
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setIsReconnecting(false);
          console.log('Connected to Supabase Realtime');
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          setIsReconnecting(true);
          console.log('Disconnected from Supabase Realtime');
        }
      });

    // Set up connection monitoring with heartbeat
    const heartbeatInterval = setInterval(() => {
      if (channel.state === 'SUBSCRIBED') {
        // Send heartbeat to keep connection alive
        try {
          channel.send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: { timestamp: Date.now() }
          });
        } catch (error) {
          console.warn('Failed to send heartbeat:', error);
        }
      }
    }, 30000); // 30 seconds

    // Set up connection monitoring
    const connectionMonitor = setInterval(() => {
      const wasConnected = isConnected;
      const currentlyConnected = channel.isConnected;
      
      if (wasConnected !== currentlyConnected) {
        setIsConnected(currentlyConnected);
        setIsReconnecting(!currentlyConnected && wasConnected);
        console.log(`Connection status changed: ${wasConnected} -> ${currentlyConnected}`);
      }
    }, 5000); // Check every 5 seconds

    return () => {
      supabase.removeChannel(channel);
      clearInterval(heartbeatInterval);
      clearInterval(connectionMonitor);
    };
  };, [user]);

  const subscribeToTable = (table: string, callback: (payload: any) => void) => {
    if (!user) return () => {};
    const channelName = `${table}-changes-${user.id}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log(`Realtime update for ${table}:`, payload);
          setLastUpdate(new Date().toISOString());
          callback(payload);
        }
      )
      .subscribe();

    // Add retry logic for better reliability
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000;

    const attemptReconnect = () => {
      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Attempting to reconnect to ${channelName} (attempt ${retryCount})`);
        setTimeout(() => {
          channel
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: table,
              },
              (payload) => {
                console.log(`Realtime update for ${table} (reconnected):`, payload);
                setLastUpdate(new Date().toISOString());
                callback(payload);
                retryCount = 0; // Reset retry count on success
              }
            )
            .subscribe();
        }, retryDelay);
      }
    };

    // Monitor connection and attempt reconnection if needed
    const monitorConnection = () => {
      if (!channel.isConnected && !isReconnecting) {
        console.log(`Connection to ${channelName} lost, attempting reconnection...`);
        setIsReconnecting(true);
        attemptReconnect();
      }
    };

    const connectionMonitor = setInterval(() => {
      monitorConnection();
    }, 10000); // Check every 10 seconds

    return () => {
      supabase.removeChannel(channel);
      clearInterval(connectionMonitor);
    };
  };

  const subscribeToUserChanges = (callback: (payload: any) => void) => {
    if (!user) return () => {};

    const channel = supabase.channel(`user-${user.id}-changes`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_availability',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('User availability update:', payload);
          setLastUpdate(new Date().toISOString());
          callback(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_invites',
          filter: `sender_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('User sent invite update:', payload);
          setLastUpdate(new Date().toISOString());
          callback(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_invites',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('User received invite update:', payload);
          setLastUpdate(new Date().toISOString());
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const broadcastUpdate = (event: string, data: any) => {
    if (!user) return;

    supabase.channel('global-updates').send({
      type: 'broadcast',
      event: event,
      payload: {
        ...data,
        userId: user.id,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const value: RealtimeContextType = {
    isConnected,
    isReconnecting,
    lastUpdate,
    subscribeToTable,
    subscribeToUserChanges,
    broadcastUpdate,
    forceRefresh: () => {
      try {
        const channel = supabase.channel('realtime-updates');
        channel.send({
          type: 'broadcast',
          event: 'force-refresh',
          payload: { timestamp: Date.now() }
        });
      } catch (error) {
        console.warn('Failed to send force refresh:', error);
      }
    }
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};
