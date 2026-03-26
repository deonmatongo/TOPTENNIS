import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy,
  Target,
  Zap,
  Sparkles,
  RefreshCw,
  Star,
  ChevronDown,
  Search,
  ChevronLeft,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useAIRecommendations, RecommendedPlayer } from '@/hooks/useAIRecommendations';
import { usePlayerSearch } from '@/hooks/usePlayerSearch';
import PlayerProfileModal from './PlayerProfileModal';
import type { SearchResult } from '@/hooks/usePlayerSearch';

const PAGE_SIZE = 6;

type Mode = null | 'ai' | 'search';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const getSkillBadge = (level: number) => {
  if (level >= 7) return { label: 'Advanced',    className: 'bg-red-100 text-red-700 border-red-200' };
  if (level >= 6) return { label: 'Strong',       className: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (level >= 4) return { label: 'Intermediate', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return             { label: 'Beginner',       className: 'bg-green-100 text-green-700 border-green-200' };
};

const toSearchResult = (p: RecommendedPlayer): SearchResult => ({
  id:                  p.id,
  user_id:             p.user_id,
  name:                p.name,
  email:               p.email,
  skill_level:         p.skill_level,
  wins:                p.wins,
  losses:              p.losses,
  usta_rating:         p.usta_rating ?? undefined,
  competitiveness:     p.competitiveness ?? undefined,
  age_range:           p.age_range ?? undefined,
  profile_picture_url: p.profile_picture_url,
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

// ── Player card (shared between AI and search views) ──────────────────────────

interface PlayerCardProps {
  player: {
    id: string;
    user_id: string;
    name: string;
    email: string;
    skill_level: number;
    wins: number;
    losses: number;
    usta_rating?: string | null;
    competitiveness?: string | null;
    profile_picture_url?: string | null;
    compatibilityScore?: number;
    city?: string | null;
  };
  onInvite: (p: SearchResult) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, onInvite }) => {
  const skill        = getSkillBadge(player.skill_level);
  const totalMatches = (player.wins ?? 0) + (player.losses ?? 0);
  const winRate      = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : null;

  const sr: SearchResult = {
    id:                  player.id,
    user_id:             player.user_id,
    name:                player.name,
    email:               player.email,
    skill_level:         player.skill_level,
    wins:                player.wins,
    losses:              player.losses,
    usta_rating:         player.usta_rating ?? undefined,
    competitiveness:     player.competitiveness ?? undefined,
    profile_picture_url: player.profile_picture_url,
  };

  return (
    <Card className="hover:shadow-md transition-all duration-200 border hover:border-primary/40 group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 ring-2 ring-border group-hover:ring-primary/40 transition-all flex-shrink-0">
            <AvatarImage src={player.profile_picture_url ?? undefined} alt={player.name} className="object-cover" />
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

            {player.compatibilityScore !== undefined && (
              <div className="mt-2 flex items-center gap-1.5">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span className="text-xs font-medium text-amber-600">
                  {player.compatibilityScore}% match
                </span>
              </div>
            )}
          </div>
        </div>

        <Button size="sm" className="w-full mt-3 h-8 text-xs" onClick={() => onInvite(sr)}>
          Invite to Match
        </Button>
      </CardContent>
    </Card>
  );
};

// ── Mode selector blocks ───────────────────────────────────────────────────────

interface ModeSelectorProps {
  onSelect: (mode: 'ai' | 'search') => void;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ onSelect }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* AI Recommendation */}
    <button
      onClick={() => onSelect('ai')}
      className="group text-left rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all duration-200 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <Badge variant="secondary" className="text-xs font-semibold">Recommended</Badge>
      </div>
      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-1">
        AI Recommendation
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Let our AI find the best opponents for you based on skill level and playing style.
      </p>
    </button>

    {/* Search by Name */}
    <button
      onClick={() => onSelect('search')}
      className="group text-left rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all duration-200 p-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Search className="w-6 h-6 text-primary" />
        </div>
        <Badge variant="outline" className="text-xs font-semibold">Manual</Badge>
      </div>
      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors mb-1">
        Search Player by Name
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Know who you want to play? Search by name and send them a match invite directly.
      </p>
    </button>
  </div>
);

// ── AI view ────────────────────────────────────────────────────────────────────

interface AIViewProps {
  skillLevel?: number;
  blockedIds: string[];
  onInvite: (p: SearchResult) => void;
}

const AIView: React.FC<AIViewProps> = ({ skillLevel, blockedIds, onInvite }) => {
  const { recommendations, loading, error, refetch } = useAIRecommendations(skillLevel, blockedIds);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [recommendations]);
  useEffect(() => { if (error) toast.error('Could not load AI recommendations. Please refresh.'); }, [error]);

  const visiblePlayers = recommendations.slice(0, visibleCount);
  const hasMore        = visibleCount < recommendations.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Recommendations
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ranked by compatibility with your skill level ({skillLevel ?? '–'})
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { refetch(); toast.info('Refreshing…'); }} disabled={loading} aria-label="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && visiblePlayers.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visiblePlayers.map(p => (
              <PlayerCard key={p.id} player={p} onInvite={onInvite} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount(c => c + PAGE_SIZE)} className="gap-2">
                <ChevronDown className="w-4 h-4" />
                Show More ({recommendations.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {!loading && recommendations.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No recommendations yet</p>
          <p className="text-sm mt-1">We couldn't find players at your skill level right now. Check back soon!</p>
        </div>
      )}
    </div>
  );
};

