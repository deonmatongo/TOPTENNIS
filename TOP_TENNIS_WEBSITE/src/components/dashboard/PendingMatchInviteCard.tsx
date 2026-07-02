import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, MapPin, Calendar, AlertCircle, X, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MatchWithResponse } from '@/hooks/useMatchResponses';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMatchInvitesContext } from '@/contexts/MatchInvitesContext';
import PlayerProfileModal from './PlayerProfileModal';

interface PendingMatchInviteCardProps {
  match: MatchWithResponse;
  onRespond: (match: MatchWithResponse) => void;
}

export const PendingMatchInviteCard = ({ match, onRespond }: PendingMatchInviteCardProps) => {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { cancelInvite } = useMatchInvitesContext();
  const matchDate = match.proposed_start ? parseISO(match.proposed_start) : parseISO(match.match_date);
  const isProposedTime = !!match.proposed_start;

  const opponent = match.opponent_profile;
  const opponentInitials = opponent
    ? `${opponent.first_name?.charAt(0) ?? ''}${opponent.last_name?.charAt(0) ?? ''}`.toUpperCase() || opponent.name.charAt(0).toUpperCase()
    : '?';

  const playerForModal = opponent ? {
    id: opponent.user_id,
    user_id: opponent.user_id,
    name: opponent.name,
    email: opponent.email ?? '',
    skill_level: opponent.skill_level ?? 0,
    wins: opponent.wins ?? 0,
    losses: opponent.losses ?? 0,
    usta_rating: opponent.usta_rating,
    competitiveness: opponent.competitiveness,
    age_range: opponent.age_range,
    networking_enabled: opponent.networking_enabled,
    first_name: opponent.first_name,
    last_name: opponent.last_name,
    gender: opponent.gender,
  } : null;

  const handleCancel = async () => {
    await cancelInvite(match.id, cancellationReason || undefined);
    setShowCancelDialog(false);
    setCancellationReason('');
  };
  
  const getStatusBadge = () => {
    if (match.invitation_status === 'confirmed') {
      return (
        <Badge className="bg-[hsl(var(--tennis-green-500))] text-white">
          ✓ Confirmed
        </Badge>
      );
    }
    
    if (match.invitation_status === 'rescheduled') {
      return (
        <Badge className="bg-[hsl(var(--tennis-blue-500))] text-white">
          <Clock className="h-3 w-3 mr-1" />
          Time Proposed
        </Badge>
      );
    }

    if (match.my_response?.response === 'accepted') {
      return <Badge variant="secondary">Awaiting Response</Badge>;
    }

    return (
      <Badge variant="default" className="bg-primary">
        <AlertCircle className="h-3 w-3 mr-1" />
        Needs Response
      </Badge>
    );
  };

  const needsResponse = () => {
    if (match.invitation_status === 'confirmed') return false;
    if (match.my_response?.response === 'declined') return false;
    if (match.my_response?.response === 'pending' || !match.my_response) return true;
    if (match.invitation_status === 'rescheduled' && match.my_response?.response !== 'proposed') return true;
    return false;
  };

  return (
    <>
      <Card className="overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          {/* Opponent header row */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={opponent?.profile_picture_url} alt={opponent?.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {opponentInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">
                vs {opponent?.name || match.player1?.name || match.player2?.name}
              </p>
              {opponent?.skill_level && (
                <p className="text-xs text-muted-foreground">
                  Skill {opponent.skill_level}/10
                  {opponent.usta_rating ? ` · USTA ${opponent.usta_rating}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {getStatusBadge()}
              {opponent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProfileModal(true)}
                  className="h-6 px-2 text-xs text-primary hover:text-primary/80 gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Profile
                </Button>
              )}
            </div>
          </div>

          {/* Match details */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{format(matchDate, 'EEE, MMM d')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{format(matchDate, 'HH:mm')}</span>
              </div>
            </div>
            
            {match.court_location && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{match.court_location}</span>
              </div>
            )}
            {isProposedTime && (
              <span className="text-xs text-muted-foreground">
                Reschedule attempt {match.reschedule_count}/3
              </span>
            )}
          </div>

          {isProposedTime && (
            <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-900">
              <p className="text-xs text-blue-900 dark:text-blue-300">
                <Clock className="h-3 w-3 inline mr-1" />
                New time proposed for this match
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            {needsResponse() && (
              <Button
                onClick={() => onRespond(match)}
                className="flex-1"
                size="sm"
              >
                Respond to Invitation
              </Button>
            )}
            <Button
              onClick={() => setShowCancelDialog(true)}
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Match Invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this match invitation? The other player will be notified of the cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancellation-reason" className="text-sm font-medium">
              Reason for cancellation (optional)
            </Label>
            <Textarea
              id="cancellation-reason"
              placeholder="Let the other player know why you're canceling..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancellationReason('')}>No, keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, cancel invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {playerForModal && (
        <PlayerProfileModal
          player={playerForModal}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  );
};
