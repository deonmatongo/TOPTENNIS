import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  X,
  Trophy,
  Target,
  Zap,
  Sparkles,
  Users,
  Loader2,
  RefreshCw,
  Star,
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useDebounce } from '@/hooks/useDebounce';
import { useAIRecommendations, RecommendedPlayer } from '@/hooks/useAIRecommendations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import PlayerProfileModal from './PlayerProfileModal';
import type { SearchResult } from '@/hooks/usePlayerSearch';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const getSkillBadge = (level: number) => {
  if (level >= 7) return { label: 'Advanced',     className: 'bg-red-100 text-red-700 border-red-200' };
  if (level >= 6) return { label: 'Strong',        className: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (level >= 4) return { label: 'Intermediate',  className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return             { label: 'Beginner',        className: 'bg-green-100 text-green-700 border-green-200' };
};

// Converts a RecommendedPlayer | SearchResult to the SearchResult shape that
// PlayerProfileModal expects (they share the same fields).
const toSearchResult = (p: RecommendedPlayer | SearchResultRow): SearchResult => ({
  id:               p.id,
  user_id:          p.user_id,
  name:             p.name,
  email:            p.email,
  skill_level:      p.skill_level,
  wins:             p.wins,
  losses:           p.losses,
  usta_rating:      p.usta_rating ?? undefined,
  competitiveness:  p.competitiveness ?? undefined,
  age_range:        ('age_range' in p ? p.age_range : undefined) ?? undefined,
});

// ── Skeleton card ─────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <Card className="border">
    <CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-8 w-full rounded-md" />
    </CardContent>
  </Card>
);

// ── Shared player row (search results list) ───────────────────────────────────

interface SearchResultRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  skill_level: number;
  wins: number;
  losses: number;
  usta_rating: string | null;
  competitiveness: string | null;
}

interface SearchRowProps {
  player: SearchResultRow;
  onInvite: (p: SearchResultRow) => void;
}

