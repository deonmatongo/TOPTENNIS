import { useState } from 'react';
import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';

export interface CalendarExportEvent {
  title: string;
  date: string;          // 'YYYY-MM-DD'
  startTime: string;     // 'HH:MM'
  endTime: string;       // 'HH:MM'
  location?: string;
  notes?: string;
}

const getDefaultCalendarId = async (): Promise<string | null> => {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (Platform.OS === 'ios') {
    const def = await Calendar.getDefaultCalendarAsync();
    return def?.id ?? calendars[0]?.id ?? null;
  }
  const writable = calendars.find(c => c.allowsModifications && c.accessLevel === 'owner');
  return writable?.id ?? calendars[0]?.id ?? null;
};

const buildDate = (dateStr: string, timeStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, h, min || 0, 0);
};

export const useCalendarExport = () => {
  const [exporting, setExporting] = useState(false);

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Calendar Access Required',
        'Please allow calendar access in your device settings to export matches.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const exportEvent = async (event: CalendarExportEvent): Promise<boolean> => {
    setExporting(true);
    try {
      const granted = await requestPermission();
      if (!granted) return false;

      const calendarId = await getDefaultCalendarId();
      if (!calendarId) {
        Alert.alert('Error', 'No writable calendar found on this device.');
        return false;
      }

      const startDate = buildDate(event.date, event.startTime);
      const endDate = buildDate(event.date, event.endTime);

      await Calendar.createEventAsync(calendarId, {
        title: event.title,
        startDate,
        endDate,
        location: event.location,
        notes: event.notes,
        alarms: [
          { relativeOffset: -60 },   // 1 hour before
          { relativeOffset: -1440 },  // 1 day before
        ],
      });

      Alert.alert('Added to Calendar', `"${event.title}" has been added to your calendar.`);
      return true;
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Could not add event to calendar.');
      return false;
    } finally {
      setExporting(false);
    }
  };

  const exportMultiple = async (events: CalendarExportEvent[]): Promise<number> => {
    setExporting(true);
    let count = 0;
    try {
      const granted = await requestPermission();
      if (!granted) return 0;

      const calendarId = await getDefaultCalendarId();
      if (!calendarId) {
        Alert.alert('Error', 'No writable calendar found on this device.');
        return 0;
      }

      for (const event of events) {
        try {
          const startDate = buildDate(event.date, event.startTime);
          const endDate = buildDate(event.date, event.endTime);
          await Calendar.createEventAsync(calendarId, {
            title: event.title,
            startDate,
            endDate,
            location: event.location,
            notes: event.notes,
            alarms: [{ relativeOffset: -60 }, { relativeOffset: -1440 }],
          });
          count++;
        } catch {
          // skip individual failures
        }
      }

      if (count > 0) {
        Alert.alert('Exported!', `${count} match${count > 1 ? 'es' : ''} added to your calendar.`);
      } else {
        Alert.alert('Nothing Exported', 'No matches could be added to your calendar.');
      }
      return count;
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Could not export matches.');
      return 0;
    } finally {
      setExporting(false);
    }
  };

  return { exportEvent, exportMultiple, exporting };
};
