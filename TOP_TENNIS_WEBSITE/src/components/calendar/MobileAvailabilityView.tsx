import React, { useState } from 'react';
import { format, addDays, subDays, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileAvailabilityViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  availability: any[];
  invites: any[];
  bookings: any[];
  onCreateAvailability: (hour: number) => void;
  onBlockClick: (id: string) => void;
}

export const MobileAvailabilityView: React.FC<MobileAvailabilityViewProps> = ({
  currentDate,
  onDateChange,
  availability,
  invites,
  bookings,
  onCreateAvailability,
  onBlockClick,
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Swipe detection
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      onDateChange(addDays(currentDate, 1));
    } else if (isRightSwipe) {
      onDateChange(subDays(currentDate, 1));
    }
  };

  // Get availability for current day
  const dayAvailability = availability.filter(a => 
    isSameDay(new Date(a.date), currentDate)
  );

  const dayInvites = invites.filter(i => 
    isSameDay(new Date(i.date), currentDate)
  );

  const dayBookings = bookings.filter(b => 
    isSameDay(new Date(b.date), currentDate)
  );

  // Generate time slots for the day
  const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6); // 6 AM - 10 PM

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDateChange(subDays(currentDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <div className="text-lg font-bold">
                {format(currentDate, 'EEEE')}
              </div>
              <div className="text-sm text-muted-foreground">
                {format(currentDate, 'MMM d, yyyy')}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDateChange(addDays(currentDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Week View Mini */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(startOfWeek(currentDate), i);
              const isSelected = isSameDay(day, currentDate);
              const hasActivity = availability.some(a => isSameDay(new Date(a.date), day)) ||
                                 invites.some(i => isSameDay(new Date(i.date), day)) ||
                                 bookings.some(b => isSameDay(new Date(b.date), day));

              return (
                <button
                  key={i}
                  onClick={() => onDateChange(day)}
                  className={cn(
                    "p-2 text-center rounded-lg transition-colors",
                    isSelected 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted",
                    hasActivity && !isSelected && "font-semibold"
                  )}
                >
                  <div className="text-xs">{format(day, 'EEE')}</div>
                  <div className={cn("text-sm", hasActivity && !isSelected && "relative")}>
                    {format(day, 'd')}
                    {hasActivity && !isSelected && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Time Slots - Swipeable */}
      <Card
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <CardContent className="p-4 space-y-2">
          {timeSlots.map(hour => {
            const hourStr = `${hour.toString().padStart(2, '0')}:00:00`;
            
            // Check for availability, invites, or bookings at this hour
            const hasAvailability = dayAvailability.some(a => 
              a.start_time <= hourStr && a.end_time > hourStr
            );
            const hasInvite = dayInvites.some(i => 
              i.start_time <= hourStr && i.end_time > hourStr
            );
            const hasBooking = dayBookings.some(b => 
              b.start_time <= hourStr && b.end_time > hourStr
            );

            const availabilityBlock = dayAvailability.find(a => 
              a.start_time <= hourStr && a.end_time > hourStr
            );

            const inviteBlock = dayInvites.find(i => 
              i.start_time <= hourStr && i.end_time > hourStr
            );

            const bookingBlock = dayBookings.find(b => 
              b.start_time <= hourStr && b.end_time > hourStr
            );

            return (
              <button
                key={hour}
                onClick={() => {
                  if (hasAvailability && availabilityBlock) {
                    onBlockClick(availabilityBlock.id);
                  } else if (hasInvite && inviteBlock) {
                    onBlockClick(inviteBlock.id);
                  } else if (hasBooking && bookingBlock) {
                    onBlockClick(bookingBlock.id);
                  } else {
                    onCreateAvailability(hour);
                  }
                }}
                className={cn(
                  "w-full p-4 rounded-lg text-left transition-all",
                  "border-2 border-transparent",
                  hasAvailability && "bg-green-100 dark:bg-green-900/30 border-green-300",
                  hasInvite && "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300",
                  hasBooking && "bg-blue-100 dark:bg-blue-900/30 border-blue-300",
                  !hasAvailability && !hasInvite && !hasBooking && "bg-muted hover:bg-muted/70"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      {format(new Date().setHours(hour, 0, 0, 0), 'h:mm a')}
                    </div>
                    {hasAvailability && (
                      <Badge variant="outline" className="mt-1 text-xs bg-green-50">
                        Available
                      </Badge>
                    )}
                    {hasInvite && (
                      <Badge variant="outline" className="mt-1 text-xs bg-yellow-50">
                        Pending Invite
                      </Badge>
                    )}
                    {hasBooking && (
                      <Badge variant="outline" className="mt-1 text-xs bg-blue-50">
                        Confirmed
                      </Badge>
                    )}
                  </div>
                  {!hasAvailability && !hasInvite && !hasBooking && (
                    <span className="text-xs text-muted-foreground">Tap to add</span>
                  )}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Swipe Hint */}
      <div className="text-center text-xs text-muted-foreground">
        👈 Swipe left or right to navigate days 👉
      </div>
    </div>
  );
};
