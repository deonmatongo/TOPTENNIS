import React, { useState, useEffect } from 'react';
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
import { toast } from 'sonner';

import { useUserAvailability } from '@/hooks/useUserAvailability';
import { format } from 'date-fns';

interface AvailabilityModalProps {
  open: boolean;
  onClose: () => void;
  editingItem?: any;
  selectedDate?: Date;
  selectedStartTime?: string;
  selectedEndTime?: string;
}

// No conversion needed - using 24-hour format directly

export const AvailabilityModal = ({ 
  open, 
  onClose, 
  editingItem, 
  selectedDate,
  selectedStartTime,
  selectedEndTime
}: AvailabilityModalProps) => {
  const { createAvailability, updateAvailability } = useUserAvailability();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    start_time: '09:00',
    end_time: '17:00',
    is_available: true,
    notes: ''
  });

  useEffect(() => {
    if (editingItem) {
      setFormData({
        date: editingItem.date,
        start_time: editingItem.start_time,
        end_time: editingItem.end_time,
        is_available: editingItem.is_available,
        notes: editingItem.notes || ''
      });
    } else if (selectedDate) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const isToday = selectedDate.toDateString() === now.toDateString();
      
      // For today, start from next available hour
      const defaultStartHour = isToday && currentHour >= 6 ? currentHour + 1 : 9;
      
      const newFormData: any = {
        date: format(selectedDate, 'yyyy-MM-dd'),
        is_available: true,
        notes: ''
      };
      
      // Use selected time slot if provided
      if (selectedStartTime && selectedEndTime) {
        newFormData.start_time = selectedStartTime;
        newFormData.end_time = selectedEndTime;
      } else {
        newFormData.start_time = `${defaultStartHour.toString().padStart(2, '0')}:00`;
        newFormData.end_time = `${(defaultStartHour + 8).toString().padStart(2, '0')}:00`;
      }
      
      setFormData(newFormData);
    }
  }, [editingItem, selectedDate, selectedStartTime, selectedEndTime, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate time range
      if (formData.start_time >= formData.end_time) {
        toast.error('End time must be after start time');
        setLoading(false);
        return;
      }

      // Note: Past date/time validation is handled in the useUserAvailability hook

      if (editingItem) {
        await updateAvailability(editingItem.id, formData);
      } else {
        await createAvailability(formData);
      }
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setFormData({
      date: '',
      start_time: '09:00',
      end_time: '17:00',
      is_available: true,
      notes: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Edit Availability' : 'Add Availability'}
          </DialogTitle>
          <DialogDescription>
            Set your tennis court availability for the selected date and time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              className="focus-visible:ring-primary border-border"
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
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="focus-visible:ring-primary border-border"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time (24h)</Label>
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};