import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMatchBookings } from '@/hooks/useMatchBookings';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { Calendar, Clock, MapPin, User, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface MatchInvitationModalProps {
  open: boolean;
  onClose: () => void;
  opponent?: {
    user_id: string;
    name: string;
  };
  prefilledDate?: string;
  prefilledStartTime?: string;
  prefilledEndTime?: string;
}

export const MatchInvitationModal = ({
  open,
  onClose,
  opponent,
  prefilledDate,
  prefilledStartTime,
  prefilledEndTime,
}: MatchInvitationModalProps) => {
  const { createBooking } = useMatchBookings();
  const { checkConflict } = useConflictDetection();
  const [loading, setLoading] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);

  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    court_location: '',
    message: '',
    home_away_indicator: 'home' as 'home' | 'away',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        date: prefilledDate || '',
        start_time: prefilledStartTime || '',
        end_time: prefilledEndTime || '',
        court_location: '',
        message: '',
        home_away_indicator: 'home',
      });
    }
  }, [open, prefilledDate, prefilledStartTime, prefilledEndTime]);

  useEffect(() => {
    if (formData.date && formData.start_time && formData.end_time) {
      const checkForConflicts = async () => {
        const conflict = await checkConflict({
          date: formData.date,
          startTime: formData.start_time,
          endTime: formData.end_time,
        });
        setHasConflict(conflict);
      };
      checkForConflicts();
    }
  }, [formData.date, formData.start_time, formData.end_time]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!opponent) {
      toast.error('No opponent selected');
      return;
    }

    setLoading(true);

    try {
      await createBooking({
        opponent_id: opponent.user_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        court_location: formData.court_location,
        message: formData.message,
      });

      toast.success(`Match invitation sent to ${opponent.name}`);
      onClose();
    } catch (error) {
      console.error('Error sending match invitation:', error);
      toast.error('Failed to send match invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to Match</DialogTitle>
          <DialogDescription>
            {opponent ? `Send a match invitation to ${opponent.name}` : 'Select an opponent first'}
          </DialogDescription>
        </DialogHeader>

        {opponent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Start Time
                </Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>

            {hasConflict && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have a conflict at this time. Please choose a different time slot.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="home_away">Home/Away</Label>
              <Select
                value={formData.home_away_indicator}
                onValueChange={(value: 'home' | 'away') => setFormData({ ...formData, home_away_indicator: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home (I host)</SelectItem>
                  <SelectItem value="away">Away (Opponent hosts)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="court_location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Court Location
              </Label>
              <Input
                id="court_location"
                value={formData.court_location}
                onChange={(e) => setFormData({ ...formData, court_location: e.target.value })}
                placeholder="Enter court location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message (Optional)</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Add a message to your invitation..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || hasConflict}>
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="text-center py-8">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No opponent selected</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
