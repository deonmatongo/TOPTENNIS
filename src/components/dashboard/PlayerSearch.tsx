import React, { useRef, useEffect } from 'react';
import { Search, User, Trophy, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePlayerSearch, SearchResult } from '@/hooks/usePlayerSearch';
import PlayerProfileModal from './PlayerProfileModal';

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
  const { 
    searchTerm, 
    setSearchTerm, 
    searchResults, 
    isSearching, 
    clearSearch 
  } = usePlayerSearch();
  
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
    setSearchTerm('');
    setShowResults(false);
  };

  const handleClear = () => {
    clearSearch();
    setShowResults(false);
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
    if (skillLevel >= 8) return 'Advanced';
    if (skillLevel >= 6) return 'Intermediate';
    if (skillLevel >= 4) return 'Beginner+';
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
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
                    onClick={() => handlePlayerSelect(player)}
                    className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors active:bg-accent/70"
                  >
                    <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-medium text-foreground truncate">
                          {player.name}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getSkillBadgeColor(player.skill_level)}`}
                        >
                          {getSkillLabel(player.skill_level)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span className="truncate">{player.email}</span>
                        {(player.wins > 0 || player.losses > 0) && (
                          <div className="flex items-center space-x-1">
                            <Trophy className="w-3 h-3" />
                            <span>{player.wins}W-{player.losses}L</span>
                          </div>
                        )}
                        {player.usta_rating && (
                          <Badge variant="secondary" className="text-xs">
                            {player.usta_rating}
                          </Badge>
                        )}
                      </div>
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