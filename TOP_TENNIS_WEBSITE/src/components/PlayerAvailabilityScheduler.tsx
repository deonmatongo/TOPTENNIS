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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, User, Calendar as CalendarIcon } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { usePlayerAvailability } from '@/hooks/usePlayerAvailability';
import { useMatches } from '@/hooks/useMatches';
import { SearchResult } from '@/hooks/usePlayerSearch';
import { toast } from 'sonner';

interface PlayerAvailabilitySchedulerProps {
  open: boolean;
  onClose: () => void;
  player: SearchResult;
}

export const PlayerAvailabilityScheduler = ({ 
  open, 
  onClose, 
  player 
}: PlayerAvailabilitySchedulerProps) => {
  const { availability, loading } = usePlayerAvailability(player.user_id);
  const { createMatch } = useMatches();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [courtLocation, setCourtLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const availableDates = availability.map(slot => parseISO(slot.date));
  const availableSlotsForDate = selectedDate 
    ? availability.filter(slot => isSameDay(parseISO(slot.date), selectedDate))
    : [];

  const handleSlotSelect = (slot: any) => {
    setSelectedSlot(slot);
  };

  const handleScheduleMatch = async () => {
    if (!selectedSlot || !courtLocation.trim()) {
      toast.error('Please select a time slot and court location');
      return;
    }

    setSubmitting(true);
    try {
      const matchDateTime = `${selectedSlot.date}T${selectedSlot.start_time}`;
      await createMatch({
        player2_id: player.id,
        match_date: matchDateTime,
        court_location: courtLocation.trim()
      });
      
      toast.success('Match scheduled successfully!');
      onClose();
      setSelectedDate(undefined);
      setSelectedSlot(null);
      setCourtLocation('');
    } catch (error) {
      console.error('Error scheduling match:', error);
      toast.error('Failed to schedule match');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setCourtLocation('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span>Schedule Match with {player.name}</span>
          </DialogTitle>
          <DialogDescription>
            Select an available time slot from {player.name}'s calendar to schedule your match.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-muted-foreground">Loading availability...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendar */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today || !availableDates.some(availableDate => 
                        isSameDay(availableDate, date)
                      );
                    }}
                    modifiers={{
                      available: availableDates
                    }}
                    modifiersStyles={{
                      available: {
                        backgroundColor: 'hsl(var(--primary))',
                        color: 'hsl(var(--primary-foreground))',
                        fontWeight: 'bold'
                      }
                    }}
                    className="rounded-md border w-full"
                  />
                  <div className="mt-4 flex items-center space-x-2 text-sm text-muted-foreground">
                    <div className="w-3 h-3 bg-primary rounded"></div>
                    <span>Available dates</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Time Slots */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Available Time Slots
                    {selectedDate && (
                      <Badge variant="outline" className="ml-2">
                        {format(selectedDate, 'MMM d, yyyy')}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedDate ? (
                    <p className="text-muted-foreground text-center py-8">
                      Select a date to view available time slots
                    </p>
                  ) : availableSlotsForDate.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No available slots for this date
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableSlotsForDate.map((slot) => (
                        <Button
                          key={slot.id}
                          variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                          className="w-full justify-start h-auto p-3"
                          onClick={() => handleSlotSelect(slot)}
                        >
                          <div className="flex items-center space-x-3 w-full">
                            <Clock className="w-4 h-4" />
                            <div className="flex-1 text-left">
                              <div className="font-medium">
                                {format(parseISO(`2000-01-01T${slot.start_time}`), 'h:mm a')} - 
                                {format(parseISO(`2000-01-01T${slot.end_time}`), 'h:mm a')}
                              </div>
                              {slot.notes && (
                                <div className="text-sm text-muted-foreground">
                                  {slot.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedSlot && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Match Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Playing with {player.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(parseISO(`2000-01-01T${selectedSlot.start_time}`), 'h:mm a')} - 
                          {format(parseISO(`2000-01-01T${selectedSlot.end_time}`), 'h:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="court_location">Court Location *</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="court_location"
                          value={courtLocation}
                          onChange={(e) => setCourtLocation(e.target.value)}
                          placeholder="e.g., Central Tennis Club - Court 1"
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleScheduleMatch}
            disabled={!selectedSlot || !courtLocation.trim() || submitting}
          >
            {submitting ? 'Scheduling...' : 'Schedule Match'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};