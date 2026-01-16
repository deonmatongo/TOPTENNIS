import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { downloadICS, generateGoogleCalendarUrl, generateOutlookUrl } from '@/utils/calendarExport';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface CalendarExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CalendarExportDialog = ({
  open,
  onClose,
}: CalendarExportDialogProps) => {
  const { availability } = useUserAvailability();
  const { invites } = useMatchInvites();
  const [includeAvailability, setIncludeAvailability] = useState(true);
  const [includeMatches, setIncludeMatches] = useState(true);

  const handleExportICS = () => {
    const events = [];

    if (includeAvailability) {
      availability
        .filter(a => a.is_available && !a.is_blocked)
        .forEach(avail => {
          const startDate = new Date(`${avail.date}T${avail.start_time}`);
          const endDate = new Date(`${avail.date}T${avail.end_time}`);
          
          events.push({
            title: 'Tennis Availability',
            startDate,
            endDate,
            description: avail.notes || 'Available for tennis matches',
            status: 'CONFIRMED',
          });
        });
    }

    if (includeMatches) {
      invites
        .filter(i => i.status === 'accepted' || i.status === 'confirmed')
        .forEach(invite => {
          const startDate = new Date(`${invite.date}T${invite.start_time}`);
          const endDate = new Date(`${invite.date}T${invite.end_time}`);
          
          events.push({
            title: 'Tennis Match',
            startDate,
            endDate,
            location: invite.court_location || undefined,
            description: invite.message || 'Tennis match',
            status: invite.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE',
          });
        });
    }

    if (events.length === 0) {
      toast.error('No events to export');
      return;
    }

    downloadICS(events);
    toast.success(`Exported ${events.length} events to iCal format`);
    onClose();
  };

  const handleGoogleCalendar = () => {
    const matches = invites.filter(i => i.status === 'accepted' || i.status === 'confirmed');
    
    if (matches.length === 0) {
      toast.error('No confirmed matches to add');
      return;
    }

    matches.forEach(invite => {
      const startDate = new Date(`${invite.date}T${invite.start_time}`);
      const endDate = new Date(`${invite.date}T${invite.end_time}`);
      
      const url = generateGoogleCalendarUrl({
        title: 'Tennis Match',
        startDate,
        endDate,
        location: invite.court_location,
        description: invite.message,
      });
      
      window.open(url, '_blank');
    });

    toast.success('Opening Google Calendar for each match');
    onClose();
  };

  const handleOutlook = () => {
    const matches = invites.filter(i => i.status === 'accepted' || i.status === 'confirmed');
    
    if (matches.length === 0) {
      toast.error('No confirmed matches to add');
      return;
    }

    matches.forEach(invite => {
      const startDate = new Date(`${invite.date}T${invite.start_time}`);
      const endDate = new Date(`${invite.date}T${invite.end_time}`);
      
      const url = generateOutlookUrl({
        title: 'Tennis Match',
        startDate,
        endDate,
        location: invite.court_location,
        description: invite.message,
      });
      
      window.open(url, '_blank');
    });

    toast.success('Opening Outlook Calendar for each match');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Calendar</DialogTitle>
          <DialogDescription>
            Export your schedule to your preferred calendar application
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-availability"
                checked={includeAvailability}
                onCheckedChange={(checked) => setIncludeAvailability(checked as boolean)}
              />
              <Label htmlFor="include-availability" className="text-sm font-normal">
                Include availability slots
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-matches"
                checked={includeMatches}
                onCheckedChange={(checked) => setIncludeMatches(checked as boolean)}
              />
              <Label htmlFor="include-matches" className="text-sm font-normal">
                Include confirmed matches
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleExportICS}
              className="w-full"
              variant="default"
            >
              <Download className="w-4 h-4 mr-2" />
              Download iCal File (.ics)
            </Button>
            
            <Button
              onClick={handleGoogleCalendar}
              className="w-full"
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Add to Google Calendar
            </Button>
            
            <Button
              onClick={handleOutlook}
              className="w-full"
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Add to Outlook Calendar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
