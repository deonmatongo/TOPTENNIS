import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import { format } from 'date-fns';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (courtLocation?: string, message?: string) => void;
  slot: {
    date: Date;
    startTime: string;
    endTime: string;
  };
  opponent: {
    name?: string;
    first_name?: string;
    last_name?: string;
    location?: string;
  };
  additionalSlots?: Array<{
    date: Date;
    startTime: string;
    endTime: string;
  }>;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  open,
  onClose,
  onConfirm,
  slot,
  opponent,
  additionalSlots = [],
}) => {
  const [courtLocation, setCourtLocation] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const opponentName = opponent.name || `${opponent.first_name || ''} ${opponent.last_name || ''}`.trim();
  const allSlots = [slot, ...additionalSlots];

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(courtLocation || undefined, message || undefined);
      // Reset form
      setCourtLocation('');
      setMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCourtLocation('');
    setMessage('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Book Match{allSlots.length > 1 ? 'es' : ''}
          </DialogTitle>
          <DialogDescription>
            Confirm your match booking{allSlots.length > 1 ? 's' : ''} with {opponentName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Booking Details */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Opponent:</span>
              <span>{opponentName}</span>
            </div>
            
            {allSlots.length === 1 ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Date:</span>
                  <span>{format(slot.date, 'EEEE, MMMM d, yyyy')}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Time:</span>
                  <span>{slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}</span>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{allSlots.length} Time Slots:</span>
                </div>
                <div className="ml-6 space-y-1 text-sm max-h-32 overflow-y-auto">
                  {allSlots.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span>{format(s.date, 'MMM d')} at {s.startTime.slice(0, 5)}-{s.endTime.slice(0, 5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {opponent.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Location:</span>
                <span>{opponent.location}</span>
              </div>
            )}
          </div>

          {/* Court Location */}
          <div className="space-y-2">
            <Label htmlFor="court-location" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Court Location (Optional)
            </Label>
            <Input
              id="court-location"
              placeholder="e.g., Central Park Courts, Court 3"
              value={courtLocation}
              onChange={(e) => setCourtLocation(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a message for your opponent..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
