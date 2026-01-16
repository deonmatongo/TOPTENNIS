// Recurring availability utilities
import { addDays, addWeeks, addMonths, isBefore, isAfter, startOfDay } from 'date-fns';

export type RecurrencePattern = 'none' | 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  pattern: RecurrencePattern;
  interval: number; // e.g., every 2 weeks
  endDate?: Date;
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday) for weekly pattern
}

export interface AvailabilitySlot {
  date: Date;
  startTime: string;
  endTime: string;
}

export const generateRecurringDates = (
  startDate: Date,
  rule: RecurrenceRule,
  maxOccurrences: number = 52 // Default to 1 year of weekly events
): Date[] => {
  const dates: Date[] = [];
  let currentDate = startDate;
  const endDate = rule.endDate || addMonths(startDate, 12); // Default to 1 year

  let occurrences = 0;

  while (
    isBefore(currentDate, endDate) &&
    occurrences < maxOccurrences
  ) {
    dates.push(new Date(currentDate));
    occurrences++;

    switch (rule.pattern) {
      case 'daily':
        currentDate = addDays(currentDate, rule.interval);
        break;
      case 'weekly':
        currentDate = addWeeks(currentDate, rule.interval);
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, rule.interval);
        break;
      default:
        return [startDate];
    }
  }

  return dates;
};

export const generateRecurringSlots = (
  baseSlot: AvailabilitySlot,
  rule: RecurrenceRule,
  maxOccurrences?: number
): AvailabilitySlot[] => {
  if (rule.pattern === 'none') {
    return [baseSlot];
  }

  const dates = generateRecurringDates(baseSlot.date, rule, maxOccurrences);

  return dates.map((date) => ({
    ...baseSlot,
    date,
  }));
};

export const encodeRecurrenceRule = (rule: RecurrenceRule): string => {
  return JSON.stringify(rule);
};

export const decodeRecurrenceRule = (ruleString: string): RecurrenceRule | null => {
  try {
    const rule = JSON.parse(ruleString);
    // Convert endDate string back to Date if it exists
    if (rule.endDate) {
      rule.endDate = new Date(rule.endDate);
    }
    return rule;
  } catch {
    return null;
  }
};

export const getRecurrenceDescription = (rule: RecurrenceRule): string => {
  if (rule.pattern === 'none') return 'Does not repeat';

  const intervalText = rule.interval === 1 ? '' : `every ${rule.interval} `;
  
  let patternText = '';
  switch (rule.pattern) {
    case 'daily':
      patternText = `${intervalText}day${rule.interval > 1 ? 's' : ''}`;
      break;
    case 'weekly':
      patternText = `${intervalText}week${rule.interval > 1 ? 's' : ''}`;
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const days = rule.daysOfWeek
          .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
          .join(', ');
        patternText += ` on ${days}`;
      }
      break;
    case 'monthly':
      patternText = `${intervalText}month${rule.interval > 1 ? 's' : ''}`;
      break;
  }

  const endText = rule.endDate
    ? ` until ${rule.endDate.toLocaleDateString()}`
    : '';

  return `Repeats ${patternText}${endText}`;
};
