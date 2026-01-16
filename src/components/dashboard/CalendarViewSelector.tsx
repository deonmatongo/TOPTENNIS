import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, List, CalendarDays } from 'lucide-react';

export type CalendarView = 'day' | 'week' | 'month' | 'list';

interface CalendarViewSelectorProps {
  activeView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

export const CalendarViewSelector = ({ activeView, onViewChange }: CalendarViewSelectorProps) => {
  return (
    <div className="inline-flex items-center rounded-lg overflow-hidden border border-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('day')}
        className={`rounded-none px-4 h-9 text-sm font-medium ${
          activeView === 'day' 
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
            : 'hover:bg-muted'
        }`}
      >
        Day
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('week')}
        className={`rounded-none px-4 h-9 text-sm font-medium border-x border-border ${
          activeView === 'week' 
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
            : 'hover:bg-muted'
        }`}
      >
        Week
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('month')}
        className={`rounded-none px-4 h-9 text-sm font-medium border-x border-border ${
          activeView === 'month' 
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
            : 'hover:bg-muted'
        }`}
      >
        Month
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('list')}
        className={`rounded-none px-4 h-9 text-sm font-medium ${
          activeView === 'list' 
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
            : 'hover:bg-muted'
        }`}
      >
        List
      </Button>
    </div>
  );
};
