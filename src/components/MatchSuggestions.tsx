import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMatchSuggestions } from "@/hooks/useMatchSuggestions";
import { Users, Star, Trophy, Target, RefreshCw, UserCheck, UserX, Calendar } from "lucide-react";
import { toast } from "sonner";
import { PlayerScheduleModal } from './dashboard/PlayerScheduleModal';
import type { Tables } from '@/integrations/supabase/types';

interface MatchSuggestionsProps {
  competitivenessFilter?: string;
}

const MatchSuggestions = ({ competitivenessFilter }: MatchSuggestionsProps) => {
  const [selectedPlayer, setSelectedPlayer] = useState<Tables<'players'> | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  const { 
    suggestions, 
    loading, 
    error, 
    generateSuggestions, 
    updateSuggestionStatus 
  } = useMatchSuggestions(competitivenessFilter);

  const handleGenerateSuggestions = async () => {
    try {
      const count = await generateSuggestions();
      toast.success(`Generated ${count} new match suggestions!`);
    } catch (error) {
      toast.error('Failed to generate match suggestions');
    }
  };

  const handleViewSchedule = (player: Tables<'players'>) => {
    setSelectedPlayer(player);
    setShowScheduleModal(true);
  };

  const handleDeclineSuggestion = async (suggestionId: string) => {
    try {
      await updateSuggestionStatus(suggestionId, 'declined');
      toast.success('Match suggestion declined');
    } catch (error) {
      toast.error('Failed to decline suggestion');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getSkillLevelText = (level?: number) => {
    if (!level) return 'Unrated';
    if (level <= 3) return 'Beginner';
    if (level <= 7) return 'Intermediate';
    return 'Advanced';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Finding your perfect opponents...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={handleGenerateSuggestions}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-orange-600" />
              <CardTitle>Match Suggestions</CardTitle>
            </div>
            <Button 
              onClick={handleGenerateSuggestions}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate New Matches
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No match suggestions yet</p>
              <p className="text-sm text-gray-500 mb-4">
                Click "Generate New Matches" to find opponents at your level
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((suggestion) => (
                <Card key={suggestion.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {suggestion.suggested_player?.name || 'Unknown Player'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {suggestion.suggested_player?.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                          {suggestion.suggested_player?.skill_level || 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Skill Level</p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm">
                          {getSkillLevelText(suggestion.suggested_player?.skill_level)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        <span className="text-sm">
                          Record: {suggestion.suggested_player?.wins || 0}W - {suggestion.suggested_player?.losses || 0}L
                        </span>
                      </div>
                      
                      {suggestion.suggested_player?.competitiveness && (
                        <div className="flex items-center space-x-2">
                          <Trophy className="w-4 h-4 text-blue-500" />
                          <span className="text-sm capitalize">
                            {suggestion.suggested_player.competitiveness}
                          </span>
                        </div>
                      )}

                      {suggestion.suggested_player?.age_range && (
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-green-500" />
                          <span className="text-sm">
                            Age: {suggestion.suggested_player.age_range}
                          </span>
                        </div>
                      )}
                    </div>

                    {suggestion.match_reasons && suggestion.match_reasons.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Why it's a good match:</p>
                        <div className="flex flex-wrap gap-1">
                          {suggestion.match_reasons.map((reason, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {suggestion.status === 'pending' && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleViewSchedule(suggestion.suggested_player)}
                          className="flex-1 bg-primary hover:bg-primary/90"
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          View Schedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineSuggestion(suggestion.id)}
                          className="flex-1"
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    )}

                    {suggestion.status !== 'pending' && (
                       <Badge 
                         variant={suggestion.status === 'accepted' ? 'default' : 'secondary'}
                         className="w-full justify-center"
                       >
                         {suggestion.status === 'accepted' ? 'Challenge Sent' : 'Declined'}
                       </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PlayerScheduleModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        player={selectedPlayer}
      />
    </div>
  );
};

export default MatchSuggestions;
