import { supabase } from '@/services/supabase';

export interface PlayerSearchRow {
  id: string;
  user_id: string;
  name: string;
  skill_level?: number;
  usta_rating?: string;
  city?: string;
  wins?: number;
  losses?: number;
  profile_picture_url?: string;
}

/**
 * Search players by name. Tennis data comes from `players`; avatars live on
 * `profiles` (players has no profile_picture_url column), so results are
 * enriched with a second batched query.
 */
export async function searchPlayersByName(
  query: string,
  opts: { excludeUserId?: string; excludePlayerId?: string; limit?: number } = {},
): Promise<PlayerSearchRow[]> {
  let q = supabase
    .from('players')
    .select('id, user_id, name, skill_level, usta_rating, city, wins, losses')
    .ilike('name', `%${query}%`)
    .limit(opts.limit ?? 15);
  if (opts.excludeUserId) q = q.neq('user_id', opts.excludeUserId);
  if (opts.excludePlayerId) q = q.neq('id', opts.excludePlayerId);

  const { data, error } = await q;
  if (error || !data || data.length === 0) return [];

  const userIds = data.map(p => p.user_id).filter(Boolean);
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, profile_picture_url').in('id', userIds)
    : { data: [] as any[] };
  const avatarMap = new Map((profiles || []).map(p => [p.id, p.profile_picture_url]));

  return data.map(p => ({
    ...p,
    profile_picture_url: avatarMap.get(p.user_id) ?? undefined,
  }));
}
