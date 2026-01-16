import React, { useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  isSameMonth, 
  isSameDay,
  isToday,
  isBefore,
  startOfDay
} from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ScheduleCalendarProps {
  currentDate: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  availabilityDates: Date[];
  onAddAvailability?: (date: Date) => void;
}

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  currentDate,
  selectedDate,
  onDateSelect,
  onPrevMonth,
  onNextMonth,
  onToday,
  availabilityDates,
  onAddAvailability,
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const hasAvailability = useCallback((date: Date) => {
    return availabilityDates.some(availDate => isSameDay(availDate, date));
  }, [availabilityDates]);

  const isPastDate = useCallback((date: Date) => {
    return isBefore(startOfDay(date), startOfDay(new Date()));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        onDateSelect(addDays(selectedDate, -1));
      } else if (e.key === 'ArrowRight') {
        onDateSelect(addDays(selectedDate, 1));
      } else if (e.key === 'ArrowUp') {
        onDateSelect(addDays(selectedDate, -7));
      } else if (e.key === 'ArrowDown') {
        onDateSelect(addDays(selectedDate, 7));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate, onDateSelect]);

  const handleDoubleClick = (date: Date) => {
    if (!isPastDate(date) && onAddAvailability) {
      onAddAvailability(date);
    }
  };

  const renderDays = () => {
    const days = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      const currentDay = day;
      const isCurrentMonth = isSameMonth(currentDay, currentDate);
      const isSelected = isSameDay(currentDay, selectedDate);
      const isTodayDate = isToday(currentDay);
      const hasSlot = hasAvailability(currentDay);
      const isPast = isPastDate(currentDay);

      days.push(
        <TooltipProvider key={currentDay.toISOString()} delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDateSelect(currentDay)}
                onDoubleClick={() => handleDoubleClick(currentDay)}
                disabled={!isCurrentMonth}
                className={cn(
                  "relative aspect-square p-2 flex flex-col items-center justify-center rounded-lg transition-all duration-200",
                  "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1",
                  !isCurrentMonth && "text-muted-foreground/40 cursor-default hover:bg-transparent",
                  isSelected && "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
                  isTodayDate && !isSelected && "ring-2 ring-primary ring-offset-2",
                  isPast && isCurrentMonth && !isSelected && "text-muted-foreground/60"
                )}
              >
                <span className={cn(
                  "text-sm font-medium transition-transform duration-150",
                  isSelected && "text-primary-foreground scale-110"
                )}>
                  {format(currentDay, 'd')}
                </span>
                {hasSlot && !isSelected && (
                  <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
                {hasSlot && isSelected && (
                  <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                )}
              </button>
            </TooltipTrigger>
            {isCurrentMonth && !isPast && (
              <TooltipContent side="top" className="text-xs">
                {hasSlot ? 'Has availability • Double-click to add more' : 'Double-click to add availability'}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      );
      day = addDays(day, 1);
    }

    return days;
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm p-6 animate-fade-in">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onPrevMonth} 
            className="h-8 w-8 hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onToday} 
            className="h-8 px-3 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Today
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onNextMonth} 
            className="h-8 w-8 hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-xl font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-2">
        {weekdays.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {renderDays()}
      </div>

      {/* Help text */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        Use arrow keys to navigate • Double-click a date to add availability
      </p>
    </div>
  );
};
