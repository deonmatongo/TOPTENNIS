import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Bell, Repeat, Lock, Plus, X } from 'lucide-react';
import { RecurrencePattern } from '@/types/calendar';

const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
];

interface EventSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  reminders: number[];
  onRemindersChange: (reminders: number[]) => void;
  isRecurring: boolean;
  onIsRecurringChange: (value: boolean) => void;
  recurrencePattern: RecurrencePattern;
  onRecurrencePatternChange: (pattern: RecurrencePattern) => void;
  recurrenceEndDate?: Date;
  onRecurrenceEndDateChange: (date?: Date) => void;
  isPrivate: boolean;
  onIsPrivateChange: (value: boolean) => void;
}

export const EventSettingsDialog: React.FC<EventSettingsDialogProps> = ({
  open,
  onClose,
  reminders,
  onRemindersChange,
  isRecurring,
  onIsRecurringChange,
  recurrencePattern,
  onRecurrencePatternChange,
  recurrenceEndDate,
  onRecurrenceEndDateChange,
  isPrivate,
  onIsPrivateChange,
}) => {
  const addReminder = () => {
    onRemindersChange([...reminders, 30]);
  };

  const removeReminder = (index: number) => {
    onRemindersChange(reminders.filter((_, i) => i !== index));
  };

  const updateReminder = (index: number, value: number) => {
    const newReminders = [...reminders];
    newReminders[index] = value;
    onRemindersChange(newReminders);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Event Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Reminders */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Reminders</Label>
            <div className="space-y-2">
              {reminders.map((reminder, index) => (
                <div key={index} className="flex gap-2">
                  <Select
                    value={reminder.toString()}
                    onValueChange={(v) => updateReminder(index, parseInt(v))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeReminder(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addReminder} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Reminder
              </Button>
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="recurring" className="flex items-center gap-2 text-base font-semibold">
                <Repeat className="h-5 w-5" />
                Recurring Event
              </Label>
              <Switch
                id="recurring"
                checked={isRecurring}
                onCheckedChange={onIsRecurringChange}
              />
            </div>
            
            {isRecurring && (
              <div className="space-y-3 pl-6 border-l-2">
                <div className="space-y-2">
                  <Label>Repeat Pattern</Label>
                  <Select
                    value={recurrencePattern}
                    onValueChange={(v) => onRecurrencePatternChange(v as RecurrencePattern)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Every Day</SelectItem>
                      <SelectItem value="weekly">Every Week</SelectItem>
                      <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                      <SelectItem value="monthly">Every Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <CalendarComponent
                    mode="single"
                    selected={recurrenceEndDate}
                    onSelect={onRecurrenceEndDateChange}
                    className="border rounded-md pointer-events-auto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Privacy */}
          <div className="flex items-center justify-between">
            <Label htmlFor="private" className="flex items-center gap-2 text-base font-semibold">
              <Lock className="h-5 w-5" />
              Private Event
            </Label>
            <Switch
              id="private"
              checked={isPrivate}
              onCheckedChange={onIsPrivateChange}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
