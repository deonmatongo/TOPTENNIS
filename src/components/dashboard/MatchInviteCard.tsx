import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, User, CheckCircle, XCircle, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';

interface MatchInviteCardProps {
  invite: {
    id: string;
    sender?: {
      first_name: string;
      last_name: string;
    };
    receiver?: {
      first_name: string;
      last_name: string;
    };
    date: string;
    start_time: string;
    end_time: string;
    court_location?: string;
    message?: string;
    status: string;
    home_away_indicator?: string;
    sender_id: string;
  };
  currentUserId: string;
  onAccept: (inviteId: string) => void;
  onDecline: (inviteId: string) => void;
  onProposeNewTime?: (senderId: string) => void;
}

const MatchInviteCard: React.FC<MatchInviteCardProps> = ({
  invite,
  currentUserId,
  onAccept,
  onDecline,
  onProposeNewTime,
}) => {
  const [loading, setLoading] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const isReceiver = invite.sender_id !== currentUserId;
  const isPending = invite.status === 'pending';
  
  const opponentName = isReceiver
    ? `${invite.sender?.first_name} ${invite.sender?.last_name}`
    : `${invite.receiver?.first_name} ${invite.receiver?.last_name}`;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await onAccept(invite.id);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setShowDeclineDialog(true);
  };

  const confirmDecline = async () => {
    setLoading(true);
    try {
      await onDecline(invite.id);
      setShowDeclineDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleProposeNewTime = () => {
    setShowDeclineDialog(false);
    if (onProposeNewTime) {
      onProposeNewTime(invite.sender_id);
    }
  };

  const getStatusBadge = () => {
    switch (invite.status) {
      case 'accepted':
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            Pending Response
          </Badge>
        );
    }
  };

  return (
    <>
      <Card className={isPending && isReceiver ? 'border-orange-400 shadow-md' : ''}>
        <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h4 className="font-semibold">
                {isReceiver ? 'Match Invite from' : 'Match Invite to'} {opponentName}
              </h4>
              {getStatusBadge()}
            </div>
            {invite.home_away_indicator && (
              <Badge variant="outline" className="text-xs">
                {invite.home_away_indicator} Game
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(invite.date), 'MMMM dd, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                {invite.start_time} - {invite.end_time}
              </span>
            </div>
            {invite.court_location && (
              <div className="flex items-center gap-2 text-muted-foreground md:col-span-2">
                <MapPin className="w-4 h-4" />
                <span>{invite.court_location}</span>
              </div>
            )}
          </div>

          {invite.message && (
            <div className="p-3 bg-muted/50 rounded-md text-sm">
              <p className="text-muted-foreground italic">"{invite.message}"</p>
            </div>
          )}

          {isPending && isReceiver && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAccept}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept Match
              </Button>
              <Button
                onClick={handleDecline}
                disabled={loading}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Decline
              </Button>
            </div>
          )}

          {isPending && !isReceiver && (
            <div className="text-sm text-muted-foreground text-center py-2">
              Waiting for {opponentName} to respond...
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Decline Confirmation Dialog */}
    <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decline Match Invite</DialogTitle>
          <DialogDescription>
            Would you like to propose another time instead?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Current Invite:</p>
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(invite.date), 'MMMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4" />
                <span>{invite.start_time} - {invite.end_time}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDeclineDialog(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleProposeNewTime}
            className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10"
          >
            <CalendarPlus className="w-4 h-4 mr-2" />
            Propose Another Time
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDecline}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default MatchInviteCard;
