import React from 'react';
import { CalendarEvent } from '@/types/calendar';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Users } from 'lucide-react';

interface DayViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, time: string) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM

export const DayView: React.FC<DayViewProps> = ({
  events,
  currentDate,
  onEventClick,
  onSlotClick,
}) => {
  const dayEvents = events.filter((event) =>
    isSameDay(event.startTime, currentDate)
  );

  const getEventsForHour = (hour: number) => {
    return dayEvents.filter((event) => {
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

  const isPast = currentDate < new Date() && !isSameDay(currentDate, new Date());

  return (
    <div className="space-y-1 sm:space-y-2">
      {HOURS.map((hour) => {
        const hourEvents = getEventsForHour(hour);
        const timeStr = format(new Date().setHours(hour, 0, 0, 0), 'HH:mm');

        return (
          <div key={hour} className="flex gap-2 sm:gap-4 border-b pb-1 sm:pb-2">
            {/* Time label - responsive width */}
            <div className="w-16 sm:w-20 lg:w-24 text-xs sm:text-sm text-muted-foreground flex-shrink-0 pt-2 font-medium">
              {timeStr}
            </div>

            {/* Hour slot - touch-friendly */}
            <div
              className={cn(
                'flex-1 min-h-[60px] sm:min-h-[80px] p-2 sm:p-3 rounded-lg border-2 border-dashed transition-all touch-manipulation',
                isPast ? 'bg-muted/30 cursor-not-allowed' : 'cursor-pointer hover:bg-accent/50 hover:border-primary active:scale-[0.99]'
              )}
              onClick={() => {
                if (!isPast) {
                  onSlotClick(currentDate, `${hour.toString().padStart(2, '0')}:00`);
                }
              }}
            >
              <div className="space-y-2">
                {hourEvents.length === 0 ? (
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {isPast ? 'Past' : 'Tap to add event'}
                  </div>
                ) : (
                  hourEvents.map((event) => {
                    const startHour = event.startTime.getHours();
                    const isFirstHour = hour === startHour;

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          'p-3 sm:p-4 rounded-lg border-l-4 cursor-pointer transition-all touch-manipulation min-h-[44px]',
                          getEventStyle(event),
                          !isFirstHour && 'opacity-50',
                          'active:scale-[0.98]'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        {isFirstHour && (
                          <>
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-base sm:text-lg line-clamp-2">{event.title}</h3>
                              <span className="text-xs font-medium px-2 py-1 bg-background/50 rounded ml-2 flex-shrink-0">
                                {event.type}
                              </span>
                            </div>
                            <div className="space-y-1.5 text-xs sm:text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>{format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}</span>
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="truncate">
                                    {event.location}
                                    {event.courtNumber && ` - ${event.courtNumber}`}
                                  </span>
                                </div>
                              )}
                              {event.participants.length > 0 && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Users className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="truncate">{event.participants.map(p => p.userName).join(', ')}</span>
                                </div>
                              )}
                              {event.description && (
                                <p className="text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
