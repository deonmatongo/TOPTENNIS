import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, Calendar, Users, User, Trophy, Dumbbell } from 'lucide-react';
import { CalendarFilter, EventType } from '@/types/calendar';
import { Badge } from '@/components/ui/badge';

interface CalendarSidebarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  filter: CalendarFilter;
  onFilterChange: (filter: CalendarFilter) => void;
  onCreateEvent: () => void;
}

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: any; color: string }> = {
  match: { label: 'Matches', icon: Users, color: 'bg-green-500' },
  lesson: { label: 'Lessons', icon: User, color: 'bg-blue-500' },
  tournament: { label: 'Tournaments', icon: Trophy, color: 'bg-orange-500' },
  practice: { label: 'Practice', icon: Dumbbell, color: 'bg-purple-500' },
};

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  currentDate,
  onDateSelect,
  filter,
  onFilterChange,
  onCreateEvent,
}) => {
  const toggleEventType = (type: EventType) => {
    const newTypes = filter.eventTypes.includes(type)
      ? filter.eventTypes.filter((t) => t !== type)
      : [...filter.eventTypes, type];
    onFilterChange({ ...filter, eventTypes: newTypes });
  };

  return (
    <div className="w-80 space-y-4 flex-shrink-0 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Create Event Button */}
      <Button onClick={onCreateEvent} className="w-full" size="lg">
        <Plus className="mr-2 h-5 w-5" />
        Create Event
      </Button>

      {/* Mini Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Calendar</CardTitle>
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
                  id={type}
                  checked={isChecked}
                  onCheckedChange={() => toggleEventType(type)}
                />
                <Label
                  htmlFor={type}
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

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">This Week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Events</span>
            <Badge>0</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Matches</span>
            <Badge variant="secondary">0</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Lessons</span>
            <Badge variant="secondary">0</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
