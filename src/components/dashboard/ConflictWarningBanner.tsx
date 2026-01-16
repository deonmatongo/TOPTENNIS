import React, { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Clock } from 'lucide-react';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { Badge } from '@/components/ui/badge';

export const ConflictWarningBanner = () => {
  const { availability } = useUserAvailability();
  const { invites } = useMatchInvites();

  const conflicts = useMemo(() => {
    const conflictList: Array<{
      date: string;
      time: string;
      type: string;
      message: string;
    }> = [];

    // Check for overlapping availability slots
    availability.forEach((avail1, idx1) => {
      availability.forEach((avail2, idx2) => {
        if (idx1 >= idx2) return;
        if (avail1.date !== avail2.date) return;
        if (!avail1.is_available || !avail2.is_available) return;
        
        // Check for time overlap
        const start1 = avail1.start_time;
        const end1 = avail1.end_time;
        const start2 = avail2.start_time;
        const end2 = avail2.end_time;

        const hasOverlap = (start1 < end2 && end1 > start2);
        
        if (hasOverlap) {
          conflictList.push({
            date: avail1.date,
            time: `${start1} - ${end1}`,
            type: 'overlap',
            message: 'Overlapping availability slots',
          });
        }
      });
    });

    // Check for double-bookings (multiple accepted invites at same time)
    invites
      .filter(i => i.status === 'accepted' || i.status === 'confirmed')
      .forEach((invite1, idx1) => {
        invites
          .filter(i => i.status === 'accepted' || i.status === 'confirmed')
          .forEach((invite2, idx2) => {
            if (idx1 >= idx2) return;
            if (invite1.date !== invite2.date) return;

            const hasOverlap = (invite1.start_time < invite2.end_time && invite1.end_time > invite2.start_time);
            
            if (hasOverlap) {
              conflictList.push({
                date: invite1.date,
                time: `${invite1.start_time} - ${invite1.end_time}`,
                type: 'double-booking',
                message: 'Double-booked matches',
              });
            }
          });
      });

    return conflictList;
  }, [availability, invites]);

  if (conflicts.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-semibold">⚠️ {conflicts.length} Scheduling Conflict{conflicts.length > 1 ? 's' : ''} Detected</p>
          <div className="space-y-1 text-sm">
            {conflicts.slice(0, 3).map((conflict, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>{conflict.date} at {conflict.time}</span>
                <Badge variant="outline" className="text-xs">{conflict.message}</Badge>
              </div>
            ))}
            {conflicts.length > 3 && (
              <p className="text-xs text-muted-foreground">+{conflicts.length - 3} more conflicts</p>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
