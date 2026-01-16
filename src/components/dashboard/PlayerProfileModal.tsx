import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  User, 
  Trophy, 
  Calendar, 
  MapPin, 
  Mail, 
  Phone,
  Target,
  Flame,
  MessageCircle
} from 'lucide-react';
import { SearchResult } from '@/hooks/usePlayerSearch';
import { toast } from 'sonner';
import SendMessageModal from './SendMessageModal';
import { PlayerScheduleModal } from './PlayerScheduleModal';

interface PlayerProfileModalProps {
  player: SearchResult | null;
  isOpen: boolean;
  onClose: () => void;
}

const PlayerProfileModal = ({ player, isOpen, onClose }: PlayerProfileModalProps) => {
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [showScheduleMatch, setShowScheduleMatch] = useState(false);
  
  if (!player) return null;

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

  const getCompetitivenessLabel = (competitiveness?: string) => {
    switch (competitiveness) {
      case 'fun': return '🎾 Just for fun';
      case 'casual': return '😎 Casual but competitive';
      case 'competitive': return '🏆 Very competitive';
      default: return 'Not specified';
    }
  };

  const getAgeRangeLabel = (ageRange?: string) => {
    switch (ageRange) {
      case 'under-18': return 'Under 18';
      case '18-29': return '18-29';
      case '30-39': return '30-39';
      case '40-49': return '40-49';
      case '50-59': return '50-59';
      case '60-plus': return '60+';
      default: return 'Not specified';
    }
  };

  const totalMatches = player.wins + player.losses;
  const winRate = totalMatches > 0 ? Math.round((player.wins / totalMatches) * 100) : 0;

  const handleSendMessage = () => {
    setShowSendMessage(true);
  };

  const handleChallengeMatch = () => {
    setShowScheduleMatch(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xl">
              {player.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                {player.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Player profile details for {player.name}, including stats, contact information, and performance metrics.
              </DialogDescription>
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <Badge 
                  variant="outline" 
                  className={`${getSkillBadgeColor(player.skill_level)} text-xs sm:text-sm`}
                >
                  {getSkillLabel(player.skill_level)} • {player.skill_level}/10
                </Badge>
                {player.usta_rating && (
                  <Badge variant="secondary" className="text-xs sm:text-sm">
                    Level {player.usta_rating}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Card className="bg-gradient-primary/5 border-primary/20">
              <CardContent className="p-2 sm:p-4 text-center">
                <Trophy className="w-4 h-4 sm:w-6 sm:h-6 text-primary mx-auto mb-1 sm:mb-2" />
                <p className="text-lg sm:text-2xl font-bold text-foreground">{player.wins}</p>
                <p className="text-xs text-muted-foreground">Wins</p>
              </CardContent>
            </Card>
            
            <Card className="bg-accent/5 border-accent/20">
              <CardContent className="p-2 sm:p-4 text-center">
                <Target className="w-4 h-4 sm:w-6 sm:h-6 text-accent mx-auto mb-1 sm:mb-2" />
                <p className="text-lg sm:text-2xl font-bold text-foreground">{winRate}%</p>
                <p className="text-xs text-muted-foreground">Win Rate</p>
              </CardContent>
            </Card>
            
            <Card className="bg-muted/30 border-border">
              <CardContent className="p-2 sm:p-4 text-center">
                <Calendar className="w-4 h-4 sm:w-6 sm:h-6 text-muted-foreground mx-auto mb-1 sm:mb-2" />
                <p className="text-lg sm:text-2xl font-bold text-foreground">{totalMatches}</p>
                <p className="text-xs text-muted-foreground">Total Matches</p>
              </CardContent>
            </Card>
          </div>

          {/* Contact & Details */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5 text-primary" />
                <span>Player Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email</p>
                    <p className="text-sm text-muted-foreground">{player.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Age Range</p>
                    <p className="text-sm text-muted-foreground">{getAgeRangeLabel(player.age_range)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Flame className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Playing Style</p>
                    <p className="text-sm text-muted-foreground">{getCompetitivenessLabel(player.competitiveness)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Trophy className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Record</p>
                    <p className="text-sm text-muted-foreground">{player.wins}W - {player.losses}L</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Insights */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-accent" />
                <span>Performance Insights</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-medium text-foreground">Win Rate</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-primary rounded-full transition-all"
                        style={{ width: `${winRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground">{winRate}%</span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-medium text-foreground">Skill Level</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-secondary rounded-full transition-all"
                        style={{ width: `${(player.skill_level / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-foreground">{player.skill_level}/10</span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-medium text-foreground">Experience</span>
                  <Badge variant="outline" className="font-medium">
                    {totalMatches === 0 ? 'New Player' : 
                     totalMatches < 5 ? 'Getting Started' :
                     totalMatches < 15 ? 'Regular Player' : 'Experienced Player'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
            <Button 
              onClick={handleChallengeMatch}
              className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Send Match Request
            </Button>
            
            <Button 
              onClick={handleSendMessage}
              variant="outline" 
              className="w-full sm:flex-1"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Send Message
            </Button>
          </div>
        </div>

        {/* Send Message Modal */}
        <SendMessageModal 
          player={player}
          isOpen={showSendMessage}
          onClose={() => setShowSendMessage(false)}
        />

        {/* Schedule Match Modal */}
        <PlayerScheduleModal
          open={showScheduleMatch}
          onClose={() => setShowScheduleMatch(false)}
          player={player}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PlayerProfileModal;