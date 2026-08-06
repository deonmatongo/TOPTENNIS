import { useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUniqueChannel } from '@/hooks/useUniqueChannel';

export interface PlayerProfile {
  id: string;
  user_id: string;
  name: string;
  /** players.email is nullable — phone-only accounts have none. */
  email?: string | null;
  /** profiles.username — null for legacy email-only accounts. */
  username?: string | null;
  phone?: string;
  city?: string;
  zip_code?: string;
  skill_level?: number;
  usta_rating?: string;
  competitiveness?: string;
  age_range?: string;
  bio?: string;
  networking_enabled?: boolean;
  gender?: string;
  location?: string;
  gender_preference?: string;
  age_competition_preference?: string;
  travel_distance?: string;
  wins: number;
  losses: number;
  current_streak?: number;
  best_streak?: number;
  profile_picture_url?: string;
  first_name?: string;
  last_name?: string;
}

// Tennis data lives on `players`; identity data (name parts, bio, avatar,
// networking flag) lives on `profiles`. Writes must be split accordingly —
// sending a profiles-only column to players is a hard PostgREST error.
const PLAYERS_COLUMNS = new Set([
  'name', 'email', 'phone', 'city', 'zip_code', 'location', 'skill_level',
  'usta_rating', 'competitiveness', 'age_range', 'gender', 'gender_preference',
  'age_competition_preference', 'travel_distance', 'wins', 'losses',
  'total_matches', 'current_streak', 'best_streak', 'hours_played',
]);
const PROFILES_COLUMNS = new Set([
  'first_name', 'last_name', 'bio', 'networking_enabled',
  'profile_picture_url', 'city', 'zip_code', 'phone', 'location',
]);

function splitUpdates(updates: Partial<PlayerProfile>) {
  const playerUpdates: Record<string, unknown> = {};
  const profileUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (PLAYERS_COLUMNS.has(key)) playerUpdates[key] = value;
    if (PROFILES_COLUMNS.has(key)) profileUpdates[key] = value;
  }
  return { playerUpdates, profileUpdates };
}

export function usePlayerProfile() {
  const { user } = useAuth();
  const channelTopic = useUniqueChannel('player-profile');
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlayer = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [{ data: playerData }, { data: profileData }] = await Promise.all([
      supabase.from('players').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('profiles')
        .select('first_name, last_name, username, bio, networking_enabled, profile_picture_url')
        .eq('id', user.id)
        .maybeSingle(),
    ]);
    if (playerData) {
      setPlayer({
        ...playerData,
        first_name: profileData?.first_name ?? undefined,
        last_name: profileData?.last_name ?? undefined,
        username: profileData?.username ?? null,
        bio: profileData?.bio ?? undefined,
        networking_enabled: profileData?.networking_enabled ?? true,
        profile_picture_url: profileData?.profile_picture_url || null,
      });
    } else {
      setPlayer(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchPlayer();

    // Bug fix: usePlayerProfile previously had no realtime subscription.
    // recordMatchResult() directly UPDATEs the players row (wins, losses,
    // total_matches), but the Dashboard and PerformanceScreen never saw it
    // until re-mount. Subscribe to UPDATE on the current user's players row
    // so stats refresh the moment the score lands.
    const channel = supabase
      .channel(channelTopic)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'players',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        if (__DEV__) console.log('[player-profile] players UPDATE', payload);
        fetchPlayer();
      })
      .subscribe((status: string) => {
        if (__DEV__) console.log('[player-profile] channel status', status);
      });

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') fetchPlayer();
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      supabase.removeChannel(channel);
      appStateSub.remove();
    };
  }, [user?.id]);

  const createPlayerProfile = async (profileData: Partial<PlayerProfile>) => {
    if (!user) throw new Error('Not authenticated');
    const { playerUpdates, profileUpdates } = splitUpdates(profileData);
    const { data, error } = await supabase
      .from('players')
      // email is nullable on players as of the phone-auth migration, but a
      // phone-only user has no user.email at all — passing undefined would send
      // no column and passing null is the honest value.
      .insert({ ...playerUpdates, user_id: user.id, email: user.email ?? null, wins: 0, losses: 0 })
      .select()
      .single();
    if (error) throw error;

    // Mirror identity fields and mark onboarding complete (same as web)
    await supabase
      .from('profiles')
      .update({ ...profileUpdates, profile_completed: true })
      .eq('id', user.id);

    await fetchPlayer();
    return data;
  };

  const updatePlayerProfile = async (updates: Partial<PlayerProfile>) => {
    if (!player || !user) throw new Error('No player profile');
    const { playerUpdates, profileUpdates } = splitUpdates(updates);

    if (Object.keys(playerUpdates).length > 0) {
      const { error } = await supabase
        .from('players')
        .update(playerUpdates)
        .eq('id', player.id);
      if (error) throw error;
    }
    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id);
      if (error) throw error;
    }

    await fetchPlayer();
    return { ...player, ...updates };
  };

  return { player, loading, refetch: fetchPlayer, createPlayerProfile, updatePlayerProfile };
}
