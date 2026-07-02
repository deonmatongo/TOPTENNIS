import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SearchResult {
  id: string;
  user_id: string;
  name: string;
  email: string;
  skill_level: number;
  wins: number;
  losses: number;
  usta_rating?: string;
  competitiveness?: string;
  age_range?: string;
  networking_enabled?: boolean;
  first_name?: string;
  last_name?: string;
  gender?: string | null;
  profile_picture_url?: string | null;
}

export const usePlayerSearch = (blockedUserIds: string[] = []) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [allPlayers, setAllPlayers] = useState<SearchResult[]>([]);

  // Fetch all players on mount (re-fetch when current user or blocked list changes)
  useEffect(() => {
    const fetchAllPlayers = async () => {
      if (!user?.id) return;
      try {
        // Fetch players
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('id, user_id, name, email, skill_level, wins, losses, usta_rating, competitiveness, age_range, phone, gender')
          .order('name');

        if (playersError) throw playersError;

        const userIds = playersData?.filter(p => p.user_id).map(p => p.user_id) || [];

        // Fetch networking prefs + names
        let profilesData: { id: string; networking_enabled: boolean; first_name: string | null; last_name: string | null; profile_picture_url?: string | null }[] = [];
        if (userIds.length > 0) {
          const { data, error: profilesError } = await supabase
            .from('profiles')
            .select('id, networking_enabled, first_name, last_name, profile_picture_url')
            .in('id', userIds);

          if (profilesError) {
            console.warn('Error fetching profiles:', profilesError);
          } else {
            profilesData = (data || []) as typeof profilesData;
          }
        }

        // Fetch users who have blocked the current user (reverse block)
        const { data: blockedByRows } = await (supabase as any)
          .from('blocked_users')
          .select('blocker_id')
          .eq('blocked_user_id', user.id);
        const blockedBySet = new Set(((blockedByRows || []) as any[]).map((b: any) => b.blocker_id));

        const blockedSet = new Set(blockedUserIds);

        const playersWithNetworking = (playersData || []).map(player => {
          const profile = profilesData.find(p => p.id === player.user_id);
          return {
            ...player,
            networking_enabled: profile?.networking_enabled ?? true,
            first_name: profile?.first_name,
            last_name: profile?.last_name,
            profile_picture_url: profile?.profile_picture_url ?? null,
          };
        }).filter(player =>
          player.networking_enabled !== false &&
          player.user_id !== user.id &&
          !blockedSet.has(player.user_id) &&
          !blockedBySet.has(player.user_id)
        );

        setAllPlayers(playersWithNetworking);
      } catch (error) {
        console.error('Error fetching players:', error);
        // Fallback: skip block-by check, still apply outbound blocks
        try {
          const { data: fallbackData } = await supabase
            .from('players')
            .select('id, user_id, name, email, skill_level, wins, losses, usta_rating, competitiveness, age_range, phone, gender')
            .order('name');

          if (fallbackData) {
            const blockedSet = new Set(blockedUserIds);
            setAllPlayers(
              fallbackData
                .filter(p => p.user_id !== user.id && !blockedSet.has(p.user_id))
                .map(p => ({ ...p, networking_enabled: true }))
            );
          }
        } catch (fallbackError) {
          console.error('Fallback fetch also failed:', fallbackError);
        }
      }
    };

    fetchAllPlayers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, blockedUserIds.join(',')]);

  // Search function with debouncing
  const searchPlayers = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      
      try {
        const searchTerm = term.toLowerCase().trim();
        
        // Enhanced search across multiple fields including first/last name
        const filtered = allPlayers.filter(player => {
          const nameMatch = player.name.toLowerCase().includes(searchTerm);
          const emailMatch = player.email.toLowerCase().includes(searchTerm);
          const firstNameMatch = player.first_name && player.first_name.toLowerCase().includes(searchTerm);
          const lastNameMatch = player.last_name && player.last_name.toLowerCase().includes(searchTerm);
          const ustaMatch = player.usta_rating && player.usta_rating.toLowerCase().includes(searchTerm);
          const skillMatch = player.skill_level.toString().includes(searchTerm);
          const competitivenessMatch = player.competitiveness && player.competitiveness.toLowerCase().includes(searchTerm);
          const ageRangeMatch = player.age_range && player.age_range.toLowerCase().includes(searchTerm);
          
          return nameMatch || emailMatch || firstNameMatch || lastNameMatch || ustaMatch || skillMatch || competitivenessMatch || ageRangeMatch;
        });

        // Sort results by relevance (first/last name matches first, then full name, then email, then others)
        const sortedResults = filtered.sort((a, b) => {
          const aFirstNameMatch = a.first_name && a.first_name.toLowerCase().includes(searchTerm);
          const bFirstNameMatch = b.first_name && b.first_name.toLowerCase().includes(searchTerm);
          const aLastNameMatch = a.last_name && a.last_name.toLowerCase().includes(searchTerm);
          const bLastNameMatch = b.last_name && b.last_name.toLowerCase().includes(searchTerm);
          const aNameMatch = a.name.toLowerCase().includes(searchTerm);
          const bNameMatch = b.name.toLowerCase().includes(searchTerm);
          const aEmailMatch = a.email.toLowerCase().includes(searchTerm);
          const bEmailMatch = b.email.toLowerCase().includes(searchTerm);
          
          // Prioritize first name matches
          if (aFirstNameMatch && !bFirstNameMatch) return -1;
          if (!aFirstNameMatch && bFirstNameMatch) return 1;
          
          // Then last name matches
          if (aLastNameMatch && !bLastNameMatch) return -1;
          if (!aLastNameMatch && bLastNameMatch) return 1;
          
          // Then full name matches
          if (aNameMatch && !bNameMatch) return -1;
          if (!aNameMatch && bNameMatch) return 1;
          
          // Then email matches
          if (aEmailMatch && !bEmailMatch) return -1;
          if (!aEmailMatch && bEmailMatch) return 1;
          
          // Finally sort alphabetically by name
          return a.name.localeCompare(b.name);
        });

        setSearchResults(sortedResults.slice(0, 10)); // Increased limit to 10 results
        console.log(`Search for "${term}" found ${sortedResults.length} results`);
      } catch (error) {
        console.error('Error searching players:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [allPlayers]
  );

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      searchPlayers(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchPlayers]);

  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
  };

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    isSearching,
    clearSearch,
    allPlayers
  };
};