// US timezone mapping with UTC offsets
const US_TIMEZONE_OFFSETS: Record<string, number> = {
  'America/New_York': -5,      // Eastern Time
  'America/Chicago': -6,        // Central Time
  'America/Denver': -7,         // Mountain Time
  'America/Los_Angeles': -8,    // Pacific Time
  'America/Anchorage': -9,      // Alaska Time
  'Pacific/Honolulu': -10,      // Hawaii Time
  'America/Phoenix': -7,        // Arizona (MST, no DST)
  'America/Indiana/Indianapolis': -5,  // Eastern Time (Indiana)
  'America/Detroit': -5,        // Eastern Time (Michigan)
  'America/Kentucky/Louisville': -5,  // Eastern Time (Kentucky)
  'America/Menominee': -6,      // Central Time (Wisconsin)
  'America/North_Dakota/Center': -6,  // Central Time (ND)
  'America/North_Dakota/New_Salem': -6,  // Central Time (ND)
  'America/South_Dakota/Center': -6,  // Central Time (SD)
  'America/South_Dakota/Mountain': -7,  // Mountain Time (SD)
  'America/Montana': -7,        // Mountain Time (Montana)
  'America/Boise': -7,          // Mountain Time (Idaho)
  'America/Oregon': -8,         // Pacific Time (Oregon)
  'UTC': 0,
};

// Get timezone display name
export const getTimezoneDisplayName = (timezone: string): string => {
  const names: Record<string, string> = {
    'America/New_York': 'Eastern Time',
    'America/Chicago': 'Central Time',
    'America/Denver': 'Mountain Time',
    'America/Los_Angeles': 'Pacific Time',
    'America/Anchorage': 'Alaska Time',
    'Pacific/Honolulu': 'Hawaii Time',
    'America/Phoenix': 'Arizona Time',
    'America/Indiana/Indianapolis': 'Eastern Time',
    'America/Detroit': 'Eastern Time',
    'America/Kentucky/Louisville': 'Eastern Time',
    'America/Menominee': 'Central Time',
    'America/North_Dakota/Center': 'Central Time',
    'America/North_Dakota/New_Salem': 'Central Time',
    'America/South_Dakota/Center': 'Central Time',
    'America/South_Dakota/Mountain': 'Mountain Time',
    'America/Montana': 'Mountain Time',
    'America/Boise': 'Mountain Time',
    'America/Oregon': 'Pacific Time',
    'UTC': 'UTC',
  };
  return names[timezone] || timezone;
};

// Convert time from one timezone to another
export const convertTimeBetweenTimezones = (
  time: string,
  fromTimezone: string,
  toTimezone: string,
  date: string
): string => {
  if (!time || fromTimezone === toTimezone) return time;

  try {
    // Parse the time and date
    const [hours, minutes] = time.split(':').map(Number);
    const [year, month, day] = date.split('-').map(Number);
    
    // Create date in source timezone
    const sourceDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    // Get timezone offsets
    const fromOffset = US_TIMEZONE_OFFSETS[fromTimezone] || 0;
    const toOffset = US_TIMEZONE_OFFSETS[toTimezone] || 0;
    
    // Calculate the time difference
    const offsetDiff = toOffset - fromOffset;
    
    // Apply the offset difference
    const convertedDate = new Date(sourceDate.getTime() + (offsetDiff * 60 * 60 * 1000));
    
    // Format back to HH:MM format
    const convertedHours = convertedDate.getHours().toString().padStart(2, '0');
    const convertedMinutes = convertedDate.getMinutes().toString().padStart(2, '0');
    
    return `${convertedHours}:${convertedMinutes}`;
  } catch (error) {
    console.error('Error converting time:', error);
    return time; // Return original time if conversion fails
  }
};

// Get user's local timezone (default to Eastern Time)
export const getUserTimezone = (): string => {
  // Try to detect user's timezone, default to Eastern Time
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Map common timezone names to our supported ones
  const timezoneMap: Record<string, string> = {
    'America/New_York': 'America/New_York',
    'US/Eastern': 'America/New_York',
    'America/Chicago': 'America/Chicago',
    'US/Central': 'America/Chicago',
    'America/Denver': 'America/Denver',
    'US/Mountain': 'America/Denver',
    'America/Los_Angeles': 'America/Los_Angeles',
    'US/Pacific': 'America/Los_Angeles',
    'America/Phoenix': 'America/Phoenix',
    'America/Anchorage': 'America/Anchorage',
    'US/Alaska': 'America/Anchorage',
    'Pacific/Honolulu': 'Pacific/Honolulu',
    'US/Hawaii': 'Pacific/Honolulu',
  };
  
  return timezoneMap[userTimezone] || 'America/New_York'; // Default to Eastern Time
};

// Format time with timezone indicator
export const formatTimeWithTimezone = (
  time: string,
  timezone: string,
  showTimezoneName: boolean = true
): string => {
  const displayName = getTimezoneDisplayName(timezone);
  const timezoneCode = timezone.split('/').pop()?.replace('_', ' ') || timezone;
  
  if (showTimezoneName) {
    return `${time} (${displayName})`;
  }
  
  return `${time} (${timezoneCode})`;
};
