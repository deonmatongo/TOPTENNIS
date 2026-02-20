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
      email: string;
    } & {
      skill_level?: number | null;
      usta_rating?: string | null;
      wins?: number | null;
      losses?: number | null;
      competitiveness?: string | null;
      age_range?: string | null;
      city?: string | null;
    };
    receiver?: {
      first_name: string;
      last_name: string;
      email: string;
    } & {
      skill_level?: number | null;
      usta_rating?: string | null;
      wins?: number | null;
      losses?: number | null;
      competitiveness?: string | null;
      age_range?: string | null;
      city?: string | null;
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
  
  const opponent = isReceiver ? invite.sender : invite.receiver;
  const opponentName = `${opponent?.first_name || ''} ${opponent?.last_name || ''}`.trim() || 'Opponent';

  const getSkillBadgeColor = (skillLevel?: number | null) => {
    if (!skillLevel) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (skillLevel >= 8) return 'bg-red-100 text-red-800 border-red-200';
    if (skillLevel >= 6) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (skillLevel >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getSkillLabel = (skillLevel?: number | null) => {
    if (!skillLevel) return 'Not rated';
    if (skillLevel >= 7) return 'Advanced';
    if (skillLevel >= 4) return 'Intermediate';
    return 'Beginner';
  };

  const getCompetitivenessLabel = (competitiveness?: string | null) => {
    switch (competitiveness) {
      case 'fun': return '🎾 Just for fun';
      case 'casual': return '😎 Casual but competitive';
      case 'competitive': return '🏆 Very competitive';
      default: return 'Not specified';
    }
  };

  const getAgeRangeLabel = (ageRange?: string | null) => {
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

  const totalMatches = (opponent?.wins || 0) + (opponent?.losses || 0);
  const winRate = totalMatches > 0 ? Math.round(((opponent?.wins || 0) / totalMatches) * 100) : 0;

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

          {/* Player Profile Information */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                variant="outline" 
                className={`${getSkillBadgeColor(opponent?.skill_level)} text-xs`}
              >
                {getSkillLabel(opponent?.skill_level)} • {opponent?.skill_level || '?'}/10
              </Badge>
              {opponent?.usta_rating && (
                <Badge variant="secondary" className="text-xs">
                  USTA {opponent.usta_rating}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {totalMatches} matches • {winRate}% win rate
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Style:</span> {getCompetitivenessLabel(opponent?.competitiveness)}
              </div>
              <div>
                <span className="font-medium">Age:</span> {getAgeRangeLabel(opponent?.age_range)}
              </div>
              {opponent?.city && (
                <div className="sm:col-span-2">
                  <span className="font-medium">Location:</span> {opponent.city}
                </div>
              )}
            </div>
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
