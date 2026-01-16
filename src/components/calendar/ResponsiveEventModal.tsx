import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Calendar, Clock, MapPin, Users, Bell, Video, 
  Repeat, Lock, Trash2, X, Plus, User, Sparkles, Settings
} from 'lucide-react';
import { CalendarEvent, EventType, RecurrencePattern, EventParticipant } from '@/types/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SchedulingAssistant } from './SchedulingAssistant';
import { Separator } from '@/components/ui/separator';
import { EventSettingsDialog } from './EventSettingsDialog';
import PlayerSearch from '@/components/dashboard/PlayerSearch';
import { SearchResult } from '@/hooks/usePlayerSearch';
import { useIsMobile } from '@/hooks/use-mobile';
import { ResponsiveTimePicker } from './ResponsiveTimePicker';

interface ResponsiveEventModalProps {
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

export const ResponsiveEventModal: React.FC<ResponsiveEventModalProps> = ({
  open,
  onClose,
  onSave,
  onDelete,
  event,
  defaultDate,
  defaultTime,
}) => {
  const isMobile = useIsMobile();
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

    // Validate end time > start time
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
      toast.error('End time must be after start time');
      return;
    }

    setSaving(true);
    try {
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
      toast.success(event ? 'Event updated' : 'Event created');
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    
    if (confirm('Delete this event?')) {
      try {
        await onDelete(event.id);
        onClose();
        toast.success('Event deleted');
      } catch (error) {
        toast.error('Failed to delete');
      }
    }
  };

  const handlePlayerSelect = (player: SearchResult) => {
    if (participants.some(p => p.userId === player.id)) {
      toast.error('Player already added');
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
    toast.success(`${player.name} added`);
  };

  const removeParticipant = (userId: string) => {
    setParticipants(participants.filter(p => p.userId !== userId));
  };

  const formContent = (
    <ScrollArea className="flex-1 px-1">
      <div className="space-y-4 pb-4">
        {/* Event Type */}
        <div className="space-y-2">
          <Label>Event Type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((type) => {
              const config = EVENT_TYPE_CONFIG[type];
              const Icon = config.icon;
              return (
                <Button
                  key={type}
                  variant={eventType === type ? 'default' : 'outline'}
                  className="flex flex-col items-center gap-1.5 h-auto py-3 min-h-[44px]"
                  onClick={() => setEventType(type)}
                >
                  <Icon className="h-5 w-5" />
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
            className="min-h-[44px]"
          />
        </div>

        {/* Participants */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Participants
          </Label>
          <PlayerSearch
            onPlayerSelect={handlePlayerSelect}
            placeholder="Search and add participants..."
            className="w-full min-h-[44px]"
          />

          {participants.length > 0 && (
            <div className="space-y-2 mt-2">
              {participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 min-h-[44px]"
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 min-h-[44px] min-w-[44px]"
                    onClick={() => removeParticipant(participant.userId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
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
            rows={3}
            className="min-h-[80px]"
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
            className="min-h-[44px]"
          />
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label>Date</Label>
          <CalendarComponent
            mode="single"
            selected={date}
            onSelect={(d) => d && setDate(d)}
            className="border rounded-md w-full"
          />
        </div>

        {/* Time Pickers - Responsive */}
        <ResponsiveTimePicker
          label="Start Time"
          value={startTime}
          onChange={setStartTime}
        />

        <ResponsiveTimePicker
          label="End Time"
          value={endTime}
          onChange={setEndTime}
        />

        {isMobile && (
          <Accordion type="single" collapsible className="border rounded-lg">
            <AccordionItem value="advanced" className="border-0">
              <AccordionTrigger className="px-4 hover:no-underline min-h-[44px]">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Advanced Settings</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="flex items-center justify-between min-h-[44px]">
                  <Label htmlFor="private">Private Event</Label>
                  <Switch
                    id="private"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                  />
                </div>
                <div className="flex items-center justify-between min-h-[44px]">
                  <Label htmlFor="recurring">Recurring</Label>
                  <Switch
                    id="recurring"
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {!isMobile && (
          <div className="space-y-4 pt-2">
            <Separator />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSettingsDialogOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Event Settings
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );

  const footerButtons = (
    <>
      <Button variant="outline" onClick={onClose} className="min-h-[44px]">
        Cancel
      </Button>
      {event && onDelete && (
        <Button
          variant="destructive"
          onClick={handleDelete}
          className="min-h-[44px]"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      )}
      <Button onClick={handleSave} disabled={saving} className="min-h-[44px]">
        {saving ? 'Saving...' : (event ? 'Update' : 'Create')}
      </Button>
    </>
  );

  // Mobile Drawer
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onClose}>
          <DrawerContent className="h-[95vh] flex flex-col">
            <DrawerHeader className="flex-shrink-0 border-b">
              <DrawerTitle>{event ? 'Edit Event' : 'Create New Event'}</DrawerTitle>
            </DrawerHeader>

            <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2 mx-4 mt-4 flex-shrink-0">
                <TabsTrigger value="details" className="min-h-[44px]">Details</TabsTrigger>
                <TabsTrigger value="assistant" className="min-h-[44px]">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Assistant
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-hidden px-4 mt-4">
                {formContent}
              </TabsContent>

              <TabsContent value="assistant" className="flex-1 overflow-hidden px-4 mt-4">
                <ScrollArea className="h-full">
                  <SchedulingAssistant
                    participants={participants}
                    selectedDate={date}
                    onSelectTime={(start, end) => {
                      setStartTime(format(start, 'HH:mm'));
                      setEndTime(format(end, 'HH:mm'));
                    }}
                  />
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <DrawerFooter className="flex-shrink-0 border-t">
              <div className="flex gap-2 w-full">
                {footerButtons}
              </div>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

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
      </>
    );
  }

  // Desktop Dialog
  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl h-[90vh] w-full flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
            <DialogTitle>{event ? 'Edit Event' : 'Create New Event'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-6">
            <Tabs defaultValue="details" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="assistant">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Scheduling Assistant
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-hidden mt-0">
                {formContent}
              </TabsContent>

              <TabsContent value="assistant" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <SchedulingAssistant
                    participants={participants}
                    selectedDate={date}
                    onSelectTime={(start, end) => {
                      setStartTime(format(start, 'HH:mm'));
                      setEndTime(format(end, 'HH:mm'));
                    }}
                  />
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="px-6 py-4 flex-shrink-0 border-t">
            {footerButtons}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
};
