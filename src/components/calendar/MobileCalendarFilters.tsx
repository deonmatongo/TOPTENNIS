import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Filter, Calendar, Users, User, Trophy, Dumbbell } from 'lucide-react';
import { CalendarFilter, EventType } from '@/types/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MobileCalendarFiltersProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  filter: CalendarFilter;
  onFilterChange: (filter: CalendarFilter) => void;
}

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: any; color: string }> = {
  match: { label: 'Matches', icon: Users, color: 'bg-green-500' },
  lesson: { label: 'Lessons', icon: User, color: 'bg-blue-500' },
  tournament: { label: 'Tournaments', icon: Trophy, color: 'bg-orange-500' },
  practice: { label: 'Practice', icon: Dumbbell, color: 'bg-purple-500' },
};

export const MobileCalendarFilters: React.FC<MobileCalendarFiltersProps> = ({
  currentDate,
  onDateSelect,
  filter,
  onFilterChange,
}) => {
  const toggleEventType = (type: EventType) => {
    const newTypes = filter.eventTypes.includes(type)
      ? filter.eventTypes.filter((t) => t !== type)
      : [...filter.eventTypes, type];
    onFilterChange({ ...filter, eventTypes: newTypes });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Calendar Filters</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Mini Calendar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Jump to Date</CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarComponent
                mode="single"
                selected={currentDate}
                onSelect={(date) => date && onDateSelect(date)}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Event Type Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Event Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((type) => {
                const config = EVENT_TYPE_CONFIG[type];
                const Icon = config.icon;
                const isChecked = filter.eventTypes.includes(type);

                return (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`mobile-${type}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleEventType(type)}
                    />
                    <Label
                      htmlFor={`mobile-${type}`}
                      className="flex items-center gap-2 cursor-pointer flex-1"
                    >
                      <div className={`w-3 h-3 rounded-full ${config.color}`} />
                      <Icon className="w-4 h-4" />
                      <span>{config.label}</span>
                    </Label>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};
