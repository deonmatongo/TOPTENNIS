import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search,
  X,
  Users,
  Trophy,
  Target,
  Loader2,
  Zap,
} from 'lucide-react';
import { usePlayerSearch, SearchResult } from '@/hooks/usePlayerSearch';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import PlayerProfileModal from './PlayerProfileModal';

// ── Skill badge ───────────────────────────────────────────────────────────────

const getSkillBadge = (level: number) => {
  if (level >= 7) return { label: 'Advanced', className: 'bg-red-100 text-red-700 border-red-200' };
  if (level >= 6) return { label: 'Strong', className: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (level >= 4) return { label: 'Intermediate', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return { label: 'Beginner', className: 'bg-green-100 text-green-700 border-green-200' };
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// ── Player card ───────────────────────────────────────────────────────────────

interface PlayerCardProps {
  player: SearchResult;
  onSelect: (player: SearchResult) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, onSelect }) => {
  const skill = getSkillBadge(player.skill_level);
  const totalMatches = (player.wins ?? 0) + (player.losses ?? 0);
  const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : null;

  return (
    <Card
      className="hover:shadow-md transition-all duration-200 cursor-pointer border hover:border-primary/40 group"
      onClick={() => onSelect(player)}
    >
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
                  <p className="text-xs text-muted-foreground mt-0.5">
                    USTA {player.usta_rating}
                  </p>
                )}
              </div>
              <Badge variant="outline" className={`text-xs shrink-0 ${skill.className}`}>
                {skill.label}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Trophy className="w-3 h-3 text-yellow-500" />
                {player.wins ?? 0}W – {player.losses ?? 0}L
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
              {player.age_range && (
                <span className="text-xs text-muted-foreground">{player.age_range}</span>
              )}
            </div>
          </div>
        </div>

        <Button
          size="sm"
          className="w-full mt-3 h-8 text-xs"
          onClick={e => { e.stopPropagation(); onSelect(player); }}
        >
          View Profile & Book Match
        </Button>
      </CardContent>
    </Card>
  );
};

// ── Main tab ──────────────────────────────────────────────────────────────────

const CasualMatchTab: React.FC = () => {
  const { blockedUsers } = useBlockedUsers();
  const blockedIds = blockedUsers.map(b => b.blocked_user_id);

  const { searchTerm, setSearchTerm, searchResults, isSearching, clearSearch, allPlayers } =
    usePlayerSearch(blockedIds);

  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const handleSelect = (player: SearchResult) => {
    setSelectedPlayer(player);
    setShowProfile(true);
  };

  const displayedPlayers = searchTerm.trim() ? searchResults : allPlayers;
  const isShowingAll = !searchTerm.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Find a Casual Match
        </h1>
        <p className="text-sm text-muted-foreground">
          Search for players in the network, view their profile, and book a casual match directly.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by name, USTA rating, skill level, age range…"
          className="pl-9 pr-9 h-11"
          autoComplete="off"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {isSearching ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Searching…
          </span>
        ) : (
          <span>
            {isShowingAll
              ? `${allPlayers.length} player${allPlayers.length !== 1 ? 's' : ''} available`
              : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </span>
        )}
      </div>

      {/* Player grid */}
      {displayedPlayers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedPlayers.map(player => (
            <PlayerCard key={player.id} player={player} onSelect={handleSelect} />
          ))}
        </div>
      ) : !isSearching && searchTerm.trim() ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-base font-medium">No players found</p>
          <p className="text-sm mt-1">Try a different name, rating, or skill level</p>
        </div>
      ) : !isSearching && allPlayers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-base font-medium">No players found in the network</p>
          <p className="text-sm mt-1">Check back later as more players join</p>
        </div>
      ) : null}

      {/* Player profile + booking modal */}
      <PlayerProfileModal
        player={selectedPlayer}
        isOpen={showProfile}
        onClose={() => {
          setShowProfile(false);
          setSelectedPlayer(null);
        }}
      />
    </div>
  );
};

export default CasualMatchTab;
