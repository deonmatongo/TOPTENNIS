import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface League {
  id: string;
  name: string;
  description?: string;
  location?: string;
  status?: string;
  level?: string;
  category?: string;
  season?: string;
  players?: number;
  prize?: string;
}

export interface LeagueRegistration {
  id: string;
  user_id: string;
  league_id: string;
  league_name?: string;
  status: string;
  created_at: string;
  league?: League;
}

// Static league data — kept in sync with web RegisterTab.tsx
export const STATIC_LEAGUES: League[] = [
  {
    id: 'mens-singles-summer-2025',
    name: "Men's Singles",
    category: 'Singles',
    season: '07/13/2025',
    description: "Men's singles league for competitive adult players. Evening and weekend matches available. Registration Deadline: July 3rd",
    prize: '$35.00',
    status: 'Open',
  },
  {
    id: 'mens-doubles-fall-2025',
    name: "Men's Doubles",
    category: 'Doubles',
    season: '09/07/2025',
    description: "Men's doubles league for players who enjoy team competition. Flexible scheduling for working professionals. Registration Deadline: August 28th",
    prize: '$40.00',
    status: 'Open',
  },
  {
    id: 'ladies-singles-summer-2025',
    name: "Ladies' Singles",
    category: 'Singles',
    season: '07/13/2025',
    description: "Women's singles league with competitive matches. Perfect for improving individual skills. Registration Deadline: July 3rd",
    prize: '$35.00',
    status: 'Open',
  },
  {
    id: 'ladies-doubles-fall-2025',
    name: "Ladies' Doubles",
    category: 'Doubles',
    season: '09/07/2025',
    description: "Women's doubles league focusing on strategy and teamwork. Social and competitive atmosphere. Registration Deadline: August 28th",
    prize: '$40.00',
    status: 'Open',
  },
  {
    id: 'mixed-doubles-fall-2025',
    name: 'Mixed Doubles',
    category: 'Doubles',
    season: '09/07/2025',
    description: 'Mixed doubles league for men and women. Great way to meet new players and enjoy competitive tennis. Registration Deadline: August 28th',
    prize: '$45.00',
    status: 'Open',
  },
];

export function useLeagueRegistrations() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<LeagueRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRegistrations = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('league_registrations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[useLeagueRegistrations] fetch error:', error.message);
    }
    // Attach static league data to each registration
    const enriched = (data || []).map(r => ({
      ...r,
      league: STATIC_LEAGUES.find(l => l.id === r.league_id),
    }));
    setRegistrations(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchRegistrations(); }, [user?.id]);

  const registerForLeague = async (leagueId: string) => {
    if (!user) throw new Error('Not authenticated');
    const league = STATIC_LEAGUES.find(l => l.id === leagueId);

    // Get player profile for division assignment
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!playerData) throw new Error('No player profile. Please complete your profile first.');

    const { data, error } = await supabase
      .from('league_registrations')
      .insert({
        user_id: user.id,
        league_id: leagueId,
        league_name: league?.name || leagueId,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;

    // Attempt division assignment (non-blocking)
    const skillLevelText = playerData.usta_rating || `Level ${playerData.skill_level || 'Beginner'}`;
    supabase.rpc('assign_player_to_division', {
      p_user_id: user.id,
      p_league_registration_id: data.id,
      p_league_id: leagueId,
      p_skill_level: skillLevelText,
      p_competitiveness: playerData.competitiveness || 'casual',
      p_age_range: playerData.age_range || '30-39',
      p_gender_preference: playerData.gender_preference || 'no-preference',
    }).then(({ error: e }) => {
      if (e) console.warn('[useLeagueRegistrations] division assignment:', e.message);
    });

    await fetchRegistrations();
  };

  const isRegistered = (leagueId: string) =>
    registrations.some(r => r.league_id === leagueId && r.status === 'active');

  // All leagues are always shown (static); registrations tell us which ones the user joined
  return {
    registrations,
    allLeagues: STATIC_LEAGUES,
    loading,
    registerForLeague,
    isRegistered,
    refetch: fetchRegistrations,
  };
}
