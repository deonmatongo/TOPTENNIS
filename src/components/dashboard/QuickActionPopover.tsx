import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, X, Clock, MoreVertical } from 'lucide-react';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface QuickActionPopoverProps {
  invite: any;
  children: React.ReactNode;
}

export const QuickActionPopover = ({ invite, children }: QuickActionPopoverProps) => {
  const { respondToInvite, proposeNewTime } = useMatchInvites();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await respondToInvite(invite.id, 'accepted');
      toast.success('Match invite accepted!');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      await respondToInvite(invite.id, 'declined');
      toast.success('Match invite declined');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to decline invite');
    } finally {
      setLoading(false);
    }
  };

  const isExpiringSoon = () => {
    if (!invite.expires_at) return false;
    const expiryDate = new Date(invite.expires_at);
    const hoursUntilExpiry = (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  };

  const isExpired = () => {
    if (!invite.expires_at) return false;
    return new Date(invite.expires_at) < new Date();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Match Invite</h4>
              {isExpiringSoon() && (
                <Badge variant="destructive" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Expires Soon
                </Badge>
              )}
              {isExpired() && (
                <Badge variant="outline" className="text-xs">Expired</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(invite.date), 'MMM d, yyyy')} at {invite.start_time}
            </p>
            {invite.court_location && (
              <p className="text-xs text-muted-foreground">📍 {invite.court_location}</p>
            )}
            {invite.message && (
              <p className="text-xs italic mt-2">"{invite.message}"</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={handleAccept}
              disabled={loading || isExpired()}
            >
              <Check className="w-4 h-4 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                // Open full modal for proposing new time
              }}
              disabled={loading || isExpired()}
            >
              <Clock className="w-4 h-4 mr-1" />
              Propose
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDecline}
              disabled={loading || isExpired()}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {invite.expires_at && (
            <p className="text-xs text-muted-foreground text-center">
              Expires {format(new Date(invite.expires_at), 'MMM d, h:mm a')}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
