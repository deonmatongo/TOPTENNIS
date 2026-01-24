import React, { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CalendarViewSelector, CalendarView } from './CalendarViewSelector';
import { EnhancedAvailabilityModal } from './EnhancedAvailabilityModal';
import { downloadICS } from '@/utils/icsExport';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchBookings } from '@/hooks/useMatchBookings';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Download, Edit, Trash2, MapPin, Clock, ChevronLeft, ChevronRight, Search, Video } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isSameDay, startOfMonth, endOfMonth, isToday, isTomorrow, parseISO, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

export const EnhancedCalendar = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<CalendarView>('week');
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { availability, deleteAvailability, loading: availabilityLoading } = useUserAvailability();
  const { bookings, loading: bookingsLoading } = useMatchBookings();

  // Set up real-time subscriptions for calendar updates
  useEffect(() => {
    // Subscribe to match_invites changes (bookings)
    const invitesChannel = supabase
      .channel('calendar-match-invites')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_invites'
        },
        (payload) => {
          console.log('Match invite changed:', payload);
          // Invalidate bookings query to refetch
          queryClient.invalidateQueries({ queryKey: ['match-invites'] });
          
          if (payload.eventType === 'UPDATE' && payload.new.status === 'accepted') {
            toast.success('Match confirmed! Your calendar has been updated.');
          }
        }
      )
      .subscribe();

    // Subscribe to matches table changes (league matches)
    const matchesChannel = supabase
      .channel('calendar-matches')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: 'invitation_status=in.(confirmed,accepted,rescheduled)'
        },
        (payload) => {
          console.log('Match status changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['matches'] });
          
          if (payload.new.invitation_status === 'confirmed') {
            toast.success('Match confirmed! Your calendar has been updated.');
          } else if (payload.new.invitation_status === 'rescheduled') {
            toast.info('Match time updated. Check your calendar for the new time.');
          }
        }
      )
      .subscribe();

    // Subscribe to match_responses changes
    const responsesChannel = supabase
      .channel('calendar-match-responses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_responses'
        },
        (payload) => {
          console.log('Match response changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['match-invites-pending'] });
          queryClient.invalidateQueries({ queryKey: ['matches'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invitesChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(responsesChannel);
    };
  }, [queryClient]);

  // Get events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return { availability: [], bookings: [] };

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    return {
      availability: availability.filter(a => a.date === dateStr),
      bookings: bookings.filter(b => b.date === dateStr && b.status === 'confirmed'),
    };
  }, [selectedDate, availability, bookings]);

  // Calendar day modifiers
  const modifiers = useMemo(() => {
    const availableDays = availability
      .filter(a => a.is_available && !a.is_blocked)
      .map(a => new Date(a.date));
    
    const bookedDays = bookings
      .filter(b => b.status === 'confirmed')
      .map(b => new Date(b.date));

    return {
      available: availableDays,
      booked: bookedDays,
    };
  }, [availability, bookings]);

  const modifiersClassNames = {
    available: 'bg-[hsl(var(--tennis-green-50))] text-[hsl(var(--tennis-green-600))] dark:bg-[hsl(var(--tennis-green-600))]/20 dark:text-[hsl(var(--tennis-green-500))]',
    booked: 'bg-[hsl(var(--tennis-blue-50))] text-[hsl(var(--tennis-blue-600))] dark:bg-[hsl(var(--tennis-blue-600))]/20 dark:text-[hsl(var(--tennis-blue-500))]',
  };

  const handleAddAvailability = () => {
    setEditingItem(null);
    setShowAvailabilityModal(true);
  };

  const handleEditAvailability = (item: any) => {
    setEditingItem(item);
    setShowAvailabilityModal(true);
  };

  const handleDeleteAvailability = async (id: string) => {
    if (confirm('Are you sure you want to delete this availability slot?')) {
      await deleteAvailability(id);
    }
  };

  const handleExportBooking = (booking: any) => {
    const startDateTime = new Date(`${booking.date}T${booking.start_time}`);
    const endDateTime = new Date(`${booking.date}T${booking.end_time}`);

    downloadICS({
      title: `Tennis Match`,
      description: `Match at ${booking.court_location || 'TBD'}`,
      location: booking.court_location || '',
      startDate: startDateTime,
      endDate: endDateTime,
      uid: booking.id,
    }, `tennis-match-${format(startDateTime, 'yyyy-MM-dd')}.ics`);

    toast.success('Calendar event exported');
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const hours = Array.from({ length: 24 }, (_, i) => i); // 0 AM to 11 PM (24 hours)

    return (
      <div className="flex flex-col h-full">
        {/* Header with days */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border sticky top-0 bg-card z-10">
          <div className="border-r border-border"></div>
          {daysInWeek.map((day) => {
            const isCurrentDay = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={`px-2 py-3 text-center border-l border-border ${
                  isCurrentDay ? 'bg-primary/5' : ''
                }`}
              >
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {format(day, 'EEE').toUpperCase()}
                </div>
                <div className={`text-2xl font-semibold mt-1 ${
                  isCurrentDay ? 'text-primary' : 'text-foreground'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border min-h-[48px]">
                {/* Time label on the left */}
                <div className="px-2 py-1 text-xs text-muted-foreground text-right border-r border-border bg-muted/20">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                
                {/* Day columns */}
                {daysInWeek.map((day) => {
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                  const nextHourStr = `${((hour + 1) % 24).toString().padStart(2, '0')}:00`;
                  
                  const dayAvailability = availability.filter(
                    a => a.date === dayStr && a.start_time >= hourStr && a.start_time < nextHourStr
                  );
                  const dayBookings = bookings.filter(
                    b => b.date === dayStr && b.status === 'confirmed' && b.start_time >= hourStr && b.start_time < nextHourStr
                  );

                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={`${dayStr}-${hour}`}
                      className={`min-h-[48px] border-l border-border hover:bg-muted/30 cursor-pointer relative ${
                        isCurrentDay ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedDate(day)}
                    >
                      {dayAvailability.map((a) => (
                        <div
                          key={a.id}
                          className="absolute left-1 right-1 top-1 bg-green-100 border-l-4 border-green-500 rounded px-2 py-1 text-xs overflow-hidden hover:shadow-md transition-shadow"
                        >
                          <div className="font-medium text-green-700">{a.start_time}</div>
                          <div className="text-[10px] text-green-600">Available</div>
                        </div>
                      ))}
                      {dayBookings.map((b) => (
                        <div
                          key={b.id}
                          className="absolute left-1 right-1 top-1 bg-blue-100 border-l-4 border-blue-500 rounded px-2 py-1 text-xs overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start gap-1">
                            <Video className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-blue-700">{b.start_time}</div>
                              <div className="text-[10px] text-blue-600 truncate">Tennis Match</div>
                              {b.court_location && (
                                <div className="text-[10px] text-blue-500 truncate mt-0.5">{b.court_location}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="h-[600px] overflow-y-auto">
        <div className="space-y-0">
          {hours.map((hour) => {
            const hourStr = `${hour.toString().padStart(2, '0')}:00`;
            const nextHourStr = `${((hour + 1) % 24).toString().padStart(2, '0')}:00`;
            
            const hourAvailability = selectedDateEvents.availability.filter(
              a => a.start_time >= hourStr && a.start_time < nextHourStr
            );
            const hourBookings = selectedDateEvents.bookings.filter(
              b => b.start_time >= hourStr && b.start_time < nextHourStr
            );

            return (
              <div key={hour} className="flex items-start border-b border-border hover:bg-muted/30">
                <div className="w-20 p-3 text-xs text-muted-foreground text-right border-r border-border">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                <div className="flex-1 min-h-[60px] p-2 space-y-2">
                  {hourAvailability.map((a) => (
                    <div
                      key={a.id}
                      className="group p-3 rounded-lg bg-[hsl(var(--tennis-green-500))]/10 border-l-4 border-[hsl(var(--tennis-green-500))] hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-[hsl(var(--tennis-green-600))]" />
                          <div>
                            <div className="text-sm font-medium text-[hsl(var(--tennis-green-700))] dark:text-[hsl(var(--tennis-green-500))]">
                              {a.start_time} - {a.end_time}
                            </div>
                            {a.notes && <div className="text-xs text-muted-foreground mt-1">{a.notes}</div>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" onClick={() => handleEditAvailability(a)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteAvailability(a.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {hourBookings.map((b) => (
                    <div
                      key={b.id}
                      className="group p-3 rounded-lg bg-[hsl(var(--tennis-blue-500))]/10 border-l-4 border-[hsl(var(--tennis-blue-500))] hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-[hsl(var(--tennis-blue-600))]" />
                            <span className="text-sm font-semibold text-[hsl(var(--tennis-blue-700))] dark:text-[hsl(var(--tennis-blue-500))]">
                              Tennis Match
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground ml-7">
                            {b.start_time} - {b.end_time}
                          </div>
                          {b.court_location && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-7">
                              <MapPin className="h-3 w-3" />
                              {b.court_location}
                            </div>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleExportBooking(b)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const sortedAvailability = [...availability].sort((a, b) => 
      new Date(a.date + ' ' + a.start_time).getTime() - new Date(b.date + ' ' + b.start_time).getTime()
    );
    const sortedBookings = [...bookings].sort((a, b) => 
      new Date(a.date + ' ' + a.start_time).getTime() - new Date(b.date + ' ' + b.start_time).getTime()
    );

    return (
      <div className="space-y-6 h-[600px] overflow-y-auto px-1">
        <div>
          <h3 className="text-base font-semibold mb-3 text-foreground">Availability</h3>
          <div className="space-y-2">
            {sortedAvailability.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No availability set</p>
            ) : (
              sortedAvailability.map((a) => (
                <div
                  key={a.id}
                  className="group p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="font-medium text-foreground">{format(new Date(a.date), 'EEEE, MMMM d, yyyy')}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {a.start_time} - {a.end_time}
                      </div>
                      {a.notes && <div className="text-sm text-muted-foreground">{a.notes}</div>}
                      <Badge 
                        variant="secondary" 
                        className="text-xs bg-[hsl(var(--tennis-green-50))] text-[hsl(var(--tennis-green-700))] dark:bg-[hsl(var(--tennis-green-600))]/20 dark:text-[hsl(var(--tennis-green-500))]"
                      >
                        {a.privacy_level === 'public' ? 'Public' : a.privacy_level === 'friends-only' ? 'Friends Only' : 'Private'}
                      </Badge>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" onClick={() => handleEditAvailability(a)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteAvailability(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold mb-3 text-foreground">Confirmed Matches</h3>
          <div className="space-y-2">
            {sortedBookings.filter(b => b.status === 'confirmed').length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No confirmed matches</p>
            ) : (
              sortedBookings.filter(b => b.status === 'confirmed').map((b) => (
                <div
                  key={b.id}
                  className="group p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="font-semibold text-[hsl(var(--tennis-blue-700))] dark:text-[hsl(var(--tennis-blue-500))]">
                        Tennis Match
                      </div>
                      <div className="font-medium text-foreground">{format(new Date(b.date), 'EEEE, MMMM d, yyyy')}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {b.start_time} - {b.end_time}
                      </div>
                      {b.court_location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {b.court_location}
                        </div>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleExportBooking(b)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (activeView === 'month') {
      setSelectedDate(direction === 'prev' 
        ? addDays(selectedDate, -30)
        : addDays(selectedDate, 30)
      );
    } else if (activeView === 'week') {
      setSelectedDate(direction === 'prev' 
        ? addDays(selectedDate, -7)
        : addDays(selectedDate, 7)
      );
    } else if (activeView === 'day') {
      setSelectedDate(direction === 'prev' 
        ? addDays(selectedDate, -1)
        : addDays(selectedDate, 1)
      );
    }
  };

  const getUpcomingEvents = () => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(today, 7);

    const allEvents = [
      ...availability.map(a => ({ ...a, type: 'availability' as const })),
      ...bookings.filter(b => b.status === 'confirmed').map(b => ({ ...b, type: 'booking' as const }))
    ].sort((a, b) => new Date(a.date + ' ' + a.start_time).getTime() - new Date(b.date + ' ' + b.start_time).getTime());

    return allEvents.filter(e => new Date(e.date) <= nextWeek);
  };

  const groupEventsByDate = (events: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    
    events.forEach(event => {
      const date = new Date(event.date);
      let label = format(date, 'EEEE M/d/yyyy');
      
      if (isToday(date)) label = `TODAY ${format(date, 'M/d/yyyy')}`;
      else if (isTomorrow(date)) label = `TOMORROW ${format(date, 'M/d/yyyy')}`;
      else label = format(date, 'EEEE M/d/yyyy').toUpperCase();
      
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(event);
    });
    
    return grouped;
  };

  const getEventColor = (index: number) => {
    const colors = [
      'bg-[hsl(217,91%,60%)]', // Blue
      'bg-[hsl(271,81%,56%)]', // Purple
      'bg-[hsl(188,86%,53%)]', // Cyan
      'bg-[hsl(25,95%,53%)]',  // Orange
      'bg-[hsl(351,83%,62%)]', // Pink/Red
    ];
    return colors[index % colors.length];
  };

  const calculateEventPosition = (startTime: string, endTime: string) => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const durationMinutes = endMinutes - startMinutes;
    
    // Each hour slot is 60px
    const pixelsPerMinute = 60 / 60;
    const top = (startMinutes - 420) * pixelsPerMinute; // 420 = 7 AM in minutes
    const height = durationMinutes * pixelsPerMinute;
    
    return { top, height };
  };

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Dark Sidebar */}
      <div className="w-72 bg-[hsl(222,47%,11%)] text-[hsl(210,40%,98%)] flex flex-col">
        {/* Month/Year Header */}
        <div className="p-6 border-b border-[hsl(217,33%,17%)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-2xl font-light">
                {format(selectedDate, 'MMMM')} <span className="text-primary">{format(selectedDate, 'yyyy')}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, -30))}
                className="h-7 w-7 p-0 hover:bg-[hsl(217,33%,17%)] text-[hsl(210,40%,98%)]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 30))}
                className="h-7 w-7 p-0 hover:bg-[hsl(217,33%,17%)] text-[hsl(210,40%,98%)]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mini Calendar */}
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground text-center mb-2">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {eachDayOfInterval({
                start: startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 }),
                end: endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 })
              }).map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const hasEvents = availability.some(a => a.date === dayStr) || 
                                bookings.some(b => b.date === dayStr && b.status === 'confirmed');
                const isCurrentDay = isToday(day);
                const isSelectedDay = isSameDay(day, selectedDate);

                return (
                  <button
                    key={dayStr}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative h-8 text-xs rounded-full flex items-center justify-center
                      ${isCurrentDay ? 'bg-primary text-primary-foreground font-semibold' : ''}
                      ${isSelectedDay && !isCurrentDay ? 'bg-[hsl(217,33%,17%)]' : ''}
                      ${!isCurrentDay && !isSelectedDay ? 'hover:bg-[hsl(217,33%,17%)]' : ''}
                    `}
                  >
                    {format(day, 'd')}
                    {hasEvents && !isCurrentDay && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-primary"></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming Events List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(groupEventsByDate(getUpcomingEvents())).map(([dateLabel, events]) => (
            <div key={dateLabel}>
              <div className="text-xs font-semibold text-muted-foreground mb-2">{dateLabel}</div>
              <div className="space-y-2">
                {events.map((event, idx) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 text-sm p-2 rounded hover:bg-[hsl(217,33%,17%)] cursor-pointer transition-colors"
                    onClick={() => setSelectedDate(new Date(event.date))}
                  >
                    <div className={`w-1 h-1 rounded-full mt-2 ${getEventColor(idx)}`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        {event.start_time} – {event.end_time}
                      </div>
                      <div className="text-sm truncate">
                        {event.type === 'booking' ? 'Tennis Match' : 'Available'}
                      </div>
                      {event.court_location && (
                        <div className="text-xs text-muted-foreground truncate">{event.court_location}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add Button */}
        <div className="p-4 border-t border-[hsl(217,33%,17%)]">
          <Button 
            onClick={handleAddAvailability}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Availability
          </Button>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Top Navigation */}
        <div className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate('prev')}
                className="h-9 w-9 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className="h-9 px-4 font-medium"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateDate('next')}
                className="h-9 w-9 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <CalendarViewSelector activeView={activeView} onViewChange={setActiveView} />

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                className="pl-9 h-9"
              />
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        {activeView === 'week' && (
          <div className="flex-1 overflow-hidden">
            {renderWeekView()}
          </div>
        )}
        
        {activeView === 'day' && (
          <div className="flex-1 overflow-y-auto">
            {renderDayView()}
          </div>
        )}

        {activeView === 'list' && (
          <div className="flex-1 overflow-y-auto p-6">
            {renderListView()}
          </div>
        )}
      </div>

      <EnhancedAvailabilityModal
        open={showAvailabilityModal}
        onClose={() => {
          setShowAvailabilityModal(false);
          setEditingItem(null);
        }}
        editingItem={editingItem}
        selectedDate={selectedDate}
      />
    </div>
  );
};
