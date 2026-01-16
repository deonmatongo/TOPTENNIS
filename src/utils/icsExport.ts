// ICS Export utility for calendar events
import { format } from 'date-fns';

interface ICSEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  uid?: string;
}

export const generateICS = (event: ICSEvent): string => {
  const formatDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };

  const escapeString = (str: string) => {
    return str.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tennis League//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid || `${Date.now()}@tennisleague.com`}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.startDate)}`,
    `DTEND:${formatDate(event.endDate)}`,
    `SUMMARY:${escapeString(event.title)}`,
  ];

  if (event.description) {
    icsContent.push(`DESCRIPTION:${escapeString(event.description)}`);
  }

  if (event.location) {
    icsContent.push(`LOCATION:${escapeString(event.location)}`);
  }

  icsContent.push('END:VEVENT', 'END:VCALENDAR');

  return icsContent.join('\r\n');
};

export const downloadICS = (event: ICSEvent, filename?: string) => {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || `${event.title.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

export const generateMultipleEventsICS = (events: ICSEvent[]): string => {
  const formatDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss");
  };

  const escapeString = (str: string) => {
    return str.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tennis League//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event) => {
    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${event.uid || `${Date.now()}-${Math.random()}@tennisleague.com`}`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(event.startDate)}`,
      `DTEND:${formatDate(event.endDate)}`,
      `SUMMARY:${escapeString(event.title)}`
    );

    if (event.description) {
      icsContent.push(`DESCRIPTION:${escapeString(event.description)}`);
    }

    if (event.location) {
      icsContent.push(`LOCATION:${escapeString(event.location)}`);
    }

    icsContent.push('END:VEVENT');
  });

  icsContent.push('END:VCALENDAR');

  return icsContent.join('\r\n');
};

// Export for TennisCalendar
export const exportToICS = (events: any[]) => {
  const icsEvents = events.map(e => ({
    title: e.title,
    description: e.description,
    location: e.location,
    startDate: e.startTime,
    endDate: e.endTime,
    uid: e.id,
  }));
  
  const icsContent = generateMultipleEventsICS(icsEvents);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tennis-calendar-${format(new Date(), 'yyyy-MM-dd')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
