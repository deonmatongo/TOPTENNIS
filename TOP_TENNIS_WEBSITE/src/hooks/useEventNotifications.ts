import { useEffect } from 'react';
import { CalendarEvent } from '@/types/calendar';
import { useBrowserNotifications } from './useBrowserNotifications';

export const useEventNotifications = (events: CalendarEvent[]) => {
  const { permission, sendNotification } = useBrowserNotifications();

  useEffect(() => {
    if (permission !== 'granted' || events.length === 0) return;

    // Track which events we've already sent notifications for
    const notifiedEvents = new Set<string>();

    const checkReminders = () => {
      const now = new Date();

      events.forEach((event) => {
        // Skip if we already notified for this event
        if (notifiedEvents.has(event.id)) return;

        // Skip past events
        if (event.startTime < now) return;

        event.reminders.forEach((reminder) => {
          // Skip if already sent
          if (reminder.sent) return;

          // Calculate when the reminder should fire
          const reminderTime = new Date(event.startTime.getTime() - reminder.minutesBefore * 60 * 1000);

          // Check if it's time to send the reminder
          if (now >= reminderTime && now < event.startTime) {
            // Send only ONE notification per event (using the earliest reminder)
            if (!notifiedEvents.has(event.id)) {
              sendNotification(
                `Upcoming ${event.type}: ${event.title}`,
                {
                  body: `Starting at ${event.startTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  })}${event.location ? ` at ${event.location}` : ''}`,
                  tag: event.id, // Ensure we don't duplicate notifications for the same event
                  requireInteraction: false,
                }
              );

              // Mark this event as notified
              notifiedEvents.add(event.id);
              
              // Mark reminder as sent (in a real app, this would be persisted)
              reminder.sent = true;
            }
          }
        });
      });
    };

    // Check immediately
    checkReminders();

    // Check every minute
    const interval = setInterval(checkReminders, 60 * 1000);

    return () => clearInterval(interval);
  }, [events, permission, sendNotification]);
};
