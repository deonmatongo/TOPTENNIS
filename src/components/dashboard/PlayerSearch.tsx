import React, { useRef, useEffect } from 'react';
import { Search, User, Trophy, X, Loader2, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePlayerSearch, SearchResult } from '@/hooks/usePlayerSearch';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import PlayerProfileModal from './PlayerProfileModal';
import { toast } from 'sonner';

interface PlayerSearchProps {
  onPlayerSelect?: (player: SearchResult) => void;
  placeholder?: string;
  className?: string;
}

const PlayerSearch = ({ 
  onPlayerSelect, 
  placeholder = "Search players...",
  className = ""
}: PlayerSearchProps) => {
  const { blockedUsers } = useBlockedUsers();
  const blockedUserIds = blockedUsers.map(b => b.blocked_user_id);
  const { 
    searchTerm, 
    setSearchTerm, 
    searchResults, 
    isSearching, 
    clearSearch 
  } = usePlayerSearch(blockedUserIds);
  const { sendFriendRequest } = useFriendRequests();
  const [showResults, setShowResults] = React.useState(false);
  const [selectedPlayer, setSelectedPlayer] = React.useState<SearchResult | null>(null);
  const [showPlayerModal, setShowPlayerModal] = React.useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowResults(value.length > 0);
  };

  const handlePlayerSelect = (player: SearchResult) => {
    setSelectedPlayer(player);
    setShowPlayerModal(true);
    onPlayerSelect?.(player);
  };

  const handleSendFriendRequest = async (player: SearchResult) => {
    console.log('Attempting to send friend request to player:', player);
    console.log('Player user_id:', player.user_id);
    
    if (!player.user_id) {
      toast.error('Cannot send friend request to this player');
      return;
    }
    
    try {
      await sendFriendRequest(player.user_id);
      toast.success('Friend request sent successfully');
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
    }
  };

  const handleClear = () => {
    clearSearch();
    setShowResults(false);
    setSearchTerm('');
  };

  const handleInputFocus = () => {
    if (searchTerm.length > 0) {
      setShowResults(true);
    }
  };

  const getSkillBadgeColor = (skillLevel: number) => {
    if (skillLevel >= 8) return 'bg-red-100 text-red-800 border-red-200';
    if (skillLevel >= 6) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (skillLevel >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getSkillLabel = (skillLevel: number) => {
    if (skillLevel >= 7) return 'Advanced';
    if (skillLevel >= 4) return 'Intermediate';
    return 'Beginner';
  };

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="pl-10 pr-10 bg-muted/30 backdrop-blur-sm border-border text-sm focus:bg-background transition-colors"
          autoComplete="off"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 hover:bg-background/50"
            onClick={handleClear}
            type="button"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
        {isSearching && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto min-w-[320px]">
          {searchResults.length === 0 && searchTerm && !isSearching && (
            <div className="p-6 text-center">
              <User className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No players found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try searching with a different name or email
              </p>
            </div>
          )}
          
          {searchResults.length > 0 && (
            <div className="p-2">
              <div className="text-xs text-muted-foreground px-2 py-1 font-medium">
                Players ({searchResults.length})
              </div>
              <div className="space-y-1">
                {searchResults.map((player) => (
                  <div
                    key={player.id}
                    className="p-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    {/* Player info row */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 shrink-0 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-foreground text-sm truncate">
                            {player.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${getSkillBadgeColor(player.skill_level)}`}
                          >
                            {getSkillLabel(player.skill_level)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="truncate">{player.email}</span>
                          {(player.wins > 0 || player.losses > 0) && (
                            <span className="shrink-0 flex items-center gap-1">
                              <Trophy className="w-3 h-3" />
                              {player.wins}W-{player.losses}L
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons row */}
                    <div className="flex flex-wrap gap-2 mt-1 pl-12">
                      <Button
                        size="sm"
                        onClick={() => handlePlayerSelect(player)}
                        className="h-7 px-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground whitespace-nowrap"
                      >
                        <User className="w-3 h-3 mr-1" />
                        View Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); handleSendFriendRequest(player); }}
                        className="h-7 px-2 text-xs border-green-300 text-green-600 hover:bg-green-50 whitespace-nowrap"
                        disabled={!player.user_id}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Add Friend
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      <PlayerProfileModal 
        player={selectedPlayer}
        isOpen={showPlayerModal}
        onClose={() => setShowPlayerModal(false)}
      />
    </div>
  );
};

export default PlayerSearch;