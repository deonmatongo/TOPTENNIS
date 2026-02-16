import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const storageKeyForUser = (userId: string) => `schedule_last_seen_match_requests_at:${userId}`;

const readLastSeen = (userId: string) => {
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return null;
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return null;
    return ts;
  } catch {
    return null;
  }
};

const writeLastSeen = (userId: string, ts: number) => {
  try {
    localStorage.setItem(storageKeyForUser(userId), new Date(ts).toISOString());
  } catch {
    // ignore
  }
};

export const useUnseenMatchRequestsCount = () => {
  const { user } = useAuth();
  const [unseenCount, setUnseenCount] = useState(0);
  const lastSeenRef = useRef<number | null>(null);

  const userId = user?.id ?? null;

  const ensureLastSeenLoaded = useCallback(() => {
    if (!userId) return;
    if (lastSeenRef.current !== null) return;
    lastSeenRef.current = readLastSeen(userId);
  }, [userId]);

  const fetchUnseenCount = useCallback(async () => {
    if (!userId) {
      setUnseenCount(0);
      return;
    }

    ensureLastSeenLoaded();

    const lastSeen = lastSeenRef.current;

    let query = supabase
      .from('match_invites')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    if (lastSeen) {
      query = query.gt('created_at', new Date(lastSeen).toISOString());
    }

    const { count, error } = await query;

    if (!error && count !== null) {
      setUnseenCount(count);
    }
  }, [ensureLastSeenLoaded, userId]);

  const markSeenNow = useCallback(() => {
    if (!userId) return;

    const now = Date.now();
    lastSeenRef.current = now;
    writeLastSeen(userId, now);

    // Optimistic: clear immediately when opening My Schedule
    setUnseenCount(0);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnseenCount(0);
      lastSeenRef.current = null;
      return;
    }

    // Initial load
    fetchUnseenCount();

    // Fallback polling (in case Supabase Realtime isn't enabled / events are blocked)
    const pollId = window.setInterval(() => {
      fetchUnseenCount();
    }, 15000);

    // Realtime updates
    const channel = supabase
      .channel(`schedule-unseen-match-requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_invites',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          fetchUnseenCount();
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [fetchUnseenCount, userId]);

  return useMemo(
    () => ({
      unseenCount,
      markSeenNow,
      refetch: fetchUnseenCount,
    }),
    [fetchUnseenCount, markSeenNow, unseenCount]
  );
};
