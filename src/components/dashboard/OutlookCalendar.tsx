import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, Users, Send, Check, X, Plus, ChevronLeft, ChevronRight, CalendarDays, MapPin, Edit, Trash2, Ban } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchInvites } from '@/hooks/useMatchInvites';
import { usePlayerAvailability } from '@/hooks/usePlayerAvailability';
import { useMatchBookings } from '@/hooks/useMatchBookings';
import { AvailabilityModal } from './AvailabilityModal';
import { BookingModal } from './BookingModal';
import { PendingBookingCard } from './PendingBookingCard';
import { ProposedTimeCard } from './ProposedTimeCard';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
interface OutlookCalendarProps {
  viewingPlayer?: any; // When viewing another player's calendar
  isOwnCalendar?: boolean;
}
export const OutlookCalendar: React.FC<OutlookCalendarProps> = ({
  viewingPlayer,
  isOwnCalendar = true
}) => {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentDay, setCurrentDay] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    date: Date;
    startTime: string;
    endTime: string;
    availabilityId?: string;
  } | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showSendInviteModal, setShowSendInviteModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [availabilityToDelete, setAvailabilityToDelete] = useState<string | null>(null);
  const [editingAvailability, setEditingAvailability] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlotTime, setSelectedSlotTime] = useState<{ start: string; end: string } | null>(null);
  const [inviteMessage, setInviteMessage] = useState('');
  const [courtLocation, setCourtLocation] = useState('');
  const [availabilityLocation, setAvailabilityLocation] = useState('');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedBookingSlot, setSelectedBookingSlot] = useState<{
    date: Date;
    startTime: string;
    endTime: string;
    availabilityId?: string;
  } | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Array<{
    date: Date;
    startTime: string;
    endTime: string;
    availabilityId?: string;
  }>>([]);

  // Hooks
  const {
    availability: ownAvailability,
    createAvailability,
    updateAvailability,
    deleteAvailability
  } = useUserAvailability();
  const {
    availability: playerAvailability
  } = usePlayerAvailability(viewingPlayer?.user_id || viewingPlayer?.id);
  const {
    getPendingInvites,
    respondToInvite,
    sendInvite
  } = useMatchInvites();
  const {
    bookings,
    createBooking,
    acceptBooking,
    declineBooking,
    cancelBooking,
    acceptProposedTime,
    isSlotBooked,
    getBookingsForSlot,
    getPendingBookings
  } = useMatchBookings();

  // Get the relevant availability data
  const availability = isOwnCalendar ? ownAvailability : playerAvailability;
  const pendingInvites = getPendingInvites();
  console.log('Current availability data:', availability);
  console.log('Is own calendar:', isOwnCalendar);

  // Generate week days or single day based on view mode
  const displayDays = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDay];
    } else {
      const start = startOfWeek(currentWeek, {
        weekStartsOn: 1
      }); // Monday start
      return Array.from({
        length: 7
      }, (_, i) => addDays(start, i));
    }
  }, [currentWeek, currentDay, viewMode]);

  // Generate time slots from 6 AM to 10 PM
  const timeSlots = useMemo(() => {
    const slots = [];
    
    // Always show full day schedule from 6 AM to 10 PM
    for (let hour = 6; hour <= 22; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
      slots.push({
        start: startTime,
        end: endTime
      });
    }
    return slots;
  }, []);

  // Navigation functions
  const goToPreviousWeek = () => {
    console.log('Going to previous week from:', currentWeek);
    setCurrentWeek(subWeeks(currentWeek, 1));
  };
  const goToNextWeek = () => {
    console.log('Going to next week from:', currentWeek);
    setCurrentWeek(addWeeks(currentWeek, 1));
  };
  const goToPreviousDay = () => {
    console.log('Going to previous day from:', currentDay);
    setCurrentDay(addDays(currentDay, -1));
  };
  const goToNextDay = () => {
    console.log('Going to next day from:', currentDay);
    setCurrentDay(addDays(currentDay, 1));
  };
  const goToPrevious = viewMode === 'week' ? goToPreviousWeek : goToPreviousDay;
  const goToNext = viewMode === 'week' ? goToNextWeek : goToNextDay;
  const getDateRangeLabel = () => {
    if (viewMode === 'day') {
      return format(currentDay, 'EEEE, MMM d, yyyy');
    } else {
      return `${format(displayDays[0], 'MMM d')} - ${format(displayDays[6], 'MMM d, yyyy')}`;
    }
  };

  // Get availability for a specific date and time (check for any overlap)
  const getSlotAvailability = (date: Date, startTime: string, endTime: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    // Convert time strings to minutes for easier comparison
    const slotStart = timeToMinutes(startTime);
    const slotEnd = timeToMinutes(endTime);
    const overlappingSlot = availability.find(av => {
      if (av.date !== dateStr || !av.is_available) return false;
      const avStart = timeToMinutes(av.start_time);
      const avEnd = timeToMinutes(av.end_time);

      // Check if there's any overlap
      const hasOverlap = slotStart < avEnd && slotEnd > avStart;
      return hasOverlap;
    });
    console.log(`Checking slot ${dateStr} ${startTime}-${endTime}:`, overlappingSlot);
    return overlappingSlot;
  };

  // Helper function to convert time string to minutes
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Handle time slot click
  const handleSlotClick = async (date: Date, startTime: string, endTime: string) => {
    // Check if slot is in the past (compare date only, not time)
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = slotDate < today;
    if (isPast) return; // Don't allow changes to past dates

    const dateStr = format(date, 'yyyy-MM-dd');
    const slotIsBooked = isSlotBooked(dateStr, startTime, endTime, viewingPlayer?.user_id);

    if (isOwnCalendar) {
      const existingSlot = getSlotAvailability(date, startTime, endTime);
      
      // Check if this slot has a booking
      if (slotIsBooked) {
        const bookingsForSlot = getBookingsForSlot(dateStr, startTime, endTime);
        if (bookingsForSlot.length > 0) {
          toast.info('This slot is booked');
        }
        return;
      }
      
      if (existingSlot) {
        // Edit existing availability
        setEditingAvailability(existingSlot);
        setSelectedDate(null);
        setSelectedSlotTime(null);
        setShowAvailabilityModal(true);
      } else {
        // Create new availability
        setEditingAvailability(null);
        setSelectedDate(date);
        setSelectedSlotTime({ start: startTime, end: endTime });
        setShowAvailabilityModal(true);
      }
    } else {
      // Viewing another player's calendar - allow multi-selection
      const slot = getSlotAvailability(date, startTime, endTime);
      
      if (slotIsBooked) {
        toast.error('This slot is already booked');
        return;
      }
      
      // Toggle slot selection
      const slotKey = `${format(date, 'yyyy-MM-dd')}-${startTime}-${endTime}`;
      const isSelected = selectedSlots.some(s => 
        format(s.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
        s.startTime === startTime &&
        s.endTime === endTime
      );
      
      if (isSelected) {
        // Remove from selection
        setSelectedSlots(selectedSlots.filter(s => 
          !(format(s.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
            s.startTime === startTime &&
            s.endTime === endTime)
        ));
      } else {
        // Add to selection
        setSelectedSlots([...selectedSlots, {
          date,
          startTime,
          endTime,
          availabilityId: slot?.id
        }]);
      }
    }
  };

  // Handle delete availability
  const handleDeleteAvailability = async () => {
    if (!availabilityToDelete) return;
    
    try {
      await deleteAvailability(availabilityToDelete);
      toast.success('Availability deleted successfully');
      setShowDeleteConfirm(false);
      setAvailabilityToDelete(null);
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Failed to delete availability');
    }
  };

  const confirmDeleteAvailability = (availabilityId: string) => {
    setAvailabilityToDelete(availabilityId);
    setShowDeleteConfirm(true);
  };

  // Handle close availability modal
  const handleCloseAvailabilityModal = () => {
    setShowAvailabilityModal(false);
    setEditingAvailability(null);
    setSelectedDate(null);
    setSelectedSlotTime(null);
  };

  // Handle send invite
  const handleSendInvite = async () => {
    if (!selectedTimeSlot || !viewingPlayer) return;
    try {
      await sendInvite({
        receiver_id: viewingPlayer.user_id || viewingPlayer.id,
        availability_id: selectedTimeSlot.availabilityId,
        date: format(selectedTimeSlot.date, 'yyyy-MM-dd'),
        start_time: selectedTimeSlot.startTime,
        end_time: selectedTimeSlot.endTime,
        court_location: courtLocation || undefined,
        message: inviteMessage
      });
      setShowSendInviteModal(false);
      setSelectedTimeSlot(null);
      setInviteMessage('');
      setCourtLocation('');
    } catch (error) {
      console.error('Error sending invite:', error);
    }
  };

  // Handle booking confirmation
  const handleBookingConfirm = async (courtLocation?: string, message?: string) => {
    if (!viewingPlayer) return;
    
    try {
      setShowBookingModal(false);
      
      // If we have multiple selected slots, book all of them
      if (selectedSlots.length > 1) {
        toast.info(`Sending ${selectedSlots.length} match requests...`);
        
        const bookingPromises = selectedSlots.map(slot => 
          createBooking({
            opponent_id: viewingPlayer.user_id || viewingPlayer.id,
            availability_id: slot.availabilityId,
            date: format(slot.date, 'yyyy-MM-dd'),
            start_time: slot.startTime,
            end_time: slot.endTime,
            court_location: courtLocation,
            message: message
          })
        );
        
        await Promise.all(bookingPromises);
        toast.success(`${selectedSlots.length} match requests sent successfully!`);
        setSelectedSlots([]); // Clear selections
      } else if (selectedBookingSlot) {
        // Single slot booking
        await createBooking({
          opponent_id: viewingPlayer.user_id || viewingPlayer.id,
          availability_id: selectedBookingSlot.availabilityId,
          date: format(selectedBookingSlot.date, 'yyyy-MM-dd'),
          start_time: selectedBookingSlot.startTime,
          end_time: selectedBookingSlot.endTime,
          court_location: courtLocation,
          message: message
        });
        toast.success('Match request sent!');
      }
      
      setSelectedBookingSlot(null);
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to send match request');
    }
  };

  // Handle booking confirmation for multiple slots
  const handleBookMultipleSlots = () => {
    if (selectedSlots.length === 0) return;
    
    // For now, we'll book them as separate requests
    // Sort slots by date and time
    const sortedSlots = [...selectedSlots].sort((a, b) => {
      const dateCompare = a.date.getTime() - b.date.getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });
    
    // Use the first slot as the primary slot for the booking modal
    setSelectedBookingSlot(sortedSlots[0]);
    setShowBookingModal(true);
  };
  
  // Clear selections
  const handleClearSelections = () => {
    setSelectedSlots([]);
  };
  
  // Get slot display class with booking status
  const getSlotClass = (date: Date, startTime: string, endTime: string) => {
    const slot = getSlotAvailability(date, startTime, endTime);
    // Check if slot is in the past (compare date only)
    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = slotDate < today;
    const dateStr = format(date, 'yyyy-MM-dd');
    const bookingsForSlot = getBookingsForSlot(dateStr, startTime, endTime);
    const pendingBooking = bookingsForSlot.find(b => b.status === 'pending');
    const confirmedBooking = bookingsForSlot.find(b => b.status === 'confirmed');
    
    // Check if slot is selected (for multi-select mode)
    const isSelected = !isOwnCalendar && selectedSlots.some(s => 
      format(s.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') &&
      s.startTime === startTime &&
      s.endTime === endTime
    );
    
    if (isPast) return 'bg-muted/50 cursor-not-allowed';
    
    // Selected slots (blue)
    if (isSelected) {
      return 'bg-blue-200 text-blue-900 border-blue-400 cursor-pointer ring-2 ring-blue-500';
    }
    
    // Pending bookings (yellow/orange)
    if (pendingBooking) {
      return 'bg-yellow-100 text-yellow-900 border-yellow-300 cursor-pointer';
    }
    
    // Confirmed bookings (dark/booked)
    if (confirmedBooking) {
      return 'bg-slate-800 text-white border-slate-900 cursor-pointer';
    }
    
    // Available slots (green)
    if (slot?.is_available) {
      return isOwnCalendar 
        ? 'bg-green-100 hover:bg-green-200 border-green-300 cursor-pointer transition-colors' 
        : 'bg-green-100 hover:bg-green-200 border-green-300 cursor-pointer';
    }
    
    // For viewing other players: Allow clicking on any non-past, non-booked slot
    if (!isOwnCalendar) {
      return 'bg-muted/30 hover:bg-accent/50 border-border cursor-pointer transition-colors';
    }
    
    // Unavailable slots (red/muted) - only for own calendar
    return 'bg-red-50 hover:bg-red-100 border-red-200 cursor-pointer transition-colors';
  };

  // Get booking info for a slot
  const getBookingInfo = (date: Date, startTime: string, endTime: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const bookingsForSlot = getBookingsForSlot(dateStr, startTime, endTime);
    return bookingsForSlot[0] || null;
  };
  return <div className="space-y-6">
      {/* Pending Booking Requests */}
      {isOwnCalendar && getPendingBookings && getPendingBookings().length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            Pending Booking Requests ({getPendingBookings().length})
          </h2>
          <div className="space-y-3">
            {getPendingBookings().map((booking) => (
              <PendingBookingCard
                key={booking.id}
                booking={booking}
                onAccept={acceptBooking}
                onDecline={declineBooking}
              />
            ))}
          </div>
        </div>
      )}

      {/* Proposed New Times (for original booker) */}
      {isOwnCalendar && user && bookings.filter(b => b.proposed_date && b.booker_id === user.id).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Proposed New Times ({bookings.filter(b => b.proposed_date && b.booker_id === user.id).length})
          </h2>
          <div className="space-y-3">
            {bookings.filter(b => b.proposed_date && b.booker_id === user.id).map((booking) => (
              <ProposedTimeCard
                key={booking.id}
                booking={booking}
                onAcceptProposed={acceptProposedTime}
                onDecline={declineBooking}
              />
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            {isOwnCalendar ? 'My Schedule' : `${viewingPlayer?.name}'s Schedule`}
          </h1>
          <p className="text-muted-foreground">
            {isOwnCalendar ? 'Manage your availability and match requests' : 'Click on time slots to select multiple times for your match request'}
          </p>
        </div>
      </div>

      {/* Selected Slots Bar - Only for viewing other players */}
      {!isOwnCalendar && selectedSlots.length > 0 && (
        <Card className="border-blue-300 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  {selectedSlots.length} Time Slot{selectedSlots.length !== 1 ? 's' : ''} Selected
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedSlots.map((slot, index) => (
                    <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-900 border-blue-300">
                      {format(slot.date, 'MMM d')} at {slot.startTime}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearSelections}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
                <Button 
                  size="sm"
                  onClick={handleBookMultipleSlots}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Request
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg">
                    {viewMode === 'week' ? 'Weekly Schedule' : 'Daily Schedule'}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                      <span>Available</span>
                    </div>
                    {!isOwnCalendar && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-200 border border-blue-400 rounded ring-2 ring-blue-500"></div>
                        <span>Selected</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                      <span>Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-slate-800 border border-slate-900 rounded"></div>
                      <span>Booked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
                      <span>{isOwnCalendar ? 'Unavailable' : 'Unavailable'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* View Toggle */}
                  <div className="flex items-center border rounded-lg p-1">
                    <Button variant={viewMode === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('week')} className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Week
                    </Button>
                    <Button variant={viewMode === 'day' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('day')} className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      Day
                    </Button>
                  </div>
                  
                  {/* Navigation */}
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevious();
                      }}
                      className="hover:bg-primary/10"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[200px] text-center">
                      {getDateRangeLabel()}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNext();
                      }}
                      className="hover:bg-primary/10"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <div className={`grid gap-1 min-w-[${viewMode === 'day' ? '200' : '800'}px]`} style={{
                    gridTemplateColumns: `auto repeat(${displayDays.length}, 1fr)`
                  }}>
                  {/* Header row with days */}
                  <div className="p-2 text-sm font-medium text-center bg-muted rounded">
                    Time
                  </div>
                  {displayDays.map(day => <div key={day.toISOString()} className="p-2 text-sm font-medium text-center bg-muted rounded">
                      <div>{format(day, 'EEE')}</div>
                      <div className="text-xs text-muted-foreground">{format(day, 'MMM d')}</div>
                    </div>)}

                  {/* Time slots */}
                  {timeSlots.map(slot => [/* Time label */
                <div key={`time-${slot.start}`} className="p-2 text-xs text-center bg-muted/50 rounded flex items-center justify-center">
                      {slot.start}
                    </div>, /* Day slots */
                 ...displayDays.map(day => {
                      const slotAvailability = getSlotAvailability(day, slot.start, slot.end);
                      const bookingInfo = getBookingInfo(day, slot.start, slot.end);
                      // Check if date is in the past (compare date only)
                      const slotDate = new Date(day);
                      slotDate.setHours(0, 0, 0, 0);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isPast = slotDate < today;
                      const isAvailable = slotAvailability?.is_available && !isPast;
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const slotIsBooked = isSlotBooked(dateStr, slot.start, slot.end);
                      
                      return (
                        <div 
                          key={`${day.toISOString()}-${slot.start}`} 
                          className={`p-2 text-xs text-center rounded border-2 min-h-[60px] flex items-center justify-center group relative ${getSlotClass(day, slot.start, slot.end)}`} 
                          onClick={() => handleSlotClick(day, slot.start, slot.end)}
                          title={isOwnCalendar ? "Click to manage availability" : (isAvailable && !slotIsBooked ? "Click to book match" : "")}
                        >
                          {/* Hover overlay for booking */}
                          {!isOwnCalendar && isAvailable && !slotIsBooked && (
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center z-10">
                              <span className="text-primary font-semibold text-sm">Book Match</span>
                            </div>
                          )}
                          {(() => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const bookingInfo = getBookingInfo(day, slot.start, slot.end);
                          const isPendingBooking = bookingInfo?.status === 'pending';
                          const isConfirmedBooking = bookingInfo?.status === 'confirmed';
                          
                          // Show pending booking info
                          if (isPendingBooking && bookingInfo) {
                            const isBooker = bookingInfo.booker_id === bookingInfo.booker?.id;
                            const displayName = isOwnCalendar
                              ? (isBooker ? bookingInfo.opponent?.first_name : bookingInfo.booker?.first_name)
                              : 'Pending';
                            
                            return (
                              <div className="text-xs space-y-1 w-full">
                                <div className="font-medium">Pending</div>
                                {displayName && <div className="text-yellow-900/90">{displayName}</div>}
                                {isOwnCalendar && !isBooker && (
                                  <div className="flex gap-1 mt-1">
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-5 flex-1 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-900"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        acceptBooking(bookingInfo.id);
                                      }}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-5 flex-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-900"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        declineBooking(bookingInfo.id);
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          
                          // Show confirmed booking info
                          if (isConfirmedBooking && bookingInfo) {
                            const isBooker = bookingInfo.booker_id === bookingInfo.booker?.id;
                            const displayName = isOwnCalendar
                              ? (isBooker ? bookingInfo.opponent?.first_name : bookingInfo.booker?.first_name)
                              : 'Booked';
                            
                            return (
                              <div className="text-xs space-y-1">
                                <div className="font-medium">Booked</div>
                                {displayName && <div className="text-white/90">{displayName}</div>}
                                {isOwnCalendar && (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-5 w-full mt-1 text-xs bg-white/20 hover:bg-white/30 text-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelBooking(bookingInfo.id);
                                    }}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            );
                          }
                          
                          // Show edit/delete buttons for existing availability
                          if (isOwnCalendar && getSlotAvailability(day, slot.start, slot.end)) {
                            return (
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 bg-black/10 rounded">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 bg-white/80 hover:bg-white" onClick={e => {
                                  e.stopPropagation();
                                  const existingSlot = getSlotAvailability(day, slot.start, slot.end);
                                  if (existingSlot) {
                                    setEditingAvailability(existingSlot);
                                    setSelectedDate(null);
                                    setShowAvailabilityModal(true);
                                  }
                                }}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 bg-white/80 hover:bg-red-100" onClick={e => {
                                  e.stopPropagation();
                                  const existingSlot = getSlotAvailability(day, slot.start, slot.end);
                                  if (existingSlot) {
                                    confirmDeleteAvailability(existingSlot.id);
                                  }
                                }}>
                                  <Trash2 className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                            );
                          }
                          
                          return null;
                        })()}
                        </div>
                      );
                    })]).flat()}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Match Invites (only show for own calendar) */}
          {isOwnCalendar && <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Match Invites
                  {pendingInvites.length > 0 && <Badge variant="destructive" className="ml-auto">
                      {pendingInvites.length}
                    </Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {pendingInvites.length > 0 ? pendingInvites.map(invite => <div key={invite.id} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {invite.sender?.first_name} {invite.sender?.last_name}
                            </span>
                            <Badge variant="outline" className="text-xs">Pending</Badge>
                          </div>
                          
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{format(parseISO(invite.date), 'MMM d, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{invite.start_time} - {invite.end_time}</span>
                            </div>
                            {invite.message && <p className="text-xs italic">{invite.message}</p>}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => respondToInvite(invite.id, 'accepted')} className="flex-1 text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => respondToInvite(invite.id, 'declined')} className="flex-1 text-xs">
                              <X className="w-3 h-3 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </div>) : <div className="text-center py-4 text-muted-foreground">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No pending invites</p>
                      </div>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>}
        </div>
      </div>

      {/* Availability Modal */}
      <AvailabilityModal 
        open={showAvailabilityModal} 
        onClose={handleCloseAvailabilityModal} 
        editingItem={editingAvailability} 
        selectedDate={selectedDate}
        selectedStartTime={selectedSlotTime?.start}
        selectedEndTime={selectedSlotTime?.end}
      />

      {/* Send Invite Modal */}
      <Dialog open={showSendInviteModal} onOpenChange={setShowSendInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Match Invite</DialogTitle>
            <DialogDescription>
              Send a match invitation to {viewingPlayer?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTimeSlot && <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>{format(selectedTimeSlot.date, 'EEEE, MMMM d, yyyy')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Clock className="w-4 h-4" />
                  <span>{selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}</span>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Court Location (optional)
                </label>
                <Select value={courtLocation} onValueChange={setCourtLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select or enter court location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="downtown-tennis">Downtown Tennis Center</SelectItem>
                    <SelectItem value="riverside-courts">Riverside Courts</SelectItem>
                    <SelectItem value="city-park">City Park Tennis Complex</SelectItem>
                    <SelectItem value="tennis-academy">Tennis Academy</SelectItem>
                    <SelectItem value="community-center">Community Sports Center</SelectItem>
                    <SelectItem value="other">Other (specify in message)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Message (optional)
                </label>
                <Textarea value={inviteMessage} onChange={e => setInviteMessage(e.target.value)} placeholder="Add a message to your invitation..." className="resize-none" rows={3} />
              </div>
            </div>}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendInviteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendInvite}>
              <Send className="w-4 h-4 mr-2" />
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Availability</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this availability slot? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteConfirm(false);
              setAvailabilityToDelete(null);
            }}>
              No, Keep It
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAvailability} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Booking Modal */}
      {selectedBookingSlot && viewingPlayer && (
        <BookingModal
          open={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedBookingSlot(null);
          }}
          onConfirm={handleBookingConfirm}
          slot={selectedBookingSlot}
          opponent={{
            name: viewingPlayer.name,
            first_name: viewingPlayer.first_name,
            last_name: viewingPlayer.last_name,
            location: viewingPlayer.location
          }}
          additionalSlots={selectedSlots.length > 1 ? selectedSlots.slice(1) : []}
        />
      )}
    </div>;
};