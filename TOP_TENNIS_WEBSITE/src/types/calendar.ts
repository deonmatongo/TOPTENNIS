// Calendar event types and interfaces

export type EventType = 'match' | 'lesson' | 'tournament' | 'practice';
export type EventStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
export type RSVPStatus = 'yes' | 'no' | 'maybe' | 'pending';
export type CalendarView = 'day' | 'week' | 'month' | 'list';
export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  status: EventStatus;
  startTime: Date;
  endTime: Date;
  location?: string;
  courtNumber?: string;
  
  // Participants
  creatorId: string;
  participants: EventParticipant[];
  
  // Recurrence
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceEndDate?: Date;
  parentEventId?: string; // For recurring instances
  
  // Notifications
  reminders: EventReminder[];
  
  // Additional details
  notes?: string;
  attachments?: string[];
  videoCallLink?: string;
  
  // Privacy
  isPrivate: boolean;
  calendarId: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface EventParticipant {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'organizer' | 'player' | 'coach';
  rsvpStatus: RSVPStatus;
  profilePicture?: string;
}

export interface EventReminder {
  id: string;
  minutesBefore: number;
  type: 'notification' | 'email' | 'sms';
  sent: boolean;
}

export interface TennisCalendar {
  id: string;
  name: string;
  color: string;
  userId: string;
  isVisible: boolean;
  isDefault: boolean;
  createdAt: Date;
}

export interface CalendarFilter {
  eventTypes: EventType[];
  calendarIds: string[];
  searchQuery?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
