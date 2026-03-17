import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

// Exponential backoff utility
const getBackoffDelay = (attempt: number, baseDelay = 1000, maxDelay = 30000) => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};

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
  
  // Refs for persistent connection management
  const channelRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionMonitorRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced reconnection logic with exponential backoff
  const attemptReconnection = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Stopping reconnection attempts.');
      setIsReconnecting(false);
      return;
    }

    const attempt = reconnectAttemptsRef.current;
    const delay = getBackoffDelay(attempt);
    
    console.log(`🔄 Attempting reconnection ${attempt + 1}/${maxReconnectAttempts} in ${Math.round(delay)}ms`);
    setIsReconnecting(true);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      
      // Clean up existing channel
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.warn('Error removing channel during reconnection:', error);
        }
      }
      
      // Create new channel
      const newChannel = supabase.channel('realtime-updates');
      channelRef.current = newChannel;
      
      newChannel
        .on('system', {}, (payload) => {
          console.log('System event:', payload);
          setIsConnected(true);
          setIsReconnecting(false);
          setLastUpdate(new Date().toISOString());
          reconnectAttemptsRef.current = 0; // Reset on successful connection
        })
        .on('broadcast', { event: 'force-refresh' }, (payload) => {
          console.log('Force refresh broadcast:', payload);
          // Handle forced refresh
        })
        .subscribe((status) => {
          console.log('📡 Channel status:', status);
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setIsReconnecting(false);
            reconnectAttemptsRef.current = 0;
            console.log('✅ Reconnected to Supabase Realtime');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            // Trigger next reconnection attempt
            setTimeout(() => attemptReconnection(), 1000);
          }
        });
    }, delay);
  }, []);

  // Setup connection monitoring
  const setupConnectionMonitoring = useCallback(() => {
    // Clear existing monitors
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (connectionMonitorRef.current) clearInterval(connectionMonitorRef.current);
    
    // Heartbeat to keep connection alive
    heartbeatIntervalRef.current = setInterval(() => {
      if (channelRef.current && (channelRef.current.state as string) === 'joined') {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: { timestamp: Date.now() }
          });
        } catch (error) {
          console.warn('Failed to send heartbeat:', error);
        }
      }
    }, 30000); // 30 seconds

    // Monitor connection status
    connectionMonitorRef.current = setInterval(() => {
      if (channelRef.current) {
        const currentlyConnected = (channelRef.current.state as string) === 'joined';
        setIsConnected(prev => {
          if (prev !== currentlyConnected) {
            setIsReconnecting(!currentlyConnected);
            console.log(`🔌 Connection status changed: ${prev} -> ${currentlyConnected}`);
            
            // If disconnected and not already reconnecting, start reconnection
            if (!currentlyConnected && !isReconnecting && reconnectAttemptsRef.current === 0) {
              attemptReconnection();
            }
          }
          return currentlyConnected;
        });
      }
    }, 5000); // Check every 5 seconds
  }, [isReconnecting, attemptReconnection]);

  useEffect(() => {
    if (!user) {
      // Clean up everything when user logs out
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (connectionMonitorRef.current) clearInterval(connectionMonitorRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
      return;
    }

    // Initial connection
    const channel = supabase.channel('realtime-updates');
    channelRef.current = channel;

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
        console.log('📡 Initial channel status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setIsReconnecting(false);
          console.log('✅ Connected to Supabase Realtime');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          console.log('❌ Initial connection failed, will retry...');
          attemptReconnection();
        }
      });

    // Setup monitoring
    setupConnectionMonitoring();

    return () => {
      // Comprehensive cleanup
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (connectionMonitorRef.current) clearInterval(connectionMonitorRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
    };
  }, [user, setupConnectionMonitoring, attemptReconnection]);

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
      if ((channel.state as string) !== 'joined' && isReconnecting) {
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
