# Timezone Feature Setup

## Database Migration Required

Before the timezone feature will work, you need to run the following migration in Supabase:

### Migration File
`supabase/migrations/20260120000000_add_user_timezone_preference.sql`

### SQL to Run in Supabase SQL Editor

```sql
-- Add preferred_timezone column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_timezone TEXT DEFAULT 'America/New_York';

-- Add comment
COMMENT ON COLUMN profiles.preferred_timezone IS 'User''s preferred timezone for displaying times in the calendar';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_timezone ON profiles(preferred_timezone);
```

## Features Added

### 1. User Timezone Preference
- Users can select their preferred timezone from a dropdown
- Timezone preference is saved to their profile
- Stored in localStorage for quick access
- Auto-detects user's timezone on first visit

### 2. Calendar Timezone Display
- Timezone selector in calendar header
- All times displayed in user's selected timezone
- Clear indicator showing which timezone is active

### 3. Match Invite Timezone Conversion
- When viewing match invites from users in different timezones
- Shows original timezone and option to convert to user's timezone
- Prevents confusion about match times

### 4. Supported Timezones
- Eastern Time (ET) - America/New_York
- Central Time (CT) - America/Chicago
- Mountain Time (MT) - America/Denver
- Pacific Time (PT) - America/Los_Angeles
- Alaska Time (AKT) - America/Anchorage
- Hawaii Time (HT) - Pacific/Honolulu
- Arizona Time (MST) - America/Phoenix
- And more US timezone variants

## How to Use

### For Users
1. Go to Schedule tab
2. Click timezone dropdown in calendar header
3. Select your timezone
4. All times will automatically convert to your timezone

### For Developers
```typescript
import { useUserTimezone } from '@/hooks/useUserTimezone';

const { timezone, updateTimezone, loading } = useUserTimezone();

// Get current timezone
console.log(timezone); // 'America/New_York'

// Update timezone
updateTimezone('America/Los_Angeles');
```

## Timezone Conversion Utilities

```typescript
import { 
  convertTimeBetweenTimezones, 
  getTimezoneDisplayName,
  formatTimeWithTimezone 
} from '@/utils/timezoneConversion';

// Convert time between timezones
const convertedTime = convertTimeBetweenTimezones(
  '14:00',           // time
  'America/New_York', // from timezone
  'America/Los_Angeles', // to timezone
  '2026-01-20'       // date
);

// Get display name
const displayName = getTimezoneDisplayName('America/New_York');
// Returns: 'Eastern Time'

// Format with timezone
const formatted = formatTimeWithTimezone('14:00', 'America/New_York');
// Returns: '14:00 (Eastern Time)'
```

## Testing

1. Run the migration in Supabase
2. Refresh the application
3. Go to Schedule tab
4. Select different timezones and verify times update
5. Create availability in one timezone
6. Switch timezone and verify times convert correctly
7. Send match invite and verify recipient sees correct time

## Troubleshooting

### TypeScript Errors
If you see TypeScript errors about `preferred_timezone` not existing, this is expected until the migration is run. The column doesn't exist in the database yet.

### Times Not Converting
- Verify migration was run successfully
- Check browser console for errors
- Ensure timezone is being saved to localStorage
- Clear localStorage and try again

### Default Timezone
If no timezone is selected, the system defaults to:
1. User's browser detected timezone (if supported)
2. Eastern Time (America/New_York) as fallback
