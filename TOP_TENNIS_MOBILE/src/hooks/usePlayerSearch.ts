import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockedUsers } from './useBlockedUsers';

export interface PlayerSearchResult {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  skill_level?: number;
  wins?: number;
  losses?: number;
  usta_rating?: string;
  competitiveness?: string;
  age_range?: string;
  city?: string;
  gender?: string;
  profile_picture_url?: string | null;
  first_name?: string;
  last_name?: string;
}

export const usePlayerSearch = () => {
  const { user } = useAuth();
  const { blockedUsers } = useBlockedUsers();
  const [allPlayers, setAllPlayers] = useState<PlayerSearchResult[]>([]);
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all eligible players once (with profile join + block filtering)
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [playersRes, profilesRes, blockedByRes, friendsRes] = await Promise.all([
        supabase
          .from('players')
          .select('id, user_id, name, email, skill_level, wins, losses, usta_rating, competitiveness, age_range, city, gender')
          .neq('user_id', user.id)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, networking_enabled, profile_visibility, show_win_loss, show_usta_rating, show_location, first_name, last_name, profile_picture_url'),
        supabase
          .from('blocked_users')
          .select('blocker_id')
          .eq('blocked_user_id', user.id),
        supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'accepted')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p]));
      const blockedBySet = new Set((blockedByRes.data || []).map((b: any) => b.blocker_id));
      const outboundBlocked = new Set(blockedUsers.map(b => b.blocked_user_id));
      // Set of user_ids the current user is friends with.
      const friendSet = new Set(
        (friendsRes.data || []).map((r: any) => (r.sender_id === user.id ? r.receiver_id : r.sender_id)),
      );

      const eligible = (playersRes.data || [])
        .filter(p => {
          const profile = profileMap.get(p.user_id);
          if (profile?.networking_enabled === false) return false; // networking off or private
          // friends-only profiles are only discoverable to the player's friends
          if (profile?.profile_visibility === 'friends_only' && !friendSet.has(p.user_id)) return false;
          if (blockedBySet.has(p.user_id)) return false;
          if (outboundBlocked.has(p.user_id)) return false;
          return true;
        })
        .map(p => {
          const profile = profileMap.get(p.user_id);
          // Respect the player's privacy flags — hide fields they've chosen not to show.
          const showWinLoss = profile?.show_win_loss !== false;
          const showUsta    = profile?.show_usta_rating !== false;
          const showLocation = profile?.show_location !== false;
          return {
            ...p,
            wins: showWinLoss ? p.wins : undefined,
            losses: showWinLoss ? p.losses : undefined,
            usta_rating: showUsta ? p.usta_rating : undefined,
            city: showLocation ? p.city : undefined,
            first_name: profile?.first_name ?? undefined,
            last_name: profile?.last_name ?? undefined,
            profile_picture_url: profile?.profile_picture_url ?? null,
          } as PlayerSearchResult;
        });

      setAllPlayers(eligible);
    };

    load();
  }, [user?.id, blockedUsers]);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      const lower = q.toLowerCase().trim();

      const scored = allPlayers
        .filter(p =>
          p.name?.toLowerCase().includes(lower) ||
          p.email?.toLowerCase().includes(lower) ||
          p.first_name?.toLowerCase().includes(lower) ||
          p.last_name?.toLowerCase().includes(lower) ||
          (p.usta_rating || '').toLowerCase().includes(lower) ||
          String(p.skill_level || '').includes(lower) ||
          (p.competitiveness || '').toLowerCase().includes(lower) ||
          (p.age_range || '').toLowerCase().includes(lower)
        )
        .map(p => {
          const fl = (p.first_name || '').toLowerCase();
          const ll = (p.last_name || '').toLowerCase();
          const nl = (p.name || '').toLowerCase();
          const el = (p.email || '').toLowerCase();
          let score = 0;
          if (fl === lower)           score = 100;
          else if (fl.startsWith(lower)) score = 90;
          else if (ll === lower)       score = 80;
          else if (ll.startsWith(lower)) score = 70;
          else if (nl === lower)       score = 60;
          else if (nl.startsWith(lower)) score = 50;
          else if (el.startsWith(lower)) score = 40;
          return { player: p, score };
        })
        .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name))
        .slice(0, 15)
        .map(({ player }) => player);

      setResults(scored);
      setSearching(false);
    }, 300);
  }, [allPlayers]);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery('');
    setResults([]);
    setSearching(false);
  }, []);

  return { query, results, searching, search, clear };
};
