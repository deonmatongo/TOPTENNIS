import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { toast } from 'sonner';
import { Trash2, Copy, CheckSquare } from 'lucide-react';
import { format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

interface BulkAvailabilityActionsProps {
  selectedAvailabilityIds: Set<string>;
  onClearSelection: () => void;
  currentWeekStart: Date;
}

export const BulkAvailabilityActions = ({
  selectedAvailabilityIds,
  onClearSelection,
  currentWeekStart,
}: BulkAvailabilityActionsProps) => {
  const { availability, deleteAvailability, createAvailability } = useUserAvailability();
  const [loading, setLoading] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedAvailabilityIds.size === 0) {
      toast.error('No availability slots selected');
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        Array.from(selectedAvailabilityIds).map((id) => deleteAvailability(id))
      );
      toast.success(`Deleted ${selectedAvailabilityIds.size} availability slots`);
      onClearSelection();
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Failed to delete some availability slots');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWeek = async () => {
    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    
    // Get all availability for current week
    const weekAvailability = availability.filter((avail) => {
      const availDate = new Date(avail.date);
      return availDate >= weekStart && availDate <= weekEnd && avail.is_available && !avail.is_blocked;
    });

    if (weekAvailability.length === 0) {
      toast.error('No availability in current week to copy');
      return;
    }

    setLoading(true);
    try {
      const nextWeekStart = addWeeks(weekStart, 1);
      const nextWeekDays = eachDayOfInterval({
        start: nextWeekStart,
        end: addWeeks(weekEnd, 1),
      });

      // Copy each availability to next week (same day of week)
      for (const avail of weekAvailability) {
        const availDate = new Date(avail.date);
        const dayOfWeek = availDate.getDay();
        const nextWeekDate = nextWeekDays.find((d) => d.getDay() === dayOfWeek);

        if (nextWeekDate) {
          await createAvailability({
            date: format(nextWeekDate, 'yyyy-MM-dd'),
            start_time: avail.start_time,
            end_time: avail.end_time,
            is_available: avail.is_available,
            notes: avail.notes,
            privacy_level: avail.privacy_level || 'public',
          });
        }
      }

      toast.success(`Copied ${weekAvailability.length} slots to next week`);
    } catch (error) {
      console.error('Error copying week:', error);
      toast.error('Failed to copy week availability');
    } finally {
      setLoading(false);
    }
  };

  if (selectedAvailabilityIds.size === 0) return null;

  return (
    <Card className="border-primary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            {selectedAvailabilityIds.size} Selected
          </div>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleBulkDelete}
          disabled={loading}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Selected
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyWeek} disabled={loading}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Week to Next
        </Button>
      </CardContent>
    </Card>
  );
};
