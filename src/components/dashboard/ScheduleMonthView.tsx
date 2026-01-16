import React, { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameDay, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useUserAvailability } from '@/hooks/useUserAvailability';
import { useMatchInvites } from '@/hooks/useMatchInvites';

interface ScheduleMonthViewProps {
  currentDate: Date;
  onDateClick: (date: Date) => void;
}

export const ScheduleMonthView: React.FC<ScheduleMonthViewProps> = ({
  currentDate,
  onDateClick,
}) => {
  const { availability } = useUserAvailability();
  const { invites } = useMatchInvites();

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

  const getAvailabilitySlotsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return availability.filter((avail) => avail.date === dateStr && avail.is_available && !avail.is_blocked);
  };

  const getInvitesForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return invites.filter((invite) => invite.date === dateStr && (invite.status === 'pending' || invite.status === 'accepted'));
  };

  const isToday = (date: Date) => isSameDay(date, new Date());
  const isCurrentMonth = (date: Date) => isSameMonth(date, currentDate);

  const weeks = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="p-1.5 sm:p-2 text-center text-xs sm:text-sm font-semibold text-muted-foreground">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-0.5 sm:space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {week.map((day) => {
              const availabilitySlots = getAvailabilitySlotsForDay(day);
              const dayInvites = getInvitesForDay(day);
              const isOutsideMonth = !isCurrentMonth(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[80px] sm:min-h-[100px] lg:min-h-[120px] p-1 sm:p-2 border rounded-lg transition-all cursor-pointer',
                    isOutsideMonth && 'bg-muted/30 opacity-50',
                    isToday(day) && 'border-primary border-2 bg-primary/5 ring-1 ring-primary/20',
                    !isOutsideMonth && 'hover:bg-accent/50 active:scale-[0.98]'
                  )}
                  onClick={() => onDateClick(day)}
                >
                  <div
                    className={cn(
                      'text-xs sm:text-sm font-semibold mb-1',
                      isToday(day) && 'text-primary'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1">
                    {availabilitySlots.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] sm:text-xs w-full justify-center">
                        {availabilitySlots.length} slot{availabilitySlots.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    
                    {dayInvites.map((invite, idx) => (
                      <div
                        key={invite.id}
                        className={cn(
                          'text-[10px] sm:text-xs p-1 rounded truncate',
                          invite.status === 'accepted' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-orange-100 dark:bg-orange-900'
                        )}
                      >
                        {format(new Date(`2000-01-01T${invite.start_time}`), 'HH:mm')}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-3 sm:pt-4 border-t">
        <div className="text-xs sm:text-sm font-semibold">Legend:</div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">Availability</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900 rounded" />
          <span className="text-xs">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-orange-100 dark:bg-orange-900 rounded" />
          <span className="text-xs">Pending</span>
        </div>
      </div>
    </div>
  );
};
