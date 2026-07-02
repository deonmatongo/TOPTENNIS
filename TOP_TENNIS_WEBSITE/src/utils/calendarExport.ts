import { format } from 'date-fns';

interface CalendarEvent {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  description?: string;
  status?: string;
}

export const generateICS = (events: CalendarEvent[]): string => {
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tennis League//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event) => {
    const formatDate = (date: Date) => {
      return format(date, "yyyyMMdd'T'HHmmss");
    };

    const uid = `${Date.now()}-${Math.random().toString(36).substring(7)}@tennisleague.com`;
    
    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:${uid}`);
    icsLines.push(`DTSTAMP:${formatDate(new Date())}`);
    icsLines.push(`DTSTART:${formatDate(event.startDate)}`);
    icsLines.push(`DTEND:${formatDate(event.endDate)}`);
    icsLines.push(`SUMMARY:${event.title}`);
    
    if (event.description) {
      icsLines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    }
    
    if (event.location) {
      icsLines.push(`LOCATION:${event.location}`);
    }
    
    if (event.status) {
      icsLines.push(`STATUS:${event.status.toUpperCase()}`);
    }
    
    icsLines.push('END:VEVENT');
  });

  icsLines.push('END:VCALENDAR');
  
  return icsLines.join('\r\n');
};

export const downloadICS = (events: CalendarEvent[], filename: string = 'tennis-schedule.ics') => {
  const icsContent = generateICS(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateGoogleCalendarUrl = (event: CalendarEvent): string => {
  const formatDate = (date: Date) => {
    return format(date, "yyyyMMdd'T'HHmmss'Z'");
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDate(event.startDate)}/${formatDate(event.endDate)}`,
    details: event.description || '',
    location: event.location || '',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const generateOutlookUrl = (event: CalendarEvent): string => {
  const formatDate = (date: Date) => {
    return date.toISOString();
  };

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: formatDate(event.startDate),
    enddt: formatDate(event.endDate),
    body: event.description || '',
    location: event.location || '',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};
