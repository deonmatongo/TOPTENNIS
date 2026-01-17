import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface RealtimeContextType {
  isConnected: boolean;
  lastUpdate: string | null;
  subscribeToTable: (table: string, callback: (payload: any) => void) => () => void;
  subscribeToUserChanges: (callback: (payload: any) => void) => () => void;
  broadcastUpdate: (event: string, data: any) => void;
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
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log('Connected to Supabase Realtime');
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          console.log('Disconnected from Supabase Realtime');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

    return () => {
      supabase.removeChannel(channel);
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
    lastUpdate,
    subscribeToTable,
    subscribeToUserChanges,
    broadcastUpdate,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};
