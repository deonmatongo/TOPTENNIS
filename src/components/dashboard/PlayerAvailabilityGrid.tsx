import React, { useState, useCallback, useMemo } from 'react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlayerAvailability } from '@/hooks/usePlayerAvailability';
import { useMatchBookings } from '@/hooks/useMatchBookings';

interface PlayerAvailabilityGridProps {
  currentDate: Date;
  view: 'week' | 'day';
  playerId: string;
  onSelectSlot?: (date: Date, startTime: string, endTime: string, availabilityId?: string) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM

// Helper function to convert time string to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

// Helper function to get which quarters (0-3) of an hour are covered by a time range
const getQuartersCovered = (startTime: string, endTime: string, hour: number): boolean[] => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const hourStartMinutes = hour * 60;
  const hourEndMinutes = (hour + 1) * 60;
  
  if (endMinutes <= hourStartMinutes || startMinutes >= hourEndMinutes) {
    return [false, false, false, false];
  }
  
  const quarters = [false, false, false, false];
  
  for (let q = 0; q < 4; q++) {
    const quarterStart = hourStartMinutes + (q * 15);
    const quarterEnd = quarterStart + 15;
    
    if (startMinutes < quarterEnd && endMinutes > quarterStart) {
      quarters[q] = true;
    }
  }
  
  return quarters;
};

interface QuarterInfo {
  type: 'available' | 'unavailable' | 'booked';
  availabilityId?: string;
}

