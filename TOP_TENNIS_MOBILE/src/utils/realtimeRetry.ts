import { supabase } from '@/services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS  = 30_000;

/**
 * Subscribes a Supabase Realtime channel with automatic exponential-backoff
 * retry on CHANNEL_ERROR, TIMED_OUT, or CLOSED.
 *
 * Usage:
 *   const cleanup = subscribeWithRetry(() =>
 *     supabase.channel('my-topic').on('postgres_changes', {...}, handler)
 *   );
 *   // later:
 *   cleanup();
 *
 * The factory is called again on each retry with a fresh channel instance so
 * there is no risk of attaching .on() handlers to an already-subscribed channel.
 */
export function subscribeWithRetry(
  factory: () => RealtimeChannel,
  label = 'channel',
): () => void {
  let channel: RealtimeChannel | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;
  let stopped = false;

  const subscribe = () => {
    if (stopped) return;
    channel = factory();
    channel.subscribe((status) => {
      if (__DEV__) console.log(`[realtime:${label}] status`, status);

      if (status === 'SUBSCRIBED') {
        attempts = 0;
        return;
      }

      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !stopped) {
        if (channel) supabase.removeChannel(channel);
        channel = null;
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempts, MAX_DELAY_MS);
        attempts++;
        if (__DEV__) console.log(`[realtime:${label}] retry in ${delay}ms (attempt ${attempts})`);
        timer = setTimeout(subscribe, delay);
      }
    });
  };

  subscribe();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (channel) supabase.removeChannel(channel);
  };
}
