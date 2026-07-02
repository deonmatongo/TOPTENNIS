import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, User, Check, X, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ProposeNewTimeModal } from './ProposeNewTimeModal';

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

interface PendingBookingCardProps {
  booking: MatchBooking;
  onAccept: (bookingId: string) => Promise<void>;
  onDecline: (bookingId: string) => Promise<void>;
}

export const PendingBookingCard: React.FC<PendingBookingCardProps> = ({
  booking,
  onAccept,
  onDecline,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(booking.id);
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
    <Card className="border-2 border-warning/50 bg-warning/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">
                {booking.booker?.first_name} {booking.booker?.last_name}
              </span>
              <span className="text-xs text-muted-foreground">
                wants to book a match
              </span>
            </div>

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
              variant="secondary"
              onClick={() => setShowProposeModal(true)}
              disabled={isAccepting || isDeclining}
              className="gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Propose New Time
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

      <ProposeNewTimeModal
        open={showProposeModal}
        onClose={() => setShowProposeModal(false)}
        booking={booking as any}
      />
    </Card>
  );
};
