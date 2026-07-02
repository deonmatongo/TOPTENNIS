import React from 'react';
import { EnhancedCalendar } from './EnhancedCalendar';

export const CalendarTab = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Tennis Calendar</h1>
        <p className="text-muted-foreground mt-2">
          Manage your availability, schedule matches, and track your tennis activities
        </p>
      </div>
      <EnhancedCalendar />
    </div>
  );
};