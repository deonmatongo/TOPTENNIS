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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface MultiDateAvailabilityModalProps {
  open: boolean;
  onClose: () => void;
}

export const MultiDateAvailabilityModal = ({ 
  open, 
  onClose,
}: MultiDateAvailabilityModalProps) => {
  const { createAvailability } = useUserAvailability();
  const [loading, setLoading] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [formData, setFormData] = useState({
    start_time: '09:00',
    end_time: '17:00',
    is_available: true,
    notes: ''
  });

  // Get current hour to start calendar from current time
  const currentHour = new Date().getHours();
  const minStartTime = `${currentHour.toString().padStart(2, '0')}:00`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedDates.length === 0) {
      toast.error('Please select at least one date');
      return;
    }

    // Validate time range
    if (formData.start_time >= formData.end_time) {
      toast.error('End time must be after start time');
      return;
    }

    // Validate that dates/times are not in the past
    const now = new Date();
    const pastDates = selectedDates.filter(date => {
      const availDate = new Date(date);
      const [hours, minutes] = formData.start_time.split(':').map(Number);
      availDate.setHours(hours, minutes, 0, 0);
      return availDate < now;
    });

    if (pastDates.length > 0) {
      toast.error('Cannot create availability for past dates or times');
      return;
    }

    setLoading(true);

    try {
      // Create availability for each selected date
      const promises = selectedDates.map(date => 
        createAvailability({
          date: format(date, 'yyyy-MM-dd'),
          start_time: formData.start_time,
          end_time: formData.end_time,
          is_available: formData.is_available,
          notes: formData.notes
        })
      );

      await Promise.all(promises);
      toast.success(`Added availability for ${selectedDates.length} date${selectedDates.length > 1 ? 's' : ''}`);
      onClose();
    } catch (error) {
      console.error('Error creating availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedDates([]);
    setFormData({
      start_time: '09:00',
      end_time: '17:00',
      is_available: true,
      notes: ''
    });
  };

  const handleDateSelect = (dates: Date[] | undefined) => {
    if (dates) {
      setSelectedDates(dates);
    }
  };

  // Disable past dates
  const disabledDates = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Add Availability (Multiple Dates)
          </DialogTitle>
          <DialogDescription>
            Select multiple dates and set your availability for all of them at once
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Calendar for multiple date selection */}
          <div className="space-y-2">
            <Label>Select Dates</Label>
            <div className="flex justify-center border rounded-lg p-4 bg-muted/30">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={handleDateSelect}
                disabled={disabledDates}
                className="rounded-md pointer-events-auto"
              />
            </div>
            {selectedDates.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {selectedDates.length} date{selectedDates.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Start Time (24h)
              </Label>
              <Input
                id="start_time"
                type="time"
                min={minStartTime}
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="focus-visible:ring-primary border-border"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                End Time (24h)
              </Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="focus-visible:ring-primary border-border"
                required
              />
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="is_available"
              checked={formData.is_available}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_available: checked }))}
            />
            <Label htmlFor="is_available">
              {formData.is_available ? 'Available for bookings' : 'Block this time'}
            </Label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || selectedDates.length === 0}>
              {loading ? 'Creating...' : `Add for ${selectedDates.length || 0} Date${selectedDates.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
