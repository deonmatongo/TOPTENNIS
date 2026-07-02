import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, isSameDay } from 'date-fns';

interface ScheduleMiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  availabilityDates?: Date[];
  bookingDates?: Date[];
}

export const ScheduleMiniCalendar = ({
  selectedDate,
  onDateSelect,
  availabilityDates = [],
  bookingDates = [],
}: ScheduleMiniCalendarProps) => {
  const modifiers = {
    availability: availabilityDates,
    booking: bookingDates,
  };

  const modifiersClassNames = {
    availability: 'bg-green-100 dark:bg-green-900 font-semibold',
    booking: 'bg-blue-100 dark:bg-blue-900 font-semibold',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarIcon className="w-4 h-4" />
          Quick Jump
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onDateSelect(date)}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          className="rounded-md border w-full"
        />
        <div className="mt-3 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 dark:bg-green-900 rounded" />
            <span>Has availability</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900 rounded" />
            <span>Has booking</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
