import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, User, Calendar, AlertCircle, X } from 'lucide-react';
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
import { useMatchInvites } from '@/hooks/useMatchInvites';

interface PendingMatchInviteCardProps {
  match: MatchWithResponse;
  onRespond: (match: MatchWithResponse) => void;
}

export const PendingMatchInviteCard = ({ match, onRespond }: PendingMatchInviteCardProps) => {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const { cancelInvite } = useMatchInvites();
  const matchDate = match.proposed_start ? parseISO(match.proposed_start) : parseISO(match.match_date);
  const isProposedTime = !!match.proposed_start;

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
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">
                  vs {match.player1?.name || match.player2?.name}
                </span>
              </div>
              
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
            </div>
            
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge()}
              {isProposedTime && (
                <span className="text-xs text-muted-foreground">
                  Attempt {match.reschedule_count}/3
                </span>
              )}
            </div>
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
    </>
  );
};
