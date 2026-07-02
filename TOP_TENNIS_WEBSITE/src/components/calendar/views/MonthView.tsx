import React, { useMemo } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameDay, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MonthViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, time: string) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  events,
  currentDate,
  onEventClick,
  onSlotClick,
}) => {
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => isSameDay(event.startTime, day));
  };

  const isToday = (date: Date) => isSameDay(date, new Date());
  const isCurrentMonth = (date: Date) => isSameMonth(date, currentDate);

  const getEventBadgeColor = (type: CalendarEvent['type']) => {
    const colors = {
      match: 'bg-green-500',
      lesson: 'bg-blue-500',
      tournament: 'bg-orange-500',
      practice: 'bg-purple-500',
    };
    return colors[type];
  };

  const weeks = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Day headers - responsive */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="p-1.5 sm:p-2 text-center text-xs sm:text-sm font-semibold text-muted-foreground">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid - responsive */}
      <div className="space-y-0.5 sm:space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {week.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isOutsideMonth = !isCurrentMonth(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[70px] sm:min-h-[90px] lg:min-h-[110px] xl:min-h-[120px] p-1 sm:p-2 border rounded-lg transition-all touch-manipulation',
                    isOutsideMonth && 'bg-muted/30 opacity-50',
                    isToday(day) && 'border-primary border-2 bg-primary/5 ring-1 ring-primary/20',
                    !isOutsideMonth && 'cursor-pointer hover:bg-accent/50 active:scale-[0.98]'
                  )}
                  onClick={() => onSlotClick(day, '10:00')}
                >
                  <div
                    className={cn(
                      'text-xs sm:text-sm font-semibold mb-1',
                      isToday(day) && 'text-primary'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-0.5 sm:space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs p-1 sm:p-1.5 rounded cursor-pointer transition-transform hover:opacity-80 active:scale-95 truncate bg-background/80 border touch-manipulation"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <div className={cn('w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0', getEventBadgeColor(event.type))} />
                          <span className="truncate font-medium">{event.title}</span>
                        </div>
                        <div className="text-muted-foreground hidden sm:block text-[10px] sm:text-xs mt-0.5">
                          {format(event.startTime, 'HH:mm')}
                        </div>
                      </div>
                    ))}
                    
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] sm:text-xs text-muted-foreground pl-1 font-medium">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend - responsive */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-3 sm:pt-4 border-t">
        <div className="text-xs sm:text-sm font-semibold">Legend:</div>
        {[
          { type: 'match', label: 'Match' },
          { type: 'lesson', label: 'Lesson' },
          { type: 'tournament', label: 'Tournament' },
          { type: 'practice', label: 'Practice' },
        ].map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1.5 sm:gap-2">
            <div className={cn('w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full', getEventBadgeColor(type as CalendarEvent['type']))} />
            <span className="text-xs sm:text-sm">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