const SearchRow: React.FC<SearchRowProps> = ({ player, onInvite }) => {
  const skill      = getSkillBadge(player.skill_level);
  const totalMatches = (player.wins ?? 0) + (player.losses ?? 0);
  const winRate      = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : null;

  return (
    <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors">
      <Avatar className="w-10 h-10 flex-shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-bold text-sm">
          {getInitials(player.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-sm text-foreground truncate">{player.name}</span>
          <Badge variant="outline" className={`text-xs shrink-0 ${skill.className}`}>
            {skill.label}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {player.usta_rating && (
            <span className="text-xs text-muted-foreground">USTA {player.usta_rating}</span>
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Trophy className="w-3 h-3 text-yellow-500" />
            {player.wins}W – {player.losses}L
          </span>
          {winRate !== null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="w-3 h-3 text-emerald-500" />
              {winRate}%
            </span>
          )}
        </div>
      </div>

      <Button
        size="sm"
        className="h-8 px-3 text-xs flex-shrink-0"
        onClick={() => onInvite(player)}
      >
        Invite
      </Button>
    </div>
  );
};

// ── Recommendation card ───────────────────────────────────────────────────────

interface RecommendationCardProps {
  player: RecommendedPlayer;
  onInvite: (p: RecommendedPlayer) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ player, onInvite }) => {
  const skill      = getSkillBadge(player.skill_level);
  const totalMatches = (player.wins ?? 0) + (player.losses ?? 0);
  const winRate      = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : null;

  return (
    <Card className="hover:shadow-md transition-all duration-200 border hover:border-primary/40 group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 ring-2 ring-border group-hover:ring-primary/40 transition-all flex-shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-bold text-sm">
              {getInitials(player.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                  {player.name}
                </h3>
                {player.usta_rating && (
                  <p className="text-xs text-muted-foreground mt-0.5">USTA {player.usta_rating}</p>
                )}
              </div>
              <Badge variant="outline" className={`text-xs shrink-0 ${skill.className}`}>
                {skill.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Trophy className="w-3 h-3 text-yellow-500" />
                {player.wins}W – {player.losses}L
              </span>
              {winRate !== null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Target className="w-3 h-3 text-emerald-500" />
                  {winRate}% win rate
                </span>
              )}
              {player.competitiveness && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="w-3 h-3 text-orange-400" />
                  {player.competitiveness}
                </span>
              )}
              {player.city && (
                <span className="text-xs text-muted-foreground">{player.city}</span>
              )}
            </div>

            {/* Compatibility score pill */}
            <div className="mt-2 flex items-center gap-1.5">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className="text-xs font-medium text-amber-600">
                {player.compatibilityScore}% match
              </span>
            </div>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full mt-3 h-8 text-xs"
          onClick={() => onInvite(player)}
        >
          Invite to Match
        </Button>
      </CardContent>
    </Card>
  );
};

// ── Main tab component ────────────────────────────────────────────────────────

const CasualMatchTab: React.FC = () => {
  const { user }  = useAuth();
  const { player } = usePlayerProfile();
  const { blockedUsers } = useBlockedUsers();
  const blockedIds = blockedUsers.map(b => b.blocked_user_id);

  // ── AI Recommendations ────────────────────────────────────────────────────
  const {
    recommendations,
    loading: recLoading,
    error:   recError,
    refetch: refetchRec,
  } = useAIRecommendations(player?.skill_level, blockedIds);

  // ── Player Search (debounced) ─────────────────────────────────────────────
  const [rawQuery, setRawQuery]           = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError]     = useState<string | null>(null);

  const debouncedQuery = useDebounce(rawQuery, 350);

  // Mirrors: GET /api/players/search?q=<debouncedQuery>
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const term = q.toLowerCase().trim();

      const { data, error } = await supabase
        .from('players')
        .select('id, user_id, name, email, skill_level, wins, losses, usta_rating, competitiveness')
        .neq('user_id', user?.id ?? '')
        .limit(50);

      if (error) throw error;

      const blockedSet = new Set(blockedIds);

      // Filter + relevance sort client-side (same logic as usePlayerSearch)
      const filtered = (data || [])
        .filter(p =>
          p.user_id &&
          !blockedSet.has(p.user_id) &&
          (
            p.name.toLowerCase().includes(term) ||
            p.email.toLowerCase().includes(term) ||
            p.usta_rating?.toLowerCase().includes(term) ||
            p.skill_level?.toString().includes(term) ||
            p.competitiveness?.toLowerCase().includes(term)
          ),
        )
        .map(p => ({
          id:              p.id,
          user_id:         p.user_id!,
          name:            p.name,
          email:           p.email,
          skill_level:     p.skill_level ?? 5,
          wins:            p.wins        ?? 0,
          losses:          p.losses      ?? 0,
          usta_rating:     p.usta_rating,
          competitiveness: p.competitiveness,
        }))
        .sort((a, b) => {
          const aName = a.name.toLowerCase().includes(term);
          const bName = b.name.toLowerCase().includes(term);
          if (aName && !bName) return -1;
          if (!aName && bName) return 1;
          return a.name.localeCompare(b.name);
        });

      setSearchResults(filtered);
    } catch (err: any) {
      console.error('[CasualMatchTab] search error:', err);
      setSearchError(err?.message ?? 'Search failed');
      toast.error('Could not search players. Please try again.', { toastId: 'search-error' });
    } finally {
      setSearchLoading(false);
    }
  }, [user?.id, blockedIds.join(',')]);

  // Fire whenever the debounced value settles
  useEffect(() => {
    runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  // Show error toast when recommendation fetch fails
  useEffect(() => {
    if (recError) {
      toast.error('Could not load AI recommendations. Please refresh.', {
        toastId: 'rec-error',
      });
    }
  }, [recError]);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [showProfile, setShowProfile]       = useState(false);

  const handleInvite = (p: RecommendedPlayer | SearchResultRow) => {
    setSelectedPlayer(toSearchResult(p));
    setShowProfile(true);
    toast.info(`Opening profile for ${p.name} — pick a time slot to send the invite.`, {
      toastId: `invite-${p.id}`,
      autoClose: 3000,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* ── Section 1: AI Recommendations ─────────────────────────────────── */}
      <section aria-labelledby="ai-rec-heading">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              id="ai-rec-heading"
              className="text-xl font-bold text-foreground flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-primary" />
              AI Recommendations
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Players matched to your skill level ({player?.skill_level ?? '–'}) · ranked by compatibility
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              refetchRec();
              toast.info('Refreshing recommendations…', { toastId: 'rec-refresh', autoClose: 1500 });
            }}
            disabled={recLoading}
            className="flex-shrink-0"
            aria-label="Refresh recommendations"
          >
            <RefreshCw className={`w-4 h-4 ${recLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Skeleton loaders */}
        {recLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Recommendation grid */}
        {!recLoading && recommendations.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map(p => (
              <RecommendationCard key={p.id} player={p} onInvite={handleInvite} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!recLoading && recommendations.length === 0 && !recError && (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">No recommendations yet</p>
            <p className="text-sm mt-1">
              We couldn't find players at your skill level right now. Check back soon!
            </p>
          </div>
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* ── Section 2: Player Search ───────────────────────────────────────── */}
      <section aria-labelledby="search-heading">
        <div className="mb-4">
          <h2
            id="search-heading"
            className="text-xl font-bold text-foreground flex items-center gap-2"
          >
            <Users className="w-5 h-5 text-primary" />
            Player Search
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Search any player by name, USTA rating, skill level, or play style
          </p>
        </div>

        {/* Debounced search input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={rawQuery}
            onChange={e => setRawQuery(e.target.value)}
            placeholder="Search by name, USTA rating, skill level, play style…"
            className="pl-9 pr-9 h-11"
            autoComplete="off"
            aria-label="Search players"
          />
          {rawQuery && (
            <button
              onClick={() => { setRawQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status line */}
        <div className="text-xs text-muted-foreground mb-3 h-4">
          {searchLoading && (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Searching…
            </span>
          )}
          {!searchLoading && debouncedQuery.trim() && searchResults.length > 0 && (
            <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{debouncedQuery}"</span>
          )}
          {!searchLoading && debouncedQuery.trim() && searchResults.length === 0 && !searchError && (
            <span>No players found for "{debouncedQuery}"</span>
          )}
        </div>

        {/* Scrollable results list */}
        {searchResults.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden max-h-[480px] overflow-y-auto shadow-sm">
            {searchResults.map(p => (
              <SearchRow key={p.id} player={p} onInvite={handleInvite} />
            ))}
          </div>
        )}

        {/* Empty search state (only shown after user has typed) */}
        {!searchLoading && !debouncedQuery.trim() && (
          <div className="text-center py-10 text-muted-foreground border border-dashed rounded-xl">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Start typing to search the player network</p>
          </div>
        )}
      </section>

      {/* Player profile + booking modal */}
      <PlayerProfileModal
        player={selectedPlayer}
        isOpen={showProfile}
        onClose={() => {
          setShowProfile(false);
          setSelectedPlayer(null);
        }}
      />

      {/* react-toastify container — self-contained, won't affect other tabs */}
      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default CasualMatchTab;
