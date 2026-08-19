import { useRef } from 'react';

// Monotonic per-session counter. Supabase realtime rejects attaching `.on()`
// handlers to a channel whose topic is already subscribed, so two mounts of
// the same hook (e.g. usePlayerProfile in Dashboard + a tab it renders) must
// not share a channel name. This gives every hook instance a stable, unique topic.
let counter = 0;

/**
 * Returns a channel topic that is stable for the life of this hook instance
 * but unique across all instances, preventing "cannot add postgres_changes
 * callbacks ... after subscribe()" collisions.
 */
export function useUniqueChannel(prefix: string): string {
  const ref = useRef<string | null>(null);
  if (ref.current === null) {
    counter += 1;
    ref.current = `${prefix}-${counter}`;
  }
  return ref.current;
}
