import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Check, X, Clock, MapPin, User, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { MatchWithResponse } from '@/hooks/useMatchResponses';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface MatchResponseModalProps {
  open: boolean;
  onClose: () => void;
  match: MatchWithResponse | null;
  onRespond: (action: 'accept' | 'decline' | 'propose', proposedStart?: Date, proposedEnd?: Date, comment?: string) => void;
}

export const MatchResponseModal = ({ open, onClose, match, onRespond }: MatchResponseModalProps) => {
  const [action, setAction] = useState<'accept' | 'decline' | 'propose' | null>(null);
  const [proposedDate, setProposedDate] = useState<Date | undefined>(undefined);
  const [proposedStartTime, setProposedStartTime] = useState('09:00');
  const [proposedEndTime, setProposedEndTime] = useState('10:30');
  const [comment, setComment] = useState('');

  if (!match) return null;

  const matchDate = match.proposed_start ? parseISO(match.proposed_start) : parseISO(match.match_date);
  const isProposedTime = !!match.proposed_start;
  
  const handleSubmit = () => {
    if (action === 'propose') {
      if (!proposedDate) {
        return;
      }
      
      const startDateTime = new Date(proposedDate);
      const [startHour, startMinute] = proposedStartTime.split(':');
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute));
      
      const endDateTime = new Date(proposedDate);
      const [endHour, endMinute] = proposedEndTime.split(':');
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute));
      
      onRespond(action, startDateTime, endDateTime, comment || undefined);
    } else if (action) {
      onRespond(action, undefined, undefined, comment || undefined);
    }
    
    // Reset form
    setAction(null);
    setComment('');
    setProposedDate(undefined);
    setProposedStartTime('09:00');
    setProposedEndTime('10:30');
    onClose();
  };

  const getOpponentName = () => {
    // This will be determined from the match data directly
    return match.player1?.name || match.player2?.name || 'Opponent';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isProposedTime ? 'Reschedule Request' : 'Match Invitation'}
          </DialogTitle>
          <DialogDescription>
            {isProposedTime 
              ? 'Your opponent has proposed a new time for this match'
              : 'You have been invited to play a match'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Match Details */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">vs {match.player1?.name || match.player2?.name}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{format(matchDate, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{format(matchDate, 'HH:mm')}</span>
            </div>
            
            {match.court_location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{match.court_location}</span>
              </div>
            )}

            {isProposedTime && (
              <Badge variant="secondary" className="mt-2">
                <Clock className="h-3 w-3 mr-1" />
                Reschedule Request #{match.reschedule_count}
              </Badge>
            )}
          </div>

          {/* Action Selection */}
          {!action && (
            <div className="space-y-2">
              <Label>Choose your response:</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction('accept')}
                  className="flex-col h-auto py-4 gap-2"
                >
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-xs">Accept</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setAction('propose')}
                  className="flex-col h-auto py-4 gap-2"
                  disabled={match.reschedule_count >= 3}
                >
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="text-xs">Propose New Time</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setAction('decline')}
                  className="flex-col h-auto py-4 gap-2"
                >
                  <X className="h-5 w-5 text-red-600" />
                  <span className="text-xs">Decline</span>
                </Button>
              </div>
              {match.reschedule_count >= 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  Maximum reschedule attempts reached
                </p>
              )}
            </div>
          )}

          {/* Propose New Time Form */}
          {action === 'propose' && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label>Select New Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {proposedDate ? format(proposedDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={proposedDate}
                      onSelect={setProposedDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={proposedStartTime}
                    onChange={(e) => setProposedStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={proposedEndTime}
                    onChange={(e) => setProposedEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional Comment */}
          {action && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="comment">Add a message (optional)</Label>
              <Textarea
                id="comment"
                placeholder="Add any additional notes..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Action Buttons */}
          {action && (
            <div className="flex gap-2 justify-end border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setAction(null);
                  setComment('');
                  setProposedDate(undefined);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={action === 'propose' && !proposedDate}
              >
                Confirm {action === 'accept' ? 'Accept' : action === 'decline' ? 'Decline' : 'Proposal'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
