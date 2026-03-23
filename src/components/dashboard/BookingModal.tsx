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
import { Calendar, Clock, MapPin, User, Users } from 'lucide-react';
import { format } from 'date-fns';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (courtLocation?: string, message?: string, additionalMemberIds?: string[]) => void;
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
  groupMembers?: { user_id: string; name: string }[];
  onCancelAll?: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  open,
  onClose,
  onConfirm,
  slot,
  opponent,
  additionalSlots = [],
  groupMembers,
  onCancelAll,
}) => {
  const [courtLocation, setCourtLocation] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  const toggleMember = (uid: string) =>
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  const opponentName = opponent.name || `${opponent.first_name || ''} ${opponent.last_name || ''}`.trim();
  const allSlots = [slot, ...additionalSlots];

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(
        courtLocation || undefined,
        message || undefined,
        selectedMemberIds.size > 0 ? Array.from(selectedMemberIds) : undefined,
      );
      // Reset form
      setCourtLocation('');
      setMessage('');
      setSelectedMemberIds(new Set());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCourtLocation('');
    setMessage('');
    setSelectedMemberIds(new Set());
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

          {/* Invite group members */}
          {groupMembers && groupMembers.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Also Invite Group Members (Optional)
              </Label>
              <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                {groupMembers.map(m => {
                  const checked = selectedMemberIds.has(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => toggleMember(m.user_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${checked ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                        {checked && <span className="text-primary-foreground text-[10px] font-bold leading-none">✓</span>}
                      </div>
                      <span className="text-sm font-medium">{m.name}</span>
                    </button>
                  );
                })}
              </div>
              {selectedMemberIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedMemberIds.size} member{selectedMemberIds.size !== 1 ? 's' : ''} will receive an invite for the same time slot.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col items-stretch sm:items-end">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Back
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </div>
          {onCancelAll && (
            <button
              type="button"
              onClick={onCancelAll}
              disabled={isSubmitting}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors self-center mt-1"
            >
              Cancel match request
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
