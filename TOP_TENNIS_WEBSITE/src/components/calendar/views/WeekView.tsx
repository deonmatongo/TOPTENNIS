import React, { useMemo } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, time: string) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM

export const WeekView: React.FC<WeekViewProps> = ({
  events,
  currentDate,
  onEventClick,
  onSlotClick,
}) => {
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const getEventsForDayAndHour = (day: Date, hour: number) => {
    return events.filter((event) => {
      if (!isSameDay(event.startTime, day)) return false;
      const eventHour = event.startTime.getHours();
      const eventEndHour = event.endTime.getHours();
      return hour >= eventHour && hour < eventEndHour;
    });
  };

  const getEventStyle = (event: CalendarEvent) => {
    const typeColors = {
      match: 'bg-green-100 border-green-500 hover:bg-green-200 dark:bg-green-900/30 dark:border-green-600',
      lesson: 'bg-blue-100 border-blue-500 hover:bg-blue-200 dark:bg-blue-900/30 dark:border-blue-600',
      tournament: 'bg-orange-100 border-orange-500 hover:bg-orange-200 dark:bg-orange-900/30 dark:border-orange-600',
      practice: 'bg-purple-100 border-purple-500 hover:bg-purple-200 dark:bg-purple-900/30 dark:border-purple-600',
    };
    return typeColors[event.type];
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6">
      <div className="min-w-[700px] lg:min-w-[900px] xl:min-w-full">
        {/* Header */}
        <div className="grid grid-cols-8 border-b sticky top-0 bg-background z-10 shadow-sm">
          <div className="p-2 border-r"></div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                'p-2 text-center border-r transition-colors',
                isToday(day) && 'bg-primary/10'
              )}
            >
              <div className="font-semibold text-xs sm:text-sm">{format(day, 'EEE')}</div>
              <div
                className={cn(
                  'text-lg sm:text-2xl font-bold',
                  isToday(day) && 'text-primary'
                )}
              >
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="relative">
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b">
              {/* Time label */}
              <div className="p-2 text-xs sm:text-sm text-muted-foreground border-r flex items-start font-medium">
                {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
              </div>

              {/* Day cells - touch-friendly */}
              {weekDays.map((day) => {
                const dayEvents = getEventsForDayAndHour(day, hour);
                const isPast = day < new Date() && !isSameDay(day, new Date());

                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      'min-h-[50px] sm:min-h-[60px] p-1 border-r transition-all touch-manipulation',
                      isPast ? 'bg-muted/30' : 'cursor-pointer hover:bg-accent/50 active:bg-accent/70',
                      isToday(day) && 'bg-primary/5'
                    )}
                    onClick={() => {
                      if (!isPast) {
                        onSlotClick(day, `${hour.toString().padStart(2, '0')}:00`);
                      }
                    }}
                  >
                    <div className="space-y-1">
                      {dayEvents.map((event) => {
                        const startHour = event.startTime.getHours();
                        const isFirstHour = hour === startHour;
                        
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              'p-1.5 sm:p-2 rounded border-l-4 cursor-pointer text-xs transition-transform touch-manipulation active:scale-95',
                              getEventStyle(event),
                              !isFirstHour && 'opacity-50'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                          >
                            {isFirstHour && (
                              <>
                                <div className="font-semibold truncate">{event.title}</div>
                                <div className="text-muted-foreground hidden sm:block">
                                  {format(event.startTime, 'HH:mm')}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
