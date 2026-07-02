import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar, Clock, MapPin, MessageCircle, User, Check, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useMatchInvitesContext } from '@/contexts/MatchInvitesContext';
import type { PlayerProfile } from '@/hooks/useMatchInvites';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import PlayerProfileModal from './PlayerProfileModal';

interface InviteData {
  id: string;
  sender_id: string;
  receiver_id: string;
  date: string;
  start_time: string;
  end_time: string;
  court_location?: string;
  message?: string;
  status: string;
  sender?: PlayerProfile & { [key: string]: any };
  receiver?: PlayerProfile & { [key: string]: any };
}

interface InviteResponseDialogProps {
  open: boolean;
  onClose: () => void;
  invite: InviteData | null;
}

export const InviteResponseDialog: React.FC<InviteResponseDialogProps> = ({
  open,
  onClose,
  invite,
}) => {
  const { respondToInvite } = useMatchInvitesContext();
  const { notifications, markAsRead } = useNotificationsContext();
  const [isResponding, setIsResponding] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  if (!invite) return null;

  const sender = invite.sender;
  const senderName = sender
    ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'Unknown Player'
    : 'Unknown Player';
  const senderInitials = sender
    ? `${sender.first_name?.charAt(0) ?? ''}${sender.last_name?.charAt(0) ?? ''}`.toUpperCase() || senderName.charAt(0).toUpperCase()
    : '?';

  const handleRespond = async (response: 'accepted' | 'declined') => {
    setIsResponding(true);
    try {
      // Mark related notifications as read
      const matchNotificationTypes = ['match_invite', 'match_rescheduled', 'match_accepted'];
      notifications
        .filter(n => !n.read && matchNotificationTypes.includes(n.type) && n.metadata?.match_id === invite.id)
        .forEach(n => markAsRead(n.id));

      await respondToInvite(invite.id, response);
      onClose();
    } catch (error) {
      console.error('Error responding to invite:', error);
    } finally {
      setIsResponding(false);
    }
  };

  const playerForModal = sender ? {
    id: sender.user_id || invite.sender_id,
    user_id: sender.user_id || invite.sender_id,
    name: senderName,
    email: sender.email || '',
    skill_level: sender.skill_level ?? 0,
    wins: sender.wins ?? 0,
    losses: sender.losses ?? 0,
    usta_rating: sender.usta_rating,
    competitiveness: sender.competitiveness,
    age_range: sender.age_range,
    gender: sender.gender,
    first_name: sender.first_name,
    last_name: sender.last_name,
  } : null;

  const getSkillLabel = (level?: number) => {
    if (!level) return 'Not rated';
    if (level >= 7) return 'Advanced';
    if (level >= 4) return 'Intermediate';
    return 'Beginner';
  };

  const getSkillColor = (level?: number) => {
    if (!level) return 'bg-gray-100 text-gray-800';
    if (level >= 8) return 'bg-red-100 text-red-800';
    if (level >= 6) return 'bg-orange-100 text-orange-800';
    if (level >= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  return (
    <>
      <Dialog open={open && !showProfile} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              Match Invitation
            </DialogTitle>
            <DialogDescription>
              You have a match invite — accept, decline, or view the sender's profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Sender Info */}
            {sender && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={sender.profile_picture_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                    {senderInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{senderName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {sender.skill_level !== undefined && (
                      <Badge variant="outline" className={`text-xs ${getSkillColor(sender.skill_level)}`}>
                        {getSkillLabel(sender.skill_level)} • {sender.skill_level}/10
                      </Badge>
                    )}
                    {sender.gender && (
                      <span className="text-xs text-muted-foreground capitalize">{sender.gender}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Match Details */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {format(parseISO(invite.date), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{invite.start_time?.slice(0, 5)} - {invite.end_time?.slice(0, 5)}</span>
              </div>
              {invite.court_location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{invite.court_location}</span>
                </div>
              )}
            </div>

            {/* Message */}
            {invite.message && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Message</span>
                </div>
                <p className="text-sm italic">"{invite.message}"</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={() => handleRespond('accepted')}
                disabled={isResponding}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                {isResponding ? 'Responding...' : 'Accept'}
              </Button>
              <Button
                onClick={() => handleRespond('declined')}
                disabled={isResponding}
                variant="outline"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Decline
              </Button>
              {sender && (
                <Button
                  onClick={() => setShowProfile(true)}
                  variant="outline"
                  className="flex-1"
                >
                  <User className="h-4 w-4 mr-2" />
                  View Profile
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Profile Modal */}
      {playerForModal && (
        <PlayerProfileModal
          player={playerForModal}
          isOpen={showProfile}
          onClose={() => setShowProfile(false)}
          pendingInvite={invite}
          onInviteResponded={() => { setShowProfile(false); onClose(); }}
        />
      )}
    </>
  );
};
