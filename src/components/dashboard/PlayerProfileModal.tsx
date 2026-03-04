import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  User, 
  Trophy, 
  Calendar, 
  MapPin, 
  Mail, 
  Phone,
  Target,
  Flame,
  MessageCircle,
  Ban,
  UserMinus,
  ShieldAlert
} from 'lucide-react';
import { SearchResult } from '@/hooks/usePlayerSearch';
import { toast } from 'sonner';
import SendMessageModal from './SendMessageModal';
import { PlayerScheduleModal } from './PlayerScheduleModal';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useAuth } from '@/contexts/AuthContext';

interface PlayerProfileModalProps {
  player: SearchResult | null;
  isOpen: boolean;
  onClose: () => void;
}

const PlayerProfileModal = ({ player, isOpen, onClose }: PlayerProfileModalProps) => {
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [showScheduleMatch, setShowScheduleMatch] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnfriendDialog, setShowUnfriendDialog] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);
  const { user } = useAuth();
  const { sendFriendRequest, updateRequestStatus, getRelationshipWith, requests, refetch: refetchFriends } = useFriendRequests();
  const { blockUser, unfriendUser } = useBlockedUsers();
  
  if (!player) return null;

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

  const getGenderLabel = (gender?: string | null) => {
    switch (gender?.toLowerCase()) {
      case 'male': return 'Male';
      case 'female': return 'Female';
      case 'other': return 'Other';
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

  const otherUserId = player.user_id;
  const relationship = getRelationshipWith(otherUserId);
  const incomingRequest = requests.find(r => r.status === 'pending' && r.sender_id === otherUserId && r.receiver_id === user?.id);

  const handleBlockConfirm = async () => {
    if (!player?.user_id || player?.user_id === user?.id) return;
    setIsActioning(true);
    try {
      await blockUser(player.user_id, blockReason.trim() || undefined);
      setShowBlockDialog(false);
      setBlockReason('');
      onClose();
    } catch (error) {
      toast.error('Failed to block user');
    } finally {
      setIsActioning(false);
    }
  };

  const handleUnfriendConfirm = async () => {
    if (!player?.user_id) return;
    setIsActioning(true);
    try {
      await unfriendUser(player.user_id);
      await refetchFriends();
      setShowUnfriendDialog(false);
      onClose();
    } catch (error) {
      toast.error('Failed to remove friend');
    } finally {
      setIsActioning(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!otherUserId) {
      toast.error('This player cannot receive friend requests');
      return;
    }
    try {
      await sendFriendRequest(otherUserId);
      toast.success('Friend request sent');
    } catch (e) {
      toast.error('Failed to send friend request');
    }
  };

  const handleRespondToRequest = async (status: 'accepted' | 'declined') => {
    if (!incomingRequest) return;
    try {
      await updateRequestStatus(incomingRequest.id, status);
      toast.success(status === 'accepted' ? 'Friend request accepted' : 'Friend request declined');
    } catch (e) {
      toast.error('Failed to update friend request');
    }
  };

  return (
    <>
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
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Gender</p>
                    <p className="text-sm text-muted-foreground">{getGenderLabel(player.gender)}</p>
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
          <div className="space-y-3 pt-2">
            {/* Primary actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleChallengeMatch}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Calendar className="w-4 h-4 mr-2 shrink-0" />
                Match Request
              </Button>
              <Button
                onClick={handleSendMessage}
                variant="outline"
              >
                <MessageCircle className="w-4 h-4 mr-2 shrink-0" />
                Send Message
              </Button>
            </div>

            {/* Friend / relationship action */}
            {relationship === 'friends' ? (
              <Button
                variant="outline"
                className="w-full text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
                onClick={() => setShowUnfriendDialog(true)}
              >
                <UserMinus className="w-4 h-4 mr-2 shrink-0" />
                Remove Friend
              </Button>
            ) : relationship === 'pending_sent' ? (
              <Button variant="secondary" className="w-full" disabled>
                Friend Request Sent
              </Button>
            ) : relationship === 'pending_received' ? (
              <div className="grid grid-cols-2 gap-3">
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleRespondToRequest('accepted')}>
                  Accept Friend Request
                </Button>
                <Button variant="outline" onClick={() => handleRespondToRequest('declined')}>
                  Decline
                </Button>
              </div>
            ) : otherUserId && otherUserId !== user?.id ? (
              <Button
                onClick={handleSendFriendRequest}
                variant="outline"
                className="w-full"
              >
                Send a friend request
              </Button>
            ) : null}

            {/* Destructive action — visually separated */}
            {player?.user_id !== user?.id && (
              <div className="pt-1 border-t">
                <Button
                  onClick={() => setShowBlockDialog(true)}
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Ban className="w-4 h-4 mr-2 shrink-0" />
                  Block User
                </Button>
              </div>
            )}
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
          onInviteSent={() => {
            setShowScheduleMatch(false);
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>

    {/* Block User Confirmation Dialog */}
    <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-5 h-5" />
            Block {player?.name}?
          </DialogTitle>
          <DialogDescription>
            Blocking this user will prevent them from sending you match requests, messages, or viewing your profile. They will also be removed from your search results and match suggestions.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <Label htmlFor="block-reason" className="text-sm font-medium">Reason (optional)</Label>
          <Textarea
            id="block-reason"
            placeholder="Let us know why you're blocking this user..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setShowBlockDialog(false); setBlockReason(''); }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleBlockConfirm}
            disabled={isActioning}
          >
            <Ban className="w-4 h-4 mr-2" />
            {isActioning ? 'Blocking...' : 'Block User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Unfriend Confirmation Dialog */}
    <Dialog open={showUnfriendDialog} onOpenChange={setShowUnfriendDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <UserMinus className="w-5 h-5" />
            Remove {player?.name} from network?
          </DialogTitle>
          <DialogDescription>
            This will remove your connection with {player?.name}. They won't be notified, and you can send a new friend request in the future.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowUnfriendDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
            onClick={handleUnfriendConfirm}
            disabled={isActioning}
          >
            <UserMinus className="w-4 h-4 mr-2" />
            {isActioning ? 'Removing...' : 'Remove Friend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default PlayerProfileModal;