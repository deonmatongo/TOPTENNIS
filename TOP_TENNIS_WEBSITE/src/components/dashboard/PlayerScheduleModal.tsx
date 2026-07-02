import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, List, User, Clock, AlertCircle, CheckCircle, Users, UserPlus, Zap } from 'lucide-react';
import { AvailableSlotsList } from './AvailableSlotsList';
import { BookingModal } from './BookingModal';
import { ScheduleCalendar } from './ScheduleCalendar';
import { SchedulingAssistant } from './SchedulingAssistant';
import { usePlayerAvailability } from '@/hooks/usePlayerAvailability';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchBookings } from '@/hooks/useMatchBookings';
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfWeek, parseISO, isSameDay } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';
import type { SearchResult } from '@/hooks/usePlayerSearch';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';

type SchedulePlayer = (SearchResult | Tables<'players'>) & {
  avatar_url?: string | null;
};

type HourlySlotSelection = {
  parentId: string;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
};

type SelectedSlot = {
  date: Date;
  startTime: string;
  endTime: string;
  availabilityId?: string;
  selectedHours?: HourlySlotSelection[];
};

interface PlayerScheduleModalProps {
  open: boolean;
  onClose: () => void;
  player: SchedulePlayer | null;
  onInviteSent?: () => void;
  groupMembers?: { user_id: string; name: string }[];
  onCancelAll?: () => void;
}

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const timeLabel = (t: string) => {
  const [h] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${period}`;
};

const slotTimeOfDay = (t: string): 'morning' | 'afternoon' | 'evening' => {
  const [h] = t.split(':').map(Number);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

const timeOfDayStyles = {
  morning:   { pill: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/50', dot: 'bg-amber-400' },
  afternoon: { pill: 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-900/50', dot: 'bg-sky-400' },
  evening:   { pill: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/50', dot: 'bg-purple-400' },
};

export const PlayerScheduleModal: React.FC<PlayerScheduleModalProps> = ({
  open,
  onClose,
  player,
  onInviteSent,
  groupMembers,
  onCancelAll,
}) => {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [assistantWeekStart, setAssistantWeekStart] = useState(
    () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  );

  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { sendFriendRequest, updateRequestStatus, getRelationshipWith, requests } = useFriendRequests();
  const { availability: myAvailability } = useUserAvailability();

  const opponentUserId = player ? ((player.user_id ?? player.id) || undefined) : undefined;
  const relationship = getRelationshipWith(opponentUserId);
  const isFriendOrSelf = relationship === 'friends' || opponentUserId === user?.id;

  const { availability } = usePlayerAvailability(opponentUserId);
  const { createBooking, isSlotBooked } = useMatchBookings();

  const incomingRequest = requests.find(
    r => r.status === 'pending' && r.sender_id === opponentUserId && r.receiver_id === user?.id,
  );

  const opponentName = player?.name || 'Player';

  const handleSendFriendRequest = async () => {
    if (!opponentUserId) return;
    try {
      await sendFriendRequest(opponentUserId);
      toast.success('Friend request sent');
    } catch { toast.error('Failed to send friend request'); }
  };

  const handleRespondToRequest = async (status: 'accepted' | 'declined') => {
    if (!incomingRequest) return;
    try {
      await updateRequestStatus(incomingRequest.id, status);
      toast.success(status === 'accepted' ? 'Friend request accepted' : 'Request declined');
    } catch { toast.error('Failed to update request'); }
  };

  const handleSelectSlots = (slots: HourlySlotSelection[]) => {
    if (slots.length === 0) return;
    const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
    setSelectedSlot({
      date: new Date(sorted[0].date),
      startTime: sorted[0].start_time,
      endTime: sorted[sorted.length - 1].end_time,
      availabilityId: sorted[0].parentId,
      selectedHours: slots,
    });
    setShowBookingModal(true);
  };

  const handleSelectSlot = (date: Date, startTime: string, endTime: string, availabilityId?: string) => {
    setSelectedSlot({ date, startTime, endTime, availabilityId });
    setShowBookingModal(true);
  };

  const handleBookingConfirm = async (courtLocation?: string, message?: string, additionalMemberIds?: string[]) => {
    if (!selectedSlot || !player) return;
    const opponentId = (player.user_id ?? player.id) as string;
    const slotDate = format(selectedSlot.date, 'yyyy-MM-dd');
    try {
      await createBooking({
        opponent_id: opponentId,
        availability_id: selectedSlot.availabilityId,
        date: slotDate,
        start_time: selectedSlot.startTime,
        end_time: selectedSlot.endTime,
        court_location: courtLocation,
        message,
      });
      if (additionalMemberIds?.length) {
        await Promise.all(
          additionalMemberIds.map(memberId =>
            createBooking({ opponent_id: memberId, date: slotDate, start_time: selectedSlot.startTime, end_time: selectedSlot.endTime, court_location: courtLocation, message })
          )
        );
      }
      const extra = additionalMemberIds?.length ?? 0;
      toast.success(extra > 0
        ? `Match request sent to ${opponentName} + ${extra} group member${extra !== 1 ? 's' : ''}!`
        : `Match request sent to ${opponentName}!`
      );
      setShowBookingModal(false);
      setSelectedSlot(null);
      onInviteSent?.();
    } catch (err) {
      console.error('Error creating booking:', err);
    }
  };

  const totalHours = availability?.reduce((sum, slot) => {
    if (!slot.is_available || slot.is_blocked) return sum;
    const start = new Date(`2000-01-01T${slot.start_time}`);
    const end = new Date(`2000-01-01T${slot.end_time}`);
    return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }, 0) || 0;

  const availabilityDates = useMemo(() => {
    const dateMap = new Map<string, boolean>();
    availability
      ?.filter(slot => slot.is_available && !slot.is_blocked)
      .forEach(slot => {
        if (dateMap.has(slot.date)) return;
        const booked = isSlotBooked(slot.date, slot.start_time, slot.end_time, opponentUserId);
        if (!booked) dateMap.set(slot.date, true);
      });
    return Array.from(dateMap.keys()).map(d => parseISO(d));
  }, [availability, isSlotBooked, opponentUserId]);

  const selectedDateSlots = useMemo(() => {
    return availability?.filter(slot =>
      slot.is_available &&
      !slot.is_blocked &&
      isSameDay(parseISO(slot.date), selectedDate) &&
      !isSlotBooked(slot.date, slot.start_time, slot.end_time, opponentUserId)
    ) || [];
  }, [availability, selectedDate, isSlotBooked, opponentUserId]);

  const totalSlots = availability?.filter(a => a.is_available && !a.is_blocked).length || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">

          {/* ── Hero header ─────────────────────────────────────────────── */}
          <div className="relative pt-4 pb-4 px-4 sm:px-6 shrink-0" style={{ background: '#F97316' }}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />

            <DialogTitle className="sr-only">Schedule Match with {opponentName}</DialogTitle>
            <DialogDescription className="sr-only">
              View {opponentName}'s availability and send a match request
            </DialogDescription>

            <div className="relative flex items-center gap-4">
              {/* Avatar */}
              <Avatar className="w-14 h-14 rounded-full border-2 border-white/40 shadow-lg shrink-0">
                <AvatarImage
                  src={(player as any)?.profile_picture_url ?? (player as any)?.avatar_url ?? undefined}
                  alt={opponentName}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-full bg-white/20 backdrop-blur-sm text-white text-xl font-bold">
                  {initials(opponentName)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-0.5">Match Request</p>
                <h2 className="text-xl font-bold text-white leading-tight truncate">{opponentName}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">
                    <Calendar className="w-3 h-3" />
                    {availabilityDates.length} available {availabilityDates.length === 1 ? 'day' : 'days'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">
                    <Clock className="w-3 h-3" />
                    {Math.round(totalHours)} {Math.round(totalHours) === 1 ? 'hour' : 'hours'} open
                  </span>
                  {relationship === 'friends' && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">
                      <Users className="w-3 h-3" />Friends
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Friend restriction banner ────────────────────────────────── */}
          {!isFriendOrSelf && (
            <div className="flex items-center justify-between gap-4 px-6 py-3 bg-orange-500 border-b border-orange-600 shrink-0">
              <div className="flex items-center gap-2 text-sm text-white">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Showing public availability only. Connect as friends to see all time slots.</span>
              </div>
              {relationship === 'pending_received' ? (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => handleRespondToRequest('accepted')}>Accept</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs border border-white/40 text-white hover:bg-white/20 hover:text-white" onClick={() => handleRespondToRequest('declined')}>Decline</Button>
                </div>
              ) : relationship === 'pending_sent' ? (
                <Badge className="shrink-0 bg-white/20 text-white border-white/30">Request Sent</Badge>
              ) : (
                <Button size="sm" className="h-8 text-xs shrink-0 bg-white text-orange-600 hover:bg-white/90" onClick={handleSendFriendRequest} disabled={!opponentUserId || opponentUserId === user?.id}>
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />Add Friend
                </Button>
              )}
            </div>
          )}

          {/* ── Tabs ────────────────────────────────────────────────────── */}
          <Tabs defaultValue="calendar" className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="px-3 sm:px-6 pt-3 pb-0 shrink-0">
              <TabsList className="grid grid-cols-3 w-full sm:w-80">
                <TabsTrigger value="calendar" className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4" />Calendar
                </TabsTrigger>
                <TabsTrigger value="list" className="flex items-center gap-2 text-sm">
                  <List className="w-4 h-4" />All Slots
                </TabsTrigger>
                <TabsTrigger value="assistant" className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4" />Find Time
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Calendar tab ─────────────────────────────────────────── */}
            <TabsContent value="calendar" className="flex-1 overflow-auto mt-0 p-3 sm:p-6 space-y-4">

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-5 gap-y-1.5 px-1 pb-1 border-b border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">Legend</p>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />Available day
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-lg ring-2 ring-primary ring-offset-1 bg-transparent flex items-center justify-center text-[10px] font-semibold">9</span>Today
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-lg bg-primary flex items-center justify-center text-[10px] font-semibold text-primary-foreground">9</span>Selected
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-lg bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground/50">9</span>Past / unavailable
                </span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />Morning
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />Afternoon
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />Evening
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Calendar */}
                <ScheduleCalendar
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  onPrevMonth={() => setCurrentDate(subMonths(currentDate, 1))}
                  onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
                  onToday={() => { const t = new Date(); setCurrentDate(t); setSelectedDate(t); }}
                  availabilityDates={availabilityDates}
                  onAddAvailability={() => {}}
                />

                {/* Time slots for selected date */}
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-foreground">
                      {format(selectedDate, 'EEEE, MMMM d')}
                    </h3>
                    {selectedDateSlots.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {selectedDateSlots.length} {selectedDateSlots.length === 1 ? 'slot' : 'slots'}
                      </Badge>
                    )}
                  </div>

                  {selectedDateSlots.length > 0 ? (
                    <div className="space-y-2 overflow-y-auto">
                      {selectedDateSlots.map(slot => {
                        const tod = slotTimeOfDay(slot.start_time);
                        const styles = timeOfDayStyles[tod];
                        return (
                          <button
                            key={slot.id}
                            onClick={() => handleSelectSlot(selectedDate, slot.start_time, slot.end_time, slot.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${styles.pill} group`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-2 h-2 rounded-full ${styles.dot} shrink-0`} />
                                <span className="font-semibold text-sm">
                                  {timeLabel(slot.start_time)} – {timeLabel(slot.end_time)}
                                </span>
                              </div>
                              <span className="text-xs opacity-60 capitalize group-hover:opacity-80">{tod}</span>
                            </div>
                            {slot.notes && (
                              <p className="text-xs opacity-70 mt-1 ml-4.5 pl-[22px]">{slot.notes}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border bg-muted/20">
                      <Calendar className="w-10 h-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No slots on this day</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {availabilityDates.length > 0
                          ? 'Select a highlighted date to see available times'
                          : `${opponentName} hasn't added availability yet`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* How it works strip */}
              <div className="rounded-xl bg-muted/30 border border-border/50 px-5 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">How to send a match request</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
                  {[
                    { step: '1', icon: Calendar, label: 'Pick a highlighted date on the calendar' },
                    { step: '2', icon: Clock,    label: 'Select a time slot that works for you' },
                    { step: '3', icon: CheckCircle, label: 'Confirm and your match request is sent' },
                  ].map(({ step, icon: Icon, label }) => (
                    <div key={step} className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── List tab ─────────────────────────────────────────────── */}
            <TabsContent value="list" className="flex-1 overflow-auto mt-0 px-3 sm:px-6 py-4">
              {totalSlots > 0 ? (
                <AvailableSlotsList
                  availability={availability || []}
                  onSelectSlots={handleSelectSlots}
                  isBooked={(date, startTime, endTime) =>
                    isSlotBooked(date, startTime, endTime, player?.user_id || player?.id)
                  }
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">No available times</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {opponentName} hasn't added any availability yet. Check back later or send them a message.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ── Scheduling Assistant tab ─────────────────────────────── */}
            <TabsContent value="assistant" className="flex-1 overflow-auto mt-0 px-3 sm:px-6 py-4">
              <SchedulingAssistant
                myAvailability={myAvailability}
                theirAvailability={availability || []}
                myName={profile?.first_name ? `${profile.first_name} ${profile.last_name ?? ''}`.trim() : 'You'}
                theirName={opponentName}
                weekStart={assistantWeekStart}
                onPrevWeek={() => setAssistantWeekStart(w => subWeeks(w, 1))}
                onNextWeek={() => setAssistantWeekStart(w => addWeeks(w, 1))}
                onThisWeek={() => setAssistantWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                onSelectSlot={handleSelectSlot}
                isBooked={(date, startTime, endTime) =>
                  isSlotBooked(date, startTime, endTime, player?.user_id || player?.id)
                }
              />
            </TabsContent>
          </Tabs>

          {/* Cancel footer — group context only */}
          {onCancelAll && (
            <div className="px-6 pb-4 pt-2 border-t shrink-0 flex justify-center">
              <button
                onClick={onCancelAll}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
              >
                Cancel match request
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedSlot && (
        <BookingModal
          open={showBookingModal}
          onClose={() => { setShowBookingModal(false); setSelectedSlot(null); }}
          onConfirm={handleBookingConfirm}
          slot={selectedSlot}
          opponent={player}
          groupMembers={groupMembers?.filter(m => m.user_id !== opponentUserId)}
          onCancelAll={onCancelAll}
        />
      )}
    </>
  );
};
