import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus,
  Users,
  Mail,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Globe
} from 'lucide-react';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { TimezoneSelect } from '@/components/ui/TimezoneSelect';
import { convertTimeBetweenTimezones, getTimezoneDisplayName } from '@/utils/timezoneConversion';
import { EnhancedAvailabilityModal } from '@/components/dashboard/EnhancedAvailabilityModal';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  isPast,
  isFuture,
  startOfDay
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

type ViewMode = 'week' | 'month';

interface CalendarScheduleViewProps {
  preSelectedOpponent?: {id?: string, name?: string} | null;
  onClearOpponent?: () => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  preSelectedOpponent,
  onClearOpponent
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{id: string, type: 'availability' | 'invite'} | null>(null);
  const [cancellingMatch, setCancellingMatch] = useState<string | null>(null);

  const { availability, deleteAvailability } = useUserAvailability();
  const { invites, getPendingInvites, getConfirmedInvites, respondToInvite, deleteInvite, cancelInvite } = useMatchInvites();
  const { timezone, updateTimezone } = useUserTimezone();

  const pendingInvites = getPendingInvites();
  const confirmedMatches = getConfirmedInvites();

  // Calculate calendar range
  const calendarRange = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, viewMode]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {};

    calendarRange.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      grouped[dateKey] = [];
    });

    // Add availability slots
    availability?.forEach(slot => {
      if (slot.is_available && !slot.is_blocked) {
        const dateKey = slot.date;
        if (grouped[dateKey]) {
          // Convert times to user's timezone if different from slot's timezone
          const slotTimezone = slot.timezone || 'America/New_York';
          const displayStartTime = slotTimezone !== timezone 
            ? convertTimeBetweenTimezones(slot.start_time, slotTimezone, timezone, slot.date)
            : slot.start_time;
          const displayEndTime = slotTimezone !== timezone
            ? convertTimeBetweenTimezones(slot.end_time, slotTimezone, timezone, slot.date)
            : slot.end_time;

          grouped[dateKey].push({
            type: 'availability',
            id: slot.id,
            date: slot.date,
            start_time: displayStartTime,
            end_time: displayEndTime,
            originalStartTime: slot.start_time,
            originalEndTime: slot.end_time,
            originalTimezone: slotTimezone,
            title: 'Available',
            color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
            data: slot
          });
        }
      }
    });

    // Add confirmed matches
    confirmedMatches?.forEach(match => {
      if (match.status === 'accepted' && match.date) {
        const dateKey = match.date;
        if (grouped[dateKey]) {
          const opponent = match.sender_id !== match.receiver_id 
            ? (match.sender || match.receiver)
            : match.receiver;
          const opponentName = opponent 
            ? `${opponent.first_name || ''} ${opponent.last_name || ''}`.trim() 
            : 'Unknown';

          // Convert times to user's timezone if different from match's timezone
          const matchTimezone = match.timezone || 'America/New_York';
          const displayStartTime = matchTimezone !== timezone 
            ? convertTimeBetweenTimezones(match.start_time, matchTimezone, timezone, match.date)
            : match.start_time;
          const displayEndTime = matchTimezone !== timezone
            ? convertTimeBetweenTimezones(match.end_time, matchTimezone, timezone, match.date)
            : match.end_time;

          grouped[dateKey].push({
            type: 'match',
            id: match.id,
            date: match.date,
            start_time: displayStartTime,
            end_time: displayEndTime,
            originalStartTime: match.start_time,
            originalEndTime: match.end_time,
            originalTimezone: matchTimezone,
            title: `Match vs ${opponentName}`,
            color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
            data: match
          });
        }
      }
    });

    // Add pending invites
    pendingInvites?.forEach(invite => {
      if (invite.date) {
        const dateKey = invite.date;
        if (grouped[dateKey]) {
          const sender = invite.sender;
          const senderName = sender 
            ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() 
            : 'Unknown';

          // Convert times to user's timezone if different from invite's timezone
          const inviteTimezone = invite.timezone || 'America/New_York';
          const displayStartTime = inviteTimezone !== timezone 
            ? convertTimeBetweenTimezones(invite.start_time, inviteTimezone, timezone, invite.date)
            : invite.start_time;
          const displayEndTime = inviteTimezone !== timezone
            ? convertTimeBetweenTimezones(invite.end_time, inviteTimezone, timezone, invite.date)
            : invite.end_time;

          grouped[dateKey].push({
            type: 'invite',
            id: invite.id,
            date: invite.date,
            start_time: displayStartTime,
            end_time: displayEndTime,
            originalStartTime: invite.start_time,
            originalEndTime: invite.end_time,
            originalTimezone: inviteTimezone,
            title: `Invite from ${senderName}`,
            color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
            data: invite
          });
        }
      }
    });

    return grouped;
  }, [calendarRange, availability, confirmedMatches, pendingInvites, timezone]);

  const handlePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowAddModal(true);
  };

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleDeleteClick = (id: string, type: 'availability' | 'invite', e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingItem({ id, type });
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;

    try {
      if (deletingItem.type === 'availability') {
        await deleteAvailability(deletingItem.id);
      } else {
        await deleteInvite(deletingItem.id);
      }
      setShowEventDialog(false);
    } catch (error) {
      // Error handled in hooks
    } finally {
      setDeletingItem(null);
    }
  };

  const handleCancelMatch = (matchId: string) => {
    setCancellingMatch(matchId);
  };

  const confirmCancelMatch = async () => {
    if (!cancellingMatch) return;

    try {
      await cancelInvite(cancellingMatch, 'Match cancelled by user');
      setShowEventDialog(false);
      toast.success('Match cancelled successfully');
    } catch (error) {
      // Error handled in hook
    } finally {
      setCancellingMatch(null);
    }
  };

  const handleRespondToInvite = async (inviteId: string, response: 'accepted' | 'declined') => {
    try {
      await respondToInvite(inviteId, response);
      setShowEventDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const getHeaderTitle = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="p-4 space-y-4">
          {/* Pre-selected Opponent Banner */}
          {preSelectedOpponent && preSelectedOpponent.name && (
            <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500 rounded-full">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-orange-900 dark:text-orange-100">
                        Ready to schedule with {preSelectedOpponent.name}
                      </h3>
                      <p className="text-xs text-orange-700 dark:text-orange-200">
                        Click any date to add your availability
                      </p>
                    </div>
                  </div>
                  {onClearOpponent && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={onClearOpponent}
                      className="text-orange-700 hover:text-orange-900"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calendar Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button onClick={handleToday} variant="outline" size="sm" className="flex-shrink-0">
                Today
              </Button>
              <div className="flex items-center gap-1">
                <Button onClick={handlePrevious} variant="ghost" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button onClick={handleNext} variant="ghost" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-base sm:text-xl font-semibold ml-2 truncate">{getHeaderTitle()}</h2>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex border rounded-lg overflow-hidden flex-1 sm:flex-initial">
                <Button
                  variant={viewMode === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                  className="rounded-none flex-1 sm:flex-initial"
                >
                  Week
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                  className="rounded-none flex-1 sm:flex-initial"
                >
                  Month
                </Button>
              </div>
              <Button onClick={() => handleDateClick(new Date())} size="sm" className="flex-shrink-0">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Availability</span>
              </Button>
            </div>
          </div>

          {/* Timezone Selector */}
          <div className="flex items-center gap-3 pt-3 border-t">
            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap">Timezone:</span>
            <div className="flex-1 max-w-xs">
              <TimezoneSelect
                value={timezone}
                onValueChange={updateTimezone}
                placeholder="Select timezone"
              />
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              All times shown in {getTimezoneDisplayName(timezone)}
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {/* Calendar */}
          <div className="border rounded-lg bg-card overflow-hidden">
            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b bg-muted/50">
              {weekDays.map(day => (
                <div key={day} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium border-r last:border-r-0">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.slice(0, 1)}</span>
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className={cn(
              "grid grid-cols-7",
              viewMode === 'month' ? 'grid-rows-5' : 'grid-rows-1'
            )}>
              {calendarRange.map((date, index) => {
                const dateKey = format(date, 'yyyy-MM-dd');
                const events = eventsByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isPastDate = isPast(startOfDay(date)) && !isToday(date);

                return (
                  <div
                    key={index}
                    className={cn(
                      "min-h-[80px] sm:min-h-[120px] border-r border-b last:border-r-0 p-1 sm:p-2 cursor-pointer hover:bg-muted/50 transition-colors",
                      !isCurrentMonth && viewMode === 'month' && "bg-muted/20 text-muted-foreground",
                      isToday(date) && "bg-blue-50 dark:bg-blue-950/20",
                      isPastDate && "opacity-60"
                    )}
                    onClick={() => !isPastDate && handleDateClick(date)}
                  >
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <span className={cn(
                        "text-xs sm:text-sm font-medium",
                        isToday(date) && "bg-blue-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs"
                      )}>
                        {format(date, 'd')}
                      </span>
                      {events.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs h-4 sm:h-5 px-1 sm:px-2">
                          {events.length}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-0.5 sm:space-y-1">
                      {events.slice(0, viewMode === 'month' ? 2 : 5).map((event, idx) => (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                          className={cn(
                            "text-[10px] sm:text-xs p-1 sm:p-1.5 rounded border cursor-pointer hover:shadow-sm transition-shadow",
                            event.color
                          )}
                        >
                          <div className="flex items-center gap-0.5 sm:gap-1 font-medium truncate">
                            {event.type === 'availability' && <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />}
                            {event.type === 'match' && <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />}
                            {event.type === 'invite' && <Mail className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />}
                            <span className="truncate hidden sm:inline">{event.title}</span>
                            <span className="truncate sm:hidden">{event.type === 'availability' ? 'Avail' : event.type === 'match' ? 'Match' : 'Invite'}</span>
                          </div>
                          {event.start_time && (
                            <div className="text-[9px] sm:text-[10px] opacity-75 mt-0.5">
                              {event.start_time.slice(0, 5)}
                            </div>
                          )}
                        </div>
                      ))}
                      {events.length > (viewMode === 'month' ? 2 : 5) && (
                        <div className="text-[10px] sm:text-xs text-muted-foreground pl-1">
                          +{events.length - (viewMode === 'month' ? 2 : 5)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Access Sections */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pending Invites */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-orange-500/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                      <Mail className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="font-semibold text-sm">Pending Invites</h3>
                  </div>
                  <Badge variant="secondary">{pendingInvites.length}</Badge>
                </div>
                <div className="space-y-2">
                  {pendingInvites.slice(0, 3).map((invite) => {
                    const sender = invite.sender;
                    const senderName = sender 
                      ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() 
                      : 'Unknown';
                    return (
                      <div
                        key={invite.id}
                        onClick={() => handleEventClick({
                          type: 'invite',
                          id: invite.id,
                          date: invite.date,
                          start_time: invite.start_time,
                          end_time: invite.end_time,
                          title: `Invite from ${senderName}`,
                          color: 'bg-orange-100',
                          data: invite
                        })}
                        className="p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                      >
                        <p className="text-xs font-medium truncate">{senderName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(invite.date), 'MMM d')} • {invite.start_time?.slice(0, 5)}
                        </p>
                      </div>
                    );
                  })}
                  {pendingInvites.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No pending invites</p>
                  )}
                  {pendingInvites.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">+{pendingInvites.length - 3} more</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Matches */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-semibold text-sm">Upcoming Matches</h3>
                  </div>
                  <Badge variant="secondary">{confirmedMatches.filter(m => isFuture(parseISO(m.date!))).length}</Badge>
                </div>
                <div className="space-y-2">
                  {confirmedMatches
                    .filter(match => match.date && isFuture(parseISO(match.date)))
                    .slice(0, 3)
                    .map((match) => {
                      const opponent = match.sender_id !== match.receiver_id 
                        ? (match.sender || match.receiver)
                        : match.receiver;
                      const opponentName = opponent 
                        ? `${opponent.first_name || ''} ${opponent.last_name || ''}`.trim() 
                        : 'Unknown';
                      return (
                        <div
                          key={match.id}
                          onClick={() => handleEventClick({
                            type: 'match',
                            id: match.id,
                            date: match.date!,
                            start_time: match.start_time,
                            end_time: match.end_time,
                            title: `Match vs ${opponentName}`,
                            color: 'bg-blue-100',
                            data: match
                          })}
                          className="p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                        >
                          <p className="text-xs font-medium truncate">vs {opponentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(match.date!), 'MMM d')} • {match.start_time?.slice(0, 5)}
                          </p>
                        </div>
                      );
                    })}
                  {confirmedMatches.filter(m => m.date && isFuture(parseISO(m.date))).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No upcoming matches</p>
                  )}
                  {confirmedMatches.filter(m => m.date && isFuture(parseISO(m.date))).length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{confirmedMatches.filter(m => m.date && isFuture(parseISO(m.date))).length - 3} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Available Slots */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-500/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-semibold text-sm">Available Slots</h3>
                  </div>
                  <Badge variant="secondary">
                    {availability?.filter(slot => slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date))).length || 0}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {availability
                    ?.filter(slot => slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date)))
                    .slice(0, 3)
                    .map((slot) => (
                      <div
                        key={slot.id}
                        onClick={() => handleEventClick({
                          type: 'availability',
                          id: slot.id,
                          date: slot.date,
                          start_time: slot.start_time,
                          end_time: slot.end_time,
                          title: 'Available',
                          color: 'bg-green-100',
                          data: slot
                        })}
                        className="p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                      >
                        <p className="text-xs font-medium">Available to play</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(slot.date), 'MMM d')} • {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        </p>
                      </div>
                    ))}
                  {(!availability || availability.filter(slot => slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date))).length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-2">No available slots</p>
                  )}
                  {availability && availability.filter(slot => slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date))).length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{availability.filter(slot => slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date))).length - 3} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Availability Modal */}
      <EnhancedAvailabilityModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSelectedDate(null);
        }}
        selectedDate={selectedDate}
        onSuccess={() => {
          setShowAddModal(false);
          setSelectedDate(null);
        }}
      />

      {/* Event Details Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedEvent.type === 'availability' && <Clock className="h-5 w-5 text-green-600" />}
                  {selectedEvent.type === 'match' && <CheckCircle2 className="h-5 w-5 text-blue-600" />}
                  {selectedEvent.type === 'invite' && <Mail className="h-5 w-5 text-orange-600" />}
                  {selectedEvent.title}
                </DialogTitle>
                <DialogDescription>
                  {format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Time */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {selectedEvent.start_time?.slice(0, 5)} - {selectedEvent.end_time?.slice(0, 5)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getTimezoneDisplayName(timezone)}
                    </Badge>
                  </div>
                  
                  {/* Show original time if converted */}
                  {selectedEvent.originalTimezone && selectedEvent.originalTimezone !== timezone && (
                    <div className="flex items-center gap-2 ml-6 text-xs text-muted-foreground">
                      <span>
                        Original: {selectedEvent.originalStartTime?.slice(0, 5)} - {selectedEvent.originalEndTime?.slice(0, 5)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {getTimezoneDisplayName(selectedEvent.originalTimezone)}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Message for invites */}
                {selectedEvent.type === 'invite' && selectedEvent.data.message && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm italic">"{selectedEvent.data.message}"</p>
                  </div>
                )}

                {/* Location for matches */}
                {selectedEvent.type === 'match' && selectedEvent.data.court_location && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm">{selectedEvent.data.court_location}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  {selectedEvent.type === 'invite' && (
                    <>
                      <Button
                        onClick={() => handleRespondToInvite(selectedEvent.id, 'accepted')}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        Accept
                      </Button>
                      <Button
                        onClick={() => handleRespondToInvite(selectedEvent.id, 'declined')}
                        variant="outline"
                        className="flex-1"
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  
                  {selectedEvent.type === 'availability' && (
                    <Button
                      onClick={(e) => handleDeleteClick(
                        selectedEvent.id, 
                        'availability',
                        e
                      )}
                      variant="destructive"
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}

                  {selectedEvent.type === 'match' && isPast(parseISO(selectedEvent.date)) && (
                    <Button
                      onClick={(e) => handleDeleteClick(
                        selectedEvent.id, 
                        'invite',
                        e
                      )}
                      variant="destructive"
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}

                  {selectedEvent.type === 'match' && isFuture(parseISO(selectedEvent.date)) && (
                    <Button
                      onClick={() => handleCancelMatch(selectedEvent.id)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Cancel Match
                    </Button>
                  )}

                  <Button
                    onClick={() => setShowEventDialog(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingItem?.type === 'availability' ? 'Availability' : 'Match'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this {deletingItem?.type === 'availability' ? 'availability slot' : 'match'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Match Confirmation Dialog */}
      <AlertDialog open={!!cancellingMatch} onOpenChange={() => setCancellingMatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel This Match?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this upcoming match? Your opponent will be notified of the cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Match</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelMatch}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Cancel Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
