import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, Clock, MapPin, Users, Bell, Video, 
  Repeat, Lock, Trash2, X, Plus, User, Sparkles
} from 'lucide-react';
import { CalendarEvent, EventType, RecurrencePattern, EventParticipant } from '@/types/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SchedulingAssistant } from './SchedulingAssistant';
import { Separator } from '@/components/ui/separator';
import { EventSettingsDialog } from './EventSettingsDialog';
import { Settings } from 'lucide-react';
import PlayerSearch from '@/components/dashboard/PlayerSearch';
import { SearchResult } from '@/hooks/usePlayerSearch';

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  defaultTime?: string;
}

const EVENT_TYPE_CONFIG = {
  match: { label: 'Match', color: 'bg-green-500', icon: Users },
  lesson: { label: 'Lesson', color: 'bg-blue-500', icon: User },
  tournament: { label: 'Tournament', color: 'bg-orange-500', icon: Calendar },
  practice: { label: 'Practice', color: 'bg-purple-500', icon: Clock },
};

const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
];

export const EventModal: React.FC<EventModalProps> = ({
  open,
  onClose,
  onSave,
  onDelete,
  event,
  defaultDate,
  defaultTime,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('match');
  const [date, setDate] = useState<Date>(defaultDate || new Date());
  const [startTime, setStartTime] = useState(defaultTime || '10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [courtNumber, setCourtNumber] = useState('');
  const [videoCallLink, setVideoCallLink] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>();
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [reminders, setReminders] = useState<number[]>([30]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setEventType(event.type);
      setDate(event.startTime);
      setStartTime(format(event.startTime, 'HH:mm'));
      setEndTime(format(event.endTime, 'HH:mm'));
      setLocation(event.location || '');
      setCourtNumber(event.courtNumber || '');
      setVideoCallLink(event.videoCallLink || '');
      setIsPrivate(event.isPrivate);
      setIsRecurring(event.isRecurring);
      setRecurrencePattern(event.recurrencePattern || 'none');
      setRecurrenceEndDate(event.recurrenceEndDate);
      setParticipants(event.participants || []);
      setReminders(event.reminders.map(r => r.minutesBefore));
      setNotes(event.notes || '');
    } else {
      // Reset form for new event
      setTitle('');
      setDescription('');
      setEventType('match');
      setDate(defaultDate || new Date());
      setStartTime(defaultTime || '10:00');
      setEndTime('11:00');
      setLocation('');
      setCourtNumber('');
      setVideoCallLink('');
      setIsPrivate(false);
      setIsRecurring(false);
      setRecurrencePattern('none');
      setRecurrenceEndDate(undefined);
      setParticipants([]);
      setReminders([30]);
      setNotes('');
    }
  }, [event, defaultDate, defaultTime]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    setSaving(true);
    try {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      const startDateTime = new Date(date);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      const endDateTime = new Date(date);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      const eventData: Partial<CalendarEvent> = {
        title,
        description,
        type: eventType,
        startTime: startDateTime,
        endTime: endDateTime,
        location,
        courtNumber,
        videoCallLink,
        isPrivate,
        isRecurring,
        recurrencePattern: isRecurring ? recurrencePattern : 'none',
        recurrenceEndDate: isRecurring ? recurrenceEndDate : undefined,
        participants,
        reminders: reminders.map((minutes, index) => ({
          id: `reminder-${index}`,
          minutesBefore: minutes,
          type: 'notification' as const,
          sent: false,
        })),
        notes,
      };

      if (event) {
        eventData.id = event.id;
      }

      await onSave(eventData);
      onClose();
      toast.success(event ? 'Event updated successfully' : 'Event created successfully');
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    
    if (confirm('Are you sure you want to delete this event?')) {
      try {
        await onDelete(event.id);
        onClose();
        toast.success('Event deleted successfully');
      } catch (error) {
        console.error('Error deleting event:', error);
        toast.error('Failed to delete event');
      }
    }
  };

  const addReminder = () => {
    setReminders([...reminders, 30]);
  };

  const removeReminder = (index: number) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  const handlePlayerSelect = (player: SearchResult) => {
    // Check if player is already added
    if (participants.some(p => p.userId === player.id)) {
      toast.error('This player is already added');
      return;
    }

    const newParticipant: EventParticipant = {
      userId: player.id,
      userName: player.name,
      userEmail: player.email,
      role: 'player',
      rsvpStatus: 'pending',
    };
    
    setParticipants([...participants, newParticipant]);
    toast.success(`${player.name} added to participants`);
  };

  const removeParticipant = (userId: string) => {
    setParticipants(participants.filter(p => p.userId !== userId));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[90vh] w-[95vw] sm:w-full flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex-shrink-0">
          <DialogTitle>{event ? 'Edit Event' : 'Create New Event'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-4 sm:px-6 min-h-0">
          <Tabs defaultValue="details" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 text-xs sm:text-sm mb-4 flex-shrink-0">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="assistant">
                <Sparkles className="w-4 h-4 mr-2" />
                Scheduling Assistant
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-y-auto mt-0 pr-2">
              <div className="space-y-4 pb-4">
              {/* Event Type */}
              <div className="space-y-2">
                <Label>Event Type</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((type) => {
                    const config = EVENT_TYPE_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <Button
                        key={type}
                        variant={eventType === type ? 'default' : 'outline'}
                        className="flex flex-col items-center gap-1.5 h-auto py-2.5"
                        onClick={() => setEventType(type)}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{config.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Event Name */}
              <div className="space-y-2">
                <Label htmlFor="title">Event Name *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Singles Match with Alex"
                />
              </div>

              {/* Participants List */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participants
                </Label>
                <PlayerSearch
                  onPlayerSelect={handlePlayerSelect}
                  placeholder="Search and add participants..."
                  className="w-full"
                />

                {participants.length > 0 && (
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div
                        key={participant.userId}
                        className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={participant.profilePicture} />
                            <AvatarFallback>
                              {participant.userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{participant.userName}</p>
                            <p className="text-xs text-muted-foreground">{participant.userEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={
                            participant.rsvpStatus === 'yes' ? 'default' :
                            participant.rsvpStatus === 'no' ? 'destructive' :
                            'secondary'
                          } className="text-xs">
                            {participant.rsvpStatus}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeParticipant(participant.userId)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add event details..."
                  rows={2}
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Location
                </Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Central Tennis Club"
                />
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    className="border rounded-md w-full"
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">Start Time</Label>
                    <div className="flex gap-2">
                      <Select
                        value={startTime.split(':')[0]}
                        onValueChange={(h) => setStartTime(`${h}:${startTime.split(':')[1]}`)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={startTime.split(':')[1]}
                        onValueChange={(m) => setStartTime(`${startTime.split(':')[0]}:${m}`)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Min" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                            <SelectItem key={m} value={m.toString().padStart(2, '0')}>
                              {m.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">End Time</Label>
                    <div className="flex gap-2">
                      <Select
                        value={endTime.split(':')[0]}
                        onValueChange={(h) => setEndTime(`${h}:${endTime.split(':')[1]}`)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Hour" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={endTime.split(':')[1]}
                        onValueChange={(m) => setEndTime(`${endTime.split(':')[0]}:${m}`)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Min" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                            <SelectItem key={m} value={m.toString().padStart(2, '0')}>
                              {m.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Event Settings Button */}
              <div className="pb-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setSettingsDialogOpen(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Event Settings (Reminders, Recurrence, Privacy)
                </Button>
              </div>
              </div>
            </TabsContent>

            <TabsContent value="assistant" className="flex-1 overflow-y-auto mt-0 pr-2">
              <div className="pb-4">
                <SchedulingAssistant
                  participants={participants}
                  selectedDate={date}
                  onSelectTime={(start, end) => {
                    setStartTime(format(start, 'HH:mm'));
                    setEndTime(format(end, 'HH:mm'));
                    toast.success('Time selected from scheduling assistant');
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t bg-muted/20">
          {event && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : event ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>

        {/* Event Settings Dialog */}
        <EventSettingsDialog
          open={settingsDialogOpen}
          onClose={() => setSettingsDialogOpen(false)}
          reminders={reminders}
          onRemindersChange={setReminders}
          isRecurring={isRecurring}
          onIsRecurringChange={setIsRecurring}
          recurrencePattern={recurrencePattern}
          onRecurrencePatternChange={setRecurrencePattern}
          recurrenceEndDate={recurrenceEndDate}
          onRecurrenceEndDateChange={setRecurrenceEndDate}
          isPrivate={isPrivate}
          onIsPrivateChange={setIsPrivate}
        />
      </DialogContent>
    </Dialog>
  );
};