// ── Search view ────────────────────────────────────────────────────────────────

interface SearchViewProps {
  blockedIds: string[];
  onInvite: (p: SearchResult) => void;
}

const SearchView: React.FC<SearchViewProps> = ({ blockedIds, onInvite }) => {
  const { searchTerm, setSearchTerm, searchResults, isSearching } = usePlayerSearch(blockedIds);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-1">
          <Search className="w-5 h-5 text-primary" />
          Search Player by Name
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Type a name to find and invite any player.</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
      </div>

      {isSearching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!isSearching && searchTerm && searchResults.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchResults.map(p => (
            <PlayerCard key={p.id} player={{ ...p, wins: p.wins ?? 0, losses: p.losses ?? 0 }} onInvite={onInvite} />
          ))}
        </div>
      )}

      {!isSearching && searchTerm && searchResults.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
          <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No players found</p>
          <p className="text-sm mt-1">Try a different name or check the spelling.</p>
        </div>
      )}

      {!searchTerm && (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Start typing to search for players</p>
        </div>
      )}
    </div>
  );
};

// ── Main tab component ────────────────────────────────────────────────────────

const CasualMatchTab: React.FC = () => {
  const { player }       = usePlayerProfile();
  const { blockedUsers } = useBlockedUsers();
  const blockedIds       = blockedUsers.map(b => b.blocked_user_id);

  const [mode, setMode] = useState<Mode>(null);

  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [showProfile, setShowProfile]       = useState(false);

  const handleInvite = (p: SearchResult) => {
    setSelectedPlayer(p);
    setShowProfile(true);
    toast.info(`Opening profile for ${p.name} — pick a time slot to send the invite.`);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        {mode !== null && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setMode(null)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Casual Match</h1>
          <p className="text-sm text-muted-foreground">
            {mode === null  ? 'How would you like to find an opponent?' :
             mode === 'ai'  ? 'AI-powered opponent recommendations' :
                              'Search for a specific player'}
          </p>
        </div>
      </div>

      {/* ── Mode selector or active view ── */}
      {mode === null  && <ModeSelector onSelect={setMode} />}
      {mode === 'ai'  && <AIView skillLevel={player?.skill_level} blockedIds={blockedIds} onInvite={handleInvite} />}
      {mode === 'search' && <SearchView blockedIds={blockedIds} onInvite={handleInvite} />}

      {/* ── Player profile + booking modal ── */}
      <PlayerProfileModal
        player={selectedPlayer}
        isOpen={showProfile}
        onClose={() => { setShowProfile(false); setSelectedPlayer(null); }}
      />
    </div>
  );
};

export default CasualMatchTab;
