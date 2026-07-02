import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, Check, X, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
type MatchBooking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  court_location?: string | null;
  message?: string | null;
  status?: string;
  booker_id?: string;
  opponent_id?: string;
  booker?: any;
  opponent?: any;
  proposed_date?: string | null;
  proposed_start_time?: string | null;
  proposed_end_time?: string | null;
};

interface ProposedTimeCardProps {
  booking: MatchBooking;
  onAcceptProposed: (bookingId: string) => Promise<void>;
  onDecline: (bookingId: string) => Promise<void>;
}

export const ProposedTimeCard: React.FC<ProposedTimeCardProps> = ({
  booking,
  onAcceptProposed,
  onDecline,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAcceptProposed(booking.id);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await onDecline(booking.id);
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <Card className="border-2 border-accent/50 bg-accent/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">
                {booking.opponent?.first_name} {booking.opponent?.last_name}
              </span>
              <Badge variant="secondary" className="ml-2">
                Proposed New Time
              </Badge>
            </div>

            {/* Original Time */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground uppercase">Original Request</p>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>
                  {booking.start_time} - {booking.end_time}
                </span>
              </div>
            </div>

            {/* Arrow indicator */}
            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-accent" />
            </div>

            {/* Proposed Time */}
            {booking.proposed_date && (
              <div className="space-y-2 p-3 bg-accent/10 rounded-lg border border-accent/30">
                <p className="text-xs font-medium text-accent uppercase">Proposed Time</p>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span className="font-medium">
                    {format(new Date(booking.proposed_date), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="font-medium">
                    {booking.proposed_start_time} - {booking.proposed_end_time}
                  </span>
                </div>
              </div>
            )}

            {booking.court_location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{booking.court_location}</span>
              </div>
            )}

            {booking.message && (
              <div className="text-sm text-muted-foreground mt-2 p-3 bg-muted/50 rounded">
                <p className="italic">"{booking.message}"</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={isAccepting || isDeclining}
              className="gap-2"
            >
              {isAccepting ? (
                'Accepting...'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Accept
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDecline}
              disabled={isAccepting || isDeclining}
              className="gap-2"
            >
              {isDeclining ? (
                'Declining...'
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Decline
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
