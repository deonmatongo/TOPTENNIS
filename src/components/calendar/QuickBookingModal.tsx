import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, User } from 'lucide-react';

interface QuickBookingModalProps {
  open: boolean;
  onClose: () => void;
  availableUsers: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    profilePicture?: string;
    date: string;
    startTime: string;
    endTime: string;
  }>;
  selectedDate: Date;
  selectedHour: number;
}

export const QuickBookingModal: React.FC<QuickBookingModalProps> = ({
  open,
  onClose,
  availableUsers,
  selectedDate,
  selectedHour,
}) => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [courtLocation, setCourtLocation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !user) return;

    setLoading(true);

    try {
      const selectedUserData = availableUsers.find(u => u.userId === selectedUser);
      if (!selectedUserData) return;

      // Create match invite
      const { error } = await supabase.from('match_invites').insert({
        sender_id: user.id,
        receiver_id: selectedUser,
        date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: `${selectedHour.toString().padStart(2, '0')}:00`,
        end_time: `${(selectedHour + 1).toString().padStart(2, '0')}:00`,
        court_location: courtLocation,
        message: message,
        status: 'pending',
      });

      if (error) throw error;

      // Create notification
      await supabase.from('notifications').insert({
        user_id: selectedUser,
        type: 'match_invite',
        title: 'New Match Invitation',
        message: `${user.email} has invited you to play on ${format(selectedDate, 'MMM d, yyyy')} at ${selectedHour}:00`,
        action_url: '/dashboard?tab=matches',
      });

      toast.success('Match invitation sent successfully!');
      handleClose();
    } catch (error) {
      console.error('Error sending match invite:', error);
      toast.error('Failed to send match invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setCourtLocation('');
    setMessage('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book a Match</DialogTitle>
          <DialogDescription>
            Select a player and send them a match invitation
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Time slot info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {selectedHour.toString().padStart(2, '0')}:00 - {(selectedHour + 1).toString().padStart(2, '0')}:00
              </span>
            </div>
          </div>

          {/* Available users list */}
          <div className="space-y-2">
            <Label>Select Player</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
              {availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No players available at this time
                </p>
              ) : (
                availableUsers.map((availUser) => (
                  <button
                    key={availUser.userId}
                    type="button"
                    onClick={() => setSelectedUser(availUser.userId)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                      selectedUser === availUser.userId
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:bg-muted'
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={availUser.profilePicture} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{availUser.userName}</p>
                      <p className="text-xs text-muted-foreground">{availUser.userEmail}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Court location */}
          <div className="space-y-2">
            <Label htmlFor="court_location">
              <MapPin className="h-4 w-4 inline mr-1" />
              Court Location (Optional)
            </Label>
            <Input
              id="court_location"
              value={courtLocation}
              onChange={(e) => setCourtLocation(e.target.value)}
              placeholder="e.g., Central Park Tennis Courts"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message to your invitation..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selectedUser || loading}>
              {loading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