export const PlayerAvailabilityGrid: React.FC<PlayerAvailabilityGridProps> = ({
  currentDate,
  view,
  playerId,
  onSelectSlot,
}) => {
  const { availability, loading } = usePlayerAvailability(playerId);
  const { bookings } = useMatchBookings();
  const [selecting, setSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ date: Date; hour: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<Set<string>>(new Set());

  const days = useMemo(() => {
    if (view === 'day') {
      return [currentDate];
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate, view]);

  // Build availability map
  const availabilityQuartersMap = useMemo(() => {
    const map = new Map<string, QuarterInfo[]>();
    
    availability?.forEach((avail) => {
      if (!avail.is_available || avail.is_blocked) return;
      
      const date = new Date(avail.date);
      const startHour = parseInt(avail.start_time.split(':')[0]);
      const endHour = parseInt(avail.end_time.split(':')[0]);
      const endMinutes = parseInt(avail.end_time.split(':')[1] || '0');
      
      const lastHour = endMinutes > 0 ? endHour : endHour - 1;
      
      for (let hour = startHour; hour <= lastHour; hour++) {
        const key = `${format(date, 'yyyy-MM-dd')}-${hour}`;
        const quarters = getQuartersCovered(avail.start_time, avail.end_time, hour);
        
        if (!map.has(key)) {
          map.set(key, [
            { type: 'unavailable' },
            { type: 'unavailable' },
            { type: 'unavailable' },
            { type: 'unavailable' },
          ]);
        }
        
        const existing = map.get(key)!;
        quarters.forEach((covered, idx) => {
          if (covered) {
            existing[idx] = { type: 'available', availabilityId: avail.id };
          }
        });
      }
    });
    
    return map;
  }, [availability]);

  // Build bookings map
  const bookingsQuartersMap = useMemo(() => {
    const map = new Map<string, QuarterInfo[]>();
    
    bookings?.forEach((booking) => {
      const date = new Date(booking.date);
      const startHour = parseInt(booking.start_time.split(':')[0]);
      const endHour = parseInt(booking.end_time.split(':')[0]);
      const endMinutes = parseInt(booking.end_time.split(':')[1] || '0');
      
      const lastHour = endMinutes > 0 ? endHour : endHour - 1;
      
      for (let hour = startHour; hour <= lastHour; hour++) {
        const key = `${format(date, 'yyyy-MM-dd')}-${hour}`;
        const quarters = getQuartersCovered(booking.start_time, booking.end_time, hour);
        
        if (!map.has(key)) {
          map.set(key, [
            { type: 'unavailable' },
            { type: 'unavailable' },
            { type: 'unavailable' },
            { type: 'unavailable' },
          ]);
        }
        
        const existing = map.get(key)!;
        quarters.forEach((covered, idx) => {
          if (covered) {
            existing[idx] = { type: 'booked' };
          }
        });
      }
    });
    
    return map;
  }, [bookings]);

  const getBlockKey = (date: Date, hour: number) => {
    return `${format(date, 'yyyy-MM-dd')}-${hour}`;
  };

  const getQuartersForBlock = (date: Date, hour: number): QuarterInfo[] => {
    const key = getBlockKey(date, hour);
    const defaultQuarters: QuarterInfo[] = [
      { type: 'unavailable' },
      { type: 'unavailable' },
      { type: 'unavailable' },
      { type: 'unavailable' },
    ];
    
    const bookingQuarters = bookingsQuartersMap.get(key);
    const availQuarters = availabilityQuartersMap.get(key);
    
    const result = [...defaultQuarters];
    
    for (let q = 0; q < 4; q++) {
      if (bookingQuarters && bookingQuarters[q].type === 'booked') {
        result[q] = bookingQuarters[q];
      } else if (availQuarters && availQuarters[q].type === 'available') {
        result[q] = availQuarters[q];
      }
    }
    
    return result;
  };

  const handleMouseDown = (date: Date, hour: number) => {
    const quarters = getQuartersForBlock(date, hour);
    if (!quarters.some(q => q.type === 'available')) return;
    
    setSelecting(true);
    setSelectionStart({ date, hour });
    setCurrentSelection(new Set([getBlockKey(date, hour)]));
  };

  const handleMouseEnter = (date: Date, hour: number) => {
    if (!selecting || !selectionStart) return;
    if (!isSameDay(date, selectionStart.date)) return;
    
    const newSelection = new Set<string>();
    const minHour = Math.min(selectionStart.hour, hour);
    const maxHour = Math.max(selectionStart.hour, hour);
    
    for (let h = minHour; h <= maxHour; h++) {
      newSelection.add(getBlockKey(date, h));
    }
    
    setCurrentSelection(newSelection);
  };

  const handleMouseUp = () => {
    if (!selecting || !selectionStart || currentSelection.size === 0) {
      setSelecting(false);
      setSelectionStart(null);
      setCurrentSelection(new Set());
      return;
    }

    const selectedBlocks = Array.from(currentSelection)
      .map((key) => {
        const parts = key.split('-');
        const hourStr = parts[parts.length - 1];
        const dateStr = parts.slice(0, -1).join('-');
        return { date: dateStr, hour: parseInt(hourStr) };
      })
      .sort((a, b) => a.hour - b.hour);

    if (selectedBlocks.length > 0) {
      const startHour = selectedBlocks[0].hour;
      const endHour = selectedBlocks[selectedBlocks.length - 1].hour + 1;
      const date = new Date(selectedBlocks[0].date);
      
      const quarters = getQuartersForBlock(date, startHour);
      const availabilityId = quarters.find(q => q.availabilityId)?.availabilityId;
      
      onSelectSlot?.(
        date,
        `${startHour.toString().padStart(2, '0')}:00:00`,
        `${endHour.toString().padStart(2, '0')}:00:00`,
        availabilityId
      );
    }

    setSelecting(false);
    setSelectionStart(null);
    setCurrentSelection(new Set());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Player Availability</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Select available time slots (green) to book a match. Drag to select multiple hours.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-destructive rounded shadow-sm" />
            <span className="font-medium">Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-green-500 rounded shadow-sm" />
            <span className="font-medium">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-purple-500 rounded shadow-sm" />
            <span className="font-medium">Booked</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header */}
            <div className={cn("grid border-b", view === 'day' ? 'grid-cols-2' : 'grid-cols-8')}>
              <div className="p-2 border-r text-xs font-medium">Time</div>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className="p-2 text-center border-r"
                >
                  <div className="font-semibold text-xs">{format(day, 'EEE')}</div>
                  <div className="text-lg font-bold">{format(day, 'd')}</div>
                </div>
              ))}
            </div>

            {/* Time blocks */}
            <div 
              className="relative select-none"
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {HOURS.map((hour) => (
                <div key={hour} className={cn("grid border-b", view === 'day' ? 'grid-cols-2' : 'grid-cols-8')}>
                  <div className="p-2 text-xs text-muted-foreground border-r flex items-center font-medium">
                    {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                  </div>

                  {days.map((day) => {
                    const key = getBlockKey(day, hour);
                    const quarters = getQuartersForBlock(day, hour);
                    const isSelected = currentSelection.has(key);
                    const isPast = new Date(day).setHours(hour) < new Date().getTime();

                    const getQuarterBgClass = (quarter: QuarterInfo) => {
                      if (quarter.type === 'booked') {
                        return 'bg-purple-500/90';
                      } else if (quarter.type === 'available') {
                        return 'bg-green-500/90';
                      }
                      return 'bg-destructive/80';
                    };

                    return (
                      <div
                        key={key}
                        className={cn(
                          'min-h-[60px] border-r transition-all cursor-pointer relative flex flex-col',
                          isPast && 'opacity-50 cursor-not-allowed',
                          isSelected && 'ring-2 ring-green-600 ring-inset'
                        )}
                        onMouseDown={() => !isPast && handleMouseDown(day, hour)}
                        onMouseEnter={() => !isPast && handleMouseEnter(day, hour)}
                      >
                        {quarters.map((quarter, qIdx) => {
                          const bgClass = getQuarterBgClass(quarter);
                          const minuteLabel = qIdx === 0 ? ':00' : qIdx === 1 ? ':15' : qIdx === 2 ? ':30' : ':45';
                          const statusLabel = quarter.type === 'available' ? 'Available' : quarter.type === 'booked' ? 'Booked' : 'Unavailable';
                          
                          return (
                            <div
                              key={qIdx}
                              className={cn(
                                'flex-1 transition-colors relative group',
                                bgClass,
                                quarter.type === 'available' && 'hover:brightness-110'
                              )}
                              title={`${format(day, 'MMM d')} ${hour.toString().padStart(2, '0')}${minuteLabel} - ${statusLabel}`}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
