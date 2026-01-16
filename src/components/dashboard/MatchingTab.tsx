import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Bot, Calendar, AlertCircle, Trophy, TrendingUp } from 'lucide-react';
import MatchSuggestions from '@/components/MatchSuggestions';
import PlayerSearch from '@/components/dashboard/PlayerSearch';
import { PlayerScheduleModal } from './PlayerScheduleModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDivisionAssignments } from '@/hooks/useDivisionAssignments';
import { useMatchSuggestions } from '@/hooks/useMatchSuggestions';
import { useMatches, type Match } from '@/hooks/useMatches';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import type { SearchResult } from '@/hooks/usePlayerSearch';
import { toast } from 'sonner';
import { format } from 'date-fns';
type MatchingMode = 'selection' | 'ai-recommendations' | 'player-search';
const MatchingTab = () => {
  const [matchingMode, setMatchingMode] = useState<MatchingMode>('selection');
  const [selectedPlayer, setSelectedPlayer] = useState<SearchResult | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showUnmatchedDialog, setShowUnmatchedDialog] = useState(false);
  const {
    assignments
  } = useDivisionAssignments();
  const {
    suggestions
  } = useMatchSuggestions();
  const {
    matches
  } = useMatches();
  const {
    player
  } = usePlayerProfile();
  const handlePlayerSelect = (player: SearchResult) => {
    setSelectedPlayer(player);
    setShowScheduleModal(true);
  };
  const handleUnmatchedPlayerOption = async (acceptOutsideCriteria: boolean) => {
    if (acceptOutsideCriteria) {
      toast.success("We'll place you in the next available division and notify you when it's ready!");
    } else {
      toast.info("You'll remain on the waitlist for a division that matches your preferences.");
    }
    setShowUnmatchedDialog(false);
  };

  // Get recent casual matches (matches without league_id)
  const recentCasualMatches = matches.filter(match => !match.league_id && match.status === 'completed' && (match.player1_id === player?.id || match.player2_id === player?.id)).slice(0, 3);
  const getOpponentName = (match: Match) => {
    if (match.player1_id === player?.id) {
      return match.player2?.name || 'Unknown';
    }
    return match.player1?.name || 'Unknown';
  };
  const getMatchResult = (match: Match) => {
    if (match.winner_id === player?.id) {
      return {
        text: 'Won',
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      };
    }
    return {
      text: 'Lost',
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    };
  };
  const renderModeSelection = () => <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground mb-3">Find Your Opponents</h2>
        <p className="text-muted-foreground text-lg">
          How would you like to find your opponents?
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* AI Recommendations Card */}
        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50" onClick={() => setMatchingMode('ai-recommendations')}>
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">AI-Recommended Matches</CardTitle>
            <CardDescription className="text-center">Let our AI help you find a competitive opponent based on: </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Same age range
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Radius and same location
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Players who are willing to match
              </div>
            </div>
            <Button className="w-full mt-4" onClick={() => setMatchingMode('ai-recommendations')}>
              Get AI Recommendations
            </Button>
          </CardContent>
        </Card>

        {/* Manual Search Card */}
        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50" onClick={() => setMatchingMode('player-search')}>
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Search by Player Name</CardTitle>
            <CardDescription className="text-center">Search and connect with specific players by name </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Search by name or email
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                View player profiles & stats
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Send match request
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => setMatchingMode('player-search')}>
              Search Players
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats - Recent Casual Matches */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {recentCasualMatches.length > 0 ? recentCasualMatches.map(match => {
        const result = getMatchResult(match);
        return <Card key={match.id} className={`${result.bgColor} border-2`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`${result.color} bg-transparent border-current`}>
                      {result.text}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(match.match_date), 'MMM d')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{getOpponentName(match)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Score: {match.player1_score || 0} - {match.player2_score || 0}
                  </div>
                </CardContent>
              </Card>;
      }) : <Card className="md:col-span-3">
            <CardContent className="p-6 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No casual matches played yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start by finding an opponent above!
              </p>
            </CardContent>
          </Card>}
      </div>
    </div>;
  const renderAIRecommendations = () => <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">AI-Recommended Matches</h2>
          <p className="text-muted-foreground">
            Intelligent opponent matching based on your profile preferences
          </p>
        </div>
        <Button variant="outline" onClick={() => setMatchingMode('selection')} className="shrink-0">
          Back to Options
        </Button>
      </div>
      
      <MatchSuggestions competitivenessFilter="casual" />

      {/* Unmatched Player Option */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 mb-1">Not finding enough matches?</h3>
              <p className="text-sm text-amber-700 mb-3">
                If we couldn't find enough matches based on your preferences, you have options.
              </p>
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => setShowUnmatchedDialog(true)}>
                Explore Alternatives
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>;
  const renderPlayerSearch = () => <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Search Players</h2>
          <p className="text-muted-foreground">
            Find and connect with specific players by searching their name
          </p>
        </div>
        <Button variant="outline" onClick={() => setMatchingMode('selection')} className="shrink-0">
          Back to Options
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Player Search
          </CardTitle>
          <CardDescription>
            Search for players and send match requests after selecting a calendar slot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlayerSearch onPlayerSelect={handlePlayerSelect} placeholder="Search by name or email..." className="max-w-md" />
          <div className="mt-4 text-sm text-muted-foreground">
            <p>💡 <strong>Tip:</strong> After finding a player, you can view their schedule and send a match request for an available time slot. Location can be added to the calendar entry.</p>
          </div>
        </CardContent>
      </Card>
    </div>;
  return <div className="space-y-6">
      {matchingMode === 'selection' && renderModeSelection()}
      {matchingMode === 'ai-recommendations' && renderAIRecommendations()}
      {matchingMode === 'player-search' && renderPlayerSearch()}

      {/* Player Schedule Modal */}
      <PlayerScheduleModal open={showScheduleModal} onClose={() => setShowScheduleModal(false)} player={selectedPlayer} />

      {/* Unmatched Player Dialog */}
      <Dialog open={showUnmatchedDialog} onOpenChange={setShowUnmatchedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Expand Your Options
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              We couldn't find enough matches based on your selected preferences. 
              Would you like to join a league outside your criteria?
            </p>
            
            <div className="space-y-3">
              <Button className="w-full" onClick={() => handleUnmatchedPlayerOption(true)}>
                Yes, place me in best available division
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleUnmatchedPlayerOption(false)}>
                No, I'll wait for a suitable division
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">What happens next:</p>
              <p>• <strong>Yes:</strong> We'll place you in the next compatible division and notify you when ready</p>
              <p>• <strong>No:</strong> You'll remain on waitlist until a division matching your preferences is available</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default MatchingTab;