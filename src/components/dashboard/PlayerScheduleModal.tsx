import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, List, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { AvailableSlotsList } from './AvailableSlotsList';
import { BookingModal } from './BookingModal';
import { PlayerAvailabilityGrid } from './PlayerAvailabilityGrid';
import { usePlayerAvailability } from '@/hooks/usePlayerAvailability';
import { useMatchBookings } from '@/hooks/useMatchBookings';
import { format, addDays, subDays, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Tables } from '@/integrations/supabase/types';
import type { SearchResult } from '@/hooks/usePlayerSearch';

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
}

export const PlayerScheduleModal: React.FC<PlayerScheduleModalProps> = ({
  open,
  onClose,
  player
}) => {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day'>('week');
  
  const opponentUserId = player ? ((player.user_id ?? player.id) || undefined) : undefined;
  const { availability } = usePlayerAvailability(opponentUserId);
  const { createBooking, isSlotBooked } = useMatchBookings();

  const handleSelectSlots = (slots: HourlySlotSelection[]) => {
    if (slots.length === 0) return;

    const sortedSlots = [...slots].sort((a, b) => 
      a.start_time.localeCompare(b.start_time)
    );
    
    setSelectedSlot({
      date: new Date(sortedSlots[0].date),
      startTime: sortedSlots[0].start_time,
      endTime: sortedSlots[sortedSlots.length - 1].end_time,
      availabilityId: sortedSlots[0].parentId,
      selectedHours: slots
    });
    setShowBookingModal(true);
  };

  const handleSelectSlot = (date: Date, startTime: string, endTime: string, availabilityId?: string) => {
    setSelectedSlot({
      date,
      startTime,
      endTime,
      availabilityId
    });
    setShowBookingModal(true);
  };

  const handlePrevious = () => {
    if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeText = () => {
    if (view === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  const handleBookingConfirm = async (courtLocation?: string, message?: string) => {
    if (!selectedSlot || !player) return;

    const opponentId = (player.user_id ?? player.id) as string;
    
    try {
      await createBooking({
        opponent_id: opponentId,
        availability_id: selectedSlot.availabilityId,
        date: format(selectedSlot.date, 'yyyy-MM-dd'),
        start_time: selectedSlot.startTime,
        end_time: selectedSlot.endTime,
        court_location: courtLocation,
        message: message
      });
      
      setShowBookingModal(false);
      setSelectedSlot(null);
    } catch (error) {
      console.error('Error creating booking:', error);
    }
  };

  const totalHours = availability?.reduce((sum, slot) => {
    if (!slot.is_available || slot.is_blocked) return sum;
    const start = new Date(`2000-01-01T${slot.start_time}`);
    const end = new Date(`2000-01-01T${slot.end_time}`);
    return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }, 0) || 0;

  const opponentName = player
    ? ((player as SearchResult).first_name || (player as SearchResult).last_name)
      ? `${(player as SearchResult).first_name || ''} ${(player as SearchResult).last_name || ''}`.trim()
      : (player as Tables<'players'>).name
    : '';

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Professional Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 bg-gradient-to-r from-muted/50 to-background">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarImage src={player?.avatar_url} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <DialogTitle className="text-2xl flex items-center gap-3">
                  Schedule Match with {opponentName}
                  <Badge variant="secondary" className="font-normal">
                    {availability?.filter(a => a.is_available && !a.is_blocked).length || 0} slots
                  </Badge>
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalHours > 0 ? `${Math.round(totalHours)} hours available` : 'No availability set'} • Drag to select time range
                </p>
              </div>
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="calendar" className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="px-6 pt-4 pb-2 border-b bg-muted/30 shrink-0">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="calendar" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Calendar
                  </TabsTrigger>
                  <TabsTrigger value="list" className="flex items-center gap-2">
                    <List className="w-4 h-4" />
                    List View
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToday}
                    className="font-medium"
                  >
                    Today
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevious}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select value={view} onValueChange={(v) => setView(v as 'week' | 'day')}>
                    <SelectTrigger className="w-[110px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <h3 className="text-base font-semibold mt-3">{getDateRangeText()}</h3>
            </div>
            
            <TabsContent value="calendar" className="flex-1 overflow-auto mt-0 p-6">
              <PlayerAvailabilityGrid 
                currentDate={currentDate} 
                view={view}
                playerId={player?.user_id || player?.id}
                onSelectSlot={handleSelectSlot}
              />
            </TabsContent>

            <TabsContent value="list" className="flex-1 overflow-auto mt-0 px-6 py-4">
              {availability && availability.length > 0 ? (
                <AvailableSlotsList
                  availability={availability}
                  onSelectSlots={handleSelectSlots}
                  isBooked={(date, startTime, endTime) => 
                    isSlotBooked(date, startTime, endTime, player?.user_id || player?.id)
                  }
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <Calendar className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Available Times</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {player?.first_name} hasn't added any available time slots yet. Check back later.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {selectedSlot && (
        <BookingModal
          open={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedSlot(null);
          }}
          onConfirm={handleBookingConfirm}
          slot={selectedSlot}
          opponent={player}
        />
      )}
    </>
  );
};