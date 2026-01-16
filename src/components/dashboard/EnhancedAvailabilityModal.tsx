import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useConflictDetection } from '@/hooks/useConflictDetection';
import { toast } from 'sonner';
import { generateRecurringSlots, encodeRecurrenceRule, RecurrencePattern, RecurrenceRule } from '@/utils/recurringAvailability';
import { Calendar } from '@/components/ui/calendar';
import { AlertCircle, Repeat } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EnhancedAvailabilityModalProps {
  open: boolean;
  onClose: () => void;
  editingItem?: any;
  selectedDate?: Date;
  selectedStartTime?: string;
  selectedEndTime?: string;
}

export const EnhancedAvailabilityModal = ({
  open,
  onClose,
  editingItem,
  selectedDate,
  selectedStartTime,
  selectedEndTime,
}: EnhancedAvailabilityModalProps) => {
  const { createAvailability, updateAvailability } = useUserAvailability();
  const { checkConflict } = useConflictDetection();
  const [loading, setLoading] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);

  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    is_available: true,
    notes: '',
    privacy_level: 'public',
  });

  const [recurrenceData, setRecurrenceData] = useState<RecurrenceRule>({
    pattern: 'none' as RecurrencePattern,
    interval: 1,
    endDate: undefined,
    daysOfWeek: [],
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        setFormData({
          date: editingItem.date,
          start_time: editingItem.start_time,
          end_time: editingItem.end_time,
          is_available: editingItem.is_available,
          notes: editingItem.notes || '',
          privacy_level: editingItem.privacy_level || 'public',
        });
      } else if (selectedDate) {
        setFormData({
          date: selectedDate.toISOString().split('T')[0],
          start_time: selectedStartTime || '09:00',
          end_time: selectedEndTime || '10:00',
          is_available: true,
          notes: '',
          privacy_level: 'public',
        });
      }
    }
  }, [open, editingItem, selectedDate, selectedStartTime, selectedEndTime]);

  useEffect(() => {
    if (formData.date && formData.start_time && formData.end_time) {
      const checkForConflicts = async () => {
        const conflict = await checkConflict({
          date: formData.date,
          startTime: formData.start_time,
          endTime: formData.end_time,
          excludeId: editingItem?.id,
        });
        setHasConflict(conflict);
      };
      checkForConflicts();
    }
  }, [formData.date, formData.start_time, formData.end_time, editingItem?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate time range
    if (formData.start_time >= formData.end_time) {
      toast.error('End time must be after start time');
      return;
    }

    // Validate that date/time is not in the past (only for new entries, not editing)
    if (!editingItem) {
      const now = new Date();
      const availDate = new Date(formData.date);
      const [hours, minutes] = formData.start_time.split(':').map(Number);
      availDate.setHours(hours, minutes, 0, 0);
      
      if (availDate < now) {
        toast.error('Cannot create availability for past dates or times');
        return;
      }
    }

    setLoading(true);

    try {
      // Ensure time format includes seconds
      const formatTime = (time: string) => {
        if (!time.includes(':')) return time;
        const parts = time.split(':');
        return parts.length === 2 ? `${time}:00` : time;
      };

      const submissionData = {
        ...formData,
        start_time: formatTime(formData.start_time),
        end_time: formatTime(formData.end_time),
      };

      if (editingItem) {
        await updateAvailability(editingItem.id, submissionData);
        toast.success('Availability updated successfully');
      } else {
        // Handle recurring availability
        if (recurrenceData.pattern !== 'none') {
          const slots = generateRecurringSlots(
            {
              date: new Date(formData.date),
              startTime: formData.start_time,
              endTime: formData.end_time,
            },
            recurrenceData
          );

          // Create all recurring slots
          for (const slot of slots) {
            await createAvailability({
              ...submissionData,
              date: slot.date.toISOString().split('T')[0],
              start_time: formatTime(slot.startTime),
              end_time: formatTime(slot.endTime),
              recurrence_rule: encodeRecurrenceRule(recurrenceData),
            });
          }
          toast.success(`Created ${slots.length} recurring availability slots`);
        } else {
          await createAvailability(submissionData);
          toast.success('Availability added successfully');
        }
      }
      handleClose();
    } catch (error: any) {
      console.error('Error saving availability:', error);
      const errorMessage = error?.message || 'Failed to save availability';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      date: '',
      start_time: '',
      end_time: '',
      is_available: true,
      notes: '',
      privacy_level: 'public',
    });
    setRecurrenceData({
      pattern: 'none',
      interval: 1,
      endDate: undefined,
      daysOfWeek: [],
    });
    setShowRecurrence(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Edit Availability' : 'Add Availability'}
          </DialogTitle>
          <DialogDescription>
            Set your availability for matches and practice sessions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
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
              <Label htmlFor="start_time">Start Time (24h)</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => {
                  const value = e.target.value;
                  // Ensure 24-hour format with seconds
                  const formattedValue = value.includes(':') ? value : `${value}:00`;
                  setFormData({ ...formData, start_time: formattedValue });
                }}
                required
                step="900"
                pattern="[0-9]{2}:[0-9]{2}"
                placeholder="14:00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">End Time (24h)</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => {
                  const value = e.target.value;
                  // Ensure 24-hour format with seconds
                  const formattedValue = value.includes(':') ? value : `${value}:00`;
                  setFormData({ ...formData, end_time: formattedValue });
                }}
                required
                step="900"
                pattern="[0-9]{2}:[0-9]{2}"
                placeholder="15:00"
              />
              {formData.start_time && formData.end_time && formData.start_time >= formData.end_time && (
                <p className="text-xs text-destructive">End time must be after start time</p>
              )}
            </div>
          </div>

          {hasConflict && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This time slot conflicts with an existing availability or booking.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="privacy">Privacy Level</Label>
            <Select value={formData.privacy_level} onValueChange={(value) => setFormData({ ...formData, privacy_level: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public (Visible to all)</SelectItem>
                <SelectItem value="friends-only">Friends Only</SelectItem>
                <SelectItem value="private">Private (For matching only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="is_available">Available for matches</Label>
            <Switch
              id="is_available"
              checked={formData.is_available}
              onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
            />
          </div>

          {!editingItem && (
            <div className="flex items-center justify-between space-x-2 pt-2 border-t">
              <Label htmlFor="recurring" className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Recurring Availability
              </Label>
              <Switch
                id="recurring"
                checked={showRecurrence}
                onCheckedChange={setShowRecurrence}
              />
            </div>
          )}

          {showRecurrence && !editingItem && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <Label>Recurrence Pattern</Label>
                <Select
                  value={recurrenceData.pattern}
                  onValueChange={(value) => setRecurrenceData({ ...recurrenceData, pattern: value as RecurrencePattern })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Does not repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceData.pattern !== 'none' && (
                <>
                  <div className="space-y-2">
                    <Label>Repeat every</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={recurrenceData.interval}
                        onChange={(e) => setRecurrenceData({ ...recurrenceData, interval: parseInt(e.target.value) || 1 })}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        {recurrenceData.pattern === 'daily' && 'day(s)'}
                        {recurrenceData.pattern === 'weekly' && 'week(s)'}
                        {recurrenceData.pattern === 'monthly' && 'month(s)'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={recurrenceData.endDate?.toISOString().split('T')[0] || ''}
                      onChange={(e) => setRecurrenceData({ ...recurrenceData, endDate: e.target.value ? new Date(e.target.value) : undefined })}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || hasConflict || (formData.start_time >= formData.end_time)}
            >
              {loading ? 'Saving...' : editingItem ? 'Update Availability' : 'Add Availability'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
