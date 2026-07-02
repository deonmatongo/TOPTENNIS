import React, { useState, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import momentTimezonePlugin from '@fullcalendar/moment-timezone';
import type { EventClickArg, DateClickArg, EventContentArg } from '@fullcalendar/core';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Users,
  Mail,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Globe,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAvailabilityContext } from '@/contexts/AvailabilityContext';
import { useMatchInvitesContext } from '@/contexts/MatchInvitesContext';
import { useNotificationsContext } from '@/contexts/NotificationsContext';
import { useUserTimezone } from '@/hooks/useUserTimezone';
import { TimezoneSelect } from '@/components/ui/TimezoneSelect';
import { convertTimeBetweenTimezones, getTimezoneDisplayName } from '@/utils/timezoneConversion';
import { EnhancedAvailabilityModal } from '@/components/dashboard/EnhancedAvailabilityModal';
import {
  format,
  parseISO,
  isPast,
  isFuture,
  startOfDay,
  isToday,
  startOfWeek,
  endOfWeek,
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
import PlayerProfileModal from '@/components/dashboard/PlayerProfileModal';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarScheduleViewProps {
  preSelectedOpponent?: { id?: string; name?: string } | null;
  onClearOpponent?: () => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  preSelectedOpponent,
  onClearOpponent,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<{ start: string; end: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{
    id: string;
    type: 'availability' | 'invite';
  } | null>(null);
  const [cancellingMatch, setCancellingMatch] = useState<string | null>(null);
  const [showInviterProfile, setShowInviterProfile] = useState(false);

  const calendarRef = useRef<any>(null);

  const { user } = useAuth();
  const {
    availability,
    deleteAvailability,
    createAvailability,
    updateAvailability,
  } = useAvailabilityContext();
  const {
    getPendingInvites,
    getSentInvites,
    getConfirmedInvites,
    respondToInvite,
    deleteInvite,
    cancelInvite,
  } = useMatchInvitesContext();
  const { notifications, markAsRead } = useNotificationsContext();
  const { timezone, updateTimezone } = useUserTimezone();

  const pendingInvites = getPendingInvites();
  const confirmedMatches = getConfirmedInvites();
  const sentPendingInvites = getSentInvites().filter((i) => i.status === 'pending');

  // ── FullCalendar event list ────────────────────────────────────────────────

  const fcEvents = useMemo(() => {
    const events: any[] = [];
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    // Build conflict-lookup maps
    const confirmedRangesByDate: Record<string, Array<{ start: number; end: number }>> = {};
    confirmedMatches?.forEach((match) => {
      if (match.status === 'accepted' && match.date && match.start_time && match.end_time) {
        if (!confirmedRangesByDate[match.date]) confirmedRangesByDate[match.date] = [];
        confirmedRangesByDate[match.date].push({
          start: toMin(match.start_time),
          end: toMin(match.end_time),
        });
      }
    });

    const sentPendingRangesByDate: Record<string, Array<{ start: number; end: number }>> = {};
    sentPendingInvites?.forEach((invite) => {
      if (invite.date && invite.start_time && invite.end_time) {
        if (!sentPendingRangesByDate[invite.date]) sentPendingRangesByDate[invite.date] = [];
        sentPendingRangesByDate[invite.date].push({
          start: toMin(invite.start_time),
          end: toMin(invite.end_time),
        });
      }
    });

    const overlapsActiveBooking = (date: string, startTime: string, endTime: string): boolean => {
      const s = toMin(startTime);
      const e = toMin(endTime);
      if (confirmedRangesByDate[date]?.some((r) => s < r.end && e > r.start)) return true;
      if (sentPendingRangesByDate[date]?.some((r) => s < r.end && e > r.start)) return true;
      return false;
    };

    // Available slots
    availability?.forEach((slot) => {
      if (!slot.is_available || slot.is_blocked) return;
      if (overlapsActiveBooking(slot.date, slot.start_time, slot.end_time)) return;

      const slotTz = slot.timezone || 'America/New_York';
      const dispStart =
        slotTz !== timezone
          ? convertTimeBetweenTimezones(slot.start_time, slotTz, timezone, slot.date)
          : slot.start_time;
      const dispEnd =
        slotTz !== timezone
          ? convertTimeBetweenTimezones(slot.end_time, slotTz, timezone, slot.date)
          : slot.end_time;

      events.push({
        id: slot.id,
        title: 'Available',
        start: `${slot.date}T${dispStart}`,
        end: `${slot.date}T${dispEnd}`,
        backgroundColor: '#22c55e',
        borderColor: '#16a34a',
        textColor: '#ffffff',
        extendedProps: {
          rawEvent: {
            type: 'availability',
            id: slot.id,
            date: slot.date,
            start_time: dispStart,
            end_time: dispEnd,
            originalStartTime: slot.start_time,
            originalEndTime: slot.end_time,
            originalTimezone: slotTz,
            title: 'Available',
            color: 'bg-green-500 text-white border-green-600',
            data: slot,
          },
        },
      });
    });

    // Confirmed matches
    confirmedMatches?.forEach((match) => {
      if (match.status !== 'accepted' || !match.date) return;
      const opp = match.sender_id === user?.id ? match.receiver : match.sender;
      const oppName = opp
        ? `${opp.first_name || ''} ${opp.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown';
      const matchTz = (match as any).timezone || 'America/New_York';
      const dispStart =
        matchTz !== timezone
          ? convertTimeBetweenTimezones(match.start_time, matchTz, timezone, match.date)
          : match.start_time;
      const dispEnd =
        matchTz !== timezone
          ? convertTimeBetweenTimezones(match.end_time, matchTz, timezone, match.date)
          : match.end_time;

      events.push({
        id: match.id,
        title: `Match vs ${oppName}`,
        start: `${match.date}T${dispStart}`,
        end: `${match.date}T${dispEnd}`,
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        textColor: '#ffffff',
        extendedProps: {
          rawEvent: {
            type: 'match',
            id: match.id,
            date: match.date,
            start_time: dispStart,
            end_time: dispEnd,
            originalStartTime: match.start_time,
            originalEndTime: match.end_time,
            originalTimezone: matchTz,
            title: `Match vs ${oppName}`,
            color: 'bg-blue-500 text-white border-blue-600',
            data: match,
          },
        },
      });
    });

    // Received pending invites
    pendingInvites?.forEach((invite) => {
      if (!invite.date) return;
      const sender = invite.sender;
      const senderName = sender
        ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
        : 'Unknown';
      const invTz = (invite as any).timezone || 'America/New_York';
      const dispStart =
        invTz !== timezone
          ? convertTimeBetweenTimezones(invite.start_time, invTz, timezone, invite.date)
          : invite.start_time;
      const dispEnd =
        invTz !== timezone
          ? convertTimeBetweenTimezones(invite.end_time, invTz, timezone, invite.date)
          : invite.end_time;

      events.push({
        id: invite.id,
        title: `Invite from ${senderName}`,
        start: `${invite.date}T${dispStart}`,
        end: `${invite.date}T${dispEnd}`,
        backgroundColor: '#f97316',
        borderColor: '#ea580c',
        textColor: '#ffffff',
        extendedProps: {
          rawEvent: {
            type: 'invite',
            id: invite.id,
            date: invite.date,
            start_time: dispStart,
            end_time: dispEnd,
            originalStartTime: invite.start_time,
            originalEndTime: invite.end_time,
            originalTimezone: invTz,
            title: `Invite from ${senderName}`,
            color: 'bg-orange-500 text-white border-orange-600',
            data: invite,
          },
        },
      });
    });

    // Sent pending invites
    sentPendingInvites?.forEach((invite) => {
      if (!invite.date) return;
      const receiver = invite.receiver;
      const receiverName = receiver
        ? `${receiver.first_name || ''} ${receiver.last_name || ''}`.trim()
        : 'Unknown';
      const invTz = (invite as any).timezone || 'America/New_York';
      const dispStart =
        invTz !== timezone
          ? convertTimeBetweenTimezones(invite.start_time, invTz, timezone, invite.date)
          : invite.start_time;
      const dispEnd =
        invTz !== timezone
          ? convertTimeBetweenTimezones(invite.end_time, invTz, timezone, invite.date)
          : invite.end_time;

      events.push({
        id: invite.id,
        title: `Invite to ${receiverName}`,
        start: `${invite.date}T${dispStart}`,
        end: `${invite.date}T${dispEnd}`,
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        textColor: '#ffffff',
        extendedProps: {
          rawEvent: {
            type: 'sent_invite',
            id: invite.id,
            date: invite.date,
            start_time: dispStart,
            end_time: dispEnd,
            originalStartTime: invite.start_time,
            originalEndTime: invite.end_time,
            originalTimezone: invTz,
            title: `Invite to ${receiverName}`,
            color: 'bg-amber-500 text-white border-amber-600',
            data: invite,
          },
        },
      });
    });

    return events;
  }, [availability, confirmedMatches, pendingInvites, sentPendingInvites, timezone, user?.id]);

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const viewMap: Record<ViewMode, string> = {
    day: 'timeGridDay',
    week: 'timeGridWeek',
    month: 'dayGridMonth',
  };

  const handlePrevious = () => calendarRef.current?.getApi().prev();
  const handleNext = () => calendarRef.current?.getApi().next();
  const handleToday = () => calendarRef.current?.getApi().today();

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    calendarRef.current?.getApi().changeView(viewMap[mode]);
  };

  // ── Interaction handlers ───────────────────────────────────────────────────

  const handleDateClick = (date: Date, startTime?: string) => {
    setCurrentDate(date);
    setSelectedDate(date);
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHour = hours + 1;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      setSelectedTime({ start: startTime, end: endTime });
    } else {
      setSelectedTime(null);
    }
    setShowAddModal(true);
  };

  const handleFCDateClick = (info: DateClickArg) => {
    if (isPast(startOfDay(info.date)) && !isToday(info.date)) return;
    const startTime = !info.allDay
      ? `${String(info.date.getHours()).padStart(2, '0')}:${String(info.date.getMinutes()).padStart(2, '0')}`
      : undefined;
    handleDateClick(info.date, startTime);
  };

  const handleEventClick = (event: any) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  };

  const handleFCEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    handleEventClick(info.event.extendedProps.rawEvent);
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

  const handleCancelMatch = (matchId: string) => setCancellingMatch(matchId);

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
      const matchNotificationTypes = ['match_invite', 'match_rescheduled', 'match_accepted'];
      notifications
        .filter(
          (n) =>
            !n.read &&
            matchNotificationTypes.includes(n.type) &&
            n.metadata?.match_id === inviteId,
        )
        .forEach((n) => markAsRead(n.id));
      await respondToInvite(inviteId, response);
      setShowEventDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  // ── Header title ───────────────────────────────────────────────────────────

  const getHeaderTitle = () => {
    if (viewMode === 'day') {
      if (isToday(currentDate)) return 'Today';
      return format(currentDate, 'EEEE, MMMM d');
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  };

  // ── FullCalendar event content ─────────────────────────────────────────────

  const renderEventContent = (info: EventContentArg) => {
    const { rawEvent } = info.event.extendedProps;
    return (
      <div className="flex items-center gap-1 px-1 overflow-hidden w-full min-w-0">
        {rawEvent.type === 'availability' && <Clock className="h-3 w-3 shrink-0" />}
        {rawEvent.type === 'match' && <CheckCircle2 className="h-3 w-3 shrink-0" />}
        {(rawEvent.type === 'invite' || rawEvent.type === 'sent_invite') && (
          <Mail className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate text-xs font-medium leading-none">{info.event.title}</span>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="p-4 space-y-4">
          {/* Pre-selected Opponent Banner */}
          {preSelectedOpponent && preSelectedOpponent.name && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-orange-500 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full shrink-0">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    Ready to schedule with {preSelectedOpponent.name}
                  </p>
                  <p className="text-xs text-white/80">
                    Click any date to add your availability
                  </p>
                </div>
              </div>
              {onClearOpponent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearOpponent}
                  className="text-white hover:bg-white/20 hover:text-white h-7 px-2 text-xs shrink-0"
                >
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Calendar toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Nav arrows */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Title */}
            <h2 className="text-sm sm:text-base font-semibold flex-1 min-w-0 truncate">
              {getHeaderTitle()}
            </h2>

            {/* View mode toggle */}
            <div className="flex border rounded-lg overflow-hidden shrink-0">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewChange(mode)}
                  className="rounded-none h-8 px-3 text-xs capitalize"
                >
                  {mode}
                </Button>
              ))}
            </div>

            {/* Timezone + Add */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
              <div className="flex-1 sm:flex-none sm:min-w-[150px]">
                <TimezoneSelect
                  value={timezone}
                  onValueChange={updateTimezone}
                  placeholder="Timezone"
                />
              </div>
              <Button
                onClick={() => handleDateClick(new Date())}
                size="sm"
                className="h-8 px-2 sm:px-3 text-xs shrink-0"
              >
                <Plus className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Add Availability</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-5 gap-y-1.5 px-1 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Legend</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-500 shrink-0" />
              Available slot
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500 shrink-0" />
              Confirmed match
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-orange-500 shrink-0" />
              Pending invite
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500 shrink-0" />
              Sent invite
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full ring-2 ring-primary ring-offset-1 shrink-0" />
              Today
            </span>
            <span className="hidden sm:block ml-auto text-[11px]">
              Click any empty time slot to add availability
            </span>
          </div>

          {/* FullCalendar */}
          <div className="border rounded-lg bg-card overflow-hidden fc-wrapper">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, momentTimezonePlugin]}
              timeZone={timezone}
              initialView="timeGridDay"
              headerToolbar={false}
              events={fcEvents}
              dateClick={handleFCDateClick}
              eventClick={handleFCEventClick}
              eventContent={renderEventContent}
              datesSet={(info) => setCurrentDate(info.view.currentStart)}
              nowIndicator={true}
              scrollTime="07:00:00"
              height="auto"
              contentHeight={600}
              allDaySlot={false}
              dayMaxEvents={3}
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              slotDuration="01:00:00"
              expandRows={true}
              stickyHeaderDates={true}
            />
          </div>

          {/* Quick Access Sections */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pending Invites */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <Mail className="h-5 w-5 text-white" />
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
                        onClick={() =>
                          handleEventClick({
                            type: 'invite',
                            id: invite.id,
                            date: invite.date,
                            start_time: invite.start_time,
                            end_time: invite.end_time,
                            title: `Invite from ${senderName}`,
                            color: 'bg-orange-500 text-white border-orange-600',
                            data: invite,
                          })
                        }
                        className="p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                      >
                        <p className="text-xs font-medium truncate">{senderName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(invite.date), 'MMM d')} •{' '}
                          {invite.start_time?.slice(0, 5)}
                        </p>
                      </div>
                    );
                  })}
                  {pendingInvites.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No pending invites
                    </p>
                  )}
                  {pendingInvites.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{pendingInvites.length - 3} more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Matches */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm">Upcoming Matches</h3>
                  </div>
                  <Badge variant="secondary">
                    {confirmedMatches.filter((m) => m.date && isFuture(parseISO(m.date))).length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {confirmedMatches
                    .filter((match) => match.date && isFuture(parseISO(match.date)))
                    .slice(0, 3)
                    .map((match) => {
                      const opponent =
                        match.sender_id !== match.receiver_id
                          ? match.sender || match.receiver
                          : match.receiver;
                      const opponentName = opponent
                        ? `${opponent.first_name || ''} ${opponent.last_name || ''}`.trim()
                        : 'Unknown';
                      return (
                        <div
                          key={match.id}
                          onClick={() =>
                            handleEventClick({
                              type: 'match',
                              id: match.id,
                              date: match.date!,
                              start_time: match.start_time,
                              end_time: match.end_time,
                              title: `Match vs ${opponentName}`,
                              color: 'bg-blue-500 text-white border-blue-600',
                              data: match,
                            })
                          }
                          className="p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                        >
                          <p className="text-xs font-medium truncate">vs {opponentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(match.date!), 'MMM d')} •{' '}
                            {match.start_time?.slice(0, 5)}
                          </p>
                        </div>
                      );
                    })}
                  {confirmedMatches.filter((m) => m.date && isFuture(parseISO(m.date))).length ===
                    0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No upcoming matches
                    </p>
                  )}
                  {confirmedMatches.filter((m) => m.date && isFuture(parseISO(m.date))).length >
                    3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +
                      {confirmedMatches.filter((m) => m.date && isFuture(parseISO(m.date))).length -
                        3}{' '}
                      more
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Available Slots */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm">Available Slots</h3>
                  </div>
                  <Badge variant="secondary">
                    {availability?.filter(
                      (slot) =>
                        slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date)),
                    ).length || 0}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {availability
                    ?.filter(
                      (slot) =>
                        slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date)),
                    )
                    .slice(0, 3)
                    .map((slot) => (
                      <div
                        key={slot.id}
                        onClick={() =>
                          handleEventClick({
                            type: 'availability',
                            id: slot.id,
                            date: slot.date,
                            start_time: slot.start_time,
                            end_time: slot.end_time,
                            title: 'Available',
                            color: 'bg-green-500 text-white border-green-600',
                            data: slot,
                          })
                        }
                        className="p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                      >
                        <p className="text-xs font-medium">Available to play</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(slot.date), 'MMM d')} • {slot.start_time?.slice(0, 5)}{' '}
                          - {slot.end_time?.slice(0, 5)}
                        </p>
                      </div>
                    ))}
                  {(!availability ||
                    availability.filter(
                      (slot) =>
                        slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date)),
                    ).length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No available slots
                    </p>
                  )}
                  {availability &&
                    availability.filter(
                      (slot) =>
                        slot.is_available && !slot.is_blocked && isFuture(parseISO(slot.date)),
                    ).length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +
                        {availability.filter(
                          (slot) =>
                            slot.is_available &&
                            !slot.is_blocked &&
                            isFuture(parseISO(slot.date)),
                        ).length - 3}{' '}
                        more
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
          setSelectedTime(null);
        }}
        selectedDate={selectedDate || undefined}
        selectedStartTime={selectedTime?.start}
        selectedEndTime={selectedTime?.end}
        availabilityActions={{ createAvailability, updateAvailability }}
        onSuccess={() => {
          setShowAddModal(false);
          setSelectedDate(null);
          setSelectedTime(null);
        }}
      />

      {/* Event Details Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedEvent.type === 'availability' && (
                    <Clock className="h-5 w-5 text-green-600" />
                  )}
                  {selectedEvent.type === 'match' && (
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  )}
                  {selectedEvent.type === 'invite' && (
                    <Mail className="h-5 w-5 text-orange-600" />
                  )}
                  {selectedEvent.type === 'sent_invite' && (
                    <Mail className="h-5 w-5 text-amber-600" />
                  )}
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
                      {selectedEvent.start_time?.slice(0, 5)} -{' '}
                      {selectedEvent.end_time?.slice(0, 5)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getTimezoneDisplayName(timezone)}
                    </Badge>
                  </div>
                  {selectedEvent.originalTimezone &&
                    selectedEvent.originalTimezone !== timezone && (
                      <div className="flex items-center gap-2 ml-6 text-xs text-muted-foreground">
                        <span>
                          Original: {selectedEvent.originalStartTime?.slice(0, 5)} -{' '}
                          {selectedEvent.originalEndTime?.slice(0, 5)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {getTimezoneDisplayName(selectedEvent.originalTimezone)}
                        </Badge>
                      </div>
                    )}
                </div>

                {/* Message for invites */}
                {(selectedEvent.type === 'invite' || selectedEvent.type === 'sent_invite') &&
                  selectedEvent.data.message && (
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
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
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
                      {selectedEvent.data?.sender && (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setShowEventDialog(false);
                            setShowInviterProfile(true);
                          }}
                        >
                          <User className="h-4 w-4 mr-2" />
                          View Profile
                        </Button>
                      )}
                    </>
                  )}

                  {selectedEvent.type === 'sent_invite' && (
                    <Button
                      onClick={() => handleCancelMatch(selectedEvent.id)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Cancel Invite
                    </Button>
                  )}

                  {selectedEvent.type === 'availability' && (
                    <Button
                      onClick={(e) => handleDeleteClick(selectedEvent.id, 'availability', e)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}

                  {selectedEvent.type === 'match' && isPast(parseISO(selectedEvent.date)) && (
                    <Button
                      onClick={(e) => handleDeleteClick(selectedEvent.id, 'invite', e)}
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

      {/* Inviter Profile Modal */}
      {showInviterProfile &&
        selectedEvent?.data?.sender &&
        (() => {
          const sender = selectedEvent.data.sender;
          const player = {
            id: sender.user_id || selectedEvent.data.sender_id,
            user_id: sender.user_id || selectedEvent.data.sender_id,
            name:
              `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'Unknown Player',
            email: sender.email || '',
            skill_level: sender.skill_level ?? 0,
            wins: sender.wins ?? 0,
            losses: sender.losses ?? 0,
            usta_rating: sender.usta_rating,
            competitiveness: sender.competitiveness,
            age_range: sender.age_range,
            networking_enabled: sender.networking_enabled,
            first_name: sender.first_name,
            last_name: sender.last_name,
            profile_picture_url: sender.profile_picture_url || sender.avatar_url,
            gender: sender.gender,
          };
          return (
            <PlayerProfileModal
              player={player}
              isOpen={showInviterProfile}
              onClose={() => setShowInviterProfile(false)}
            />
          );
        })()}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingItem} onOpenChange={() => setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{' '}
              {deletingItem?.type === 'availability' ? 'Availability' : 'Match'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this{' '}
              {deletingItem?.type === 'availability' ? 'availability slot' : 'match'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
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
              Are you sure you want to cancel this upcoming match? Your opponent will be notified of
              the cancellation.
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
