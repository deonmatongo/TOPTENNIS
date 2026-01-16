# Tennis Calendar Backend API Documentation

## Overview

The Tennis Calendar backend provides a comprehensive event management system with participant scheduling, availability checking, conflict detection, and automated notifications. All timestamps are stored in UTC and returned in ISO 8601 format with 24-hour notation.

---

## 📊 Database Schema

### Tables

#### `calendar_events`
Main events table storing all calendar events.

**Columns:**
- `id` (UUID) - Primary key
- `creator_id` (UUID) - Event creator
- `event_type` (ENUM) - match, lesson, tournament, practice
- `event_name` (TEXT) - Max 150 characters
- `description` (TEXT) - Optional event description
- `location_name` (TEXT) - Physical or virtual location
- `location_type` (TEXT) - 'physical' or 'virtual'
- `latitude/longitude` (DECIMAL) - Geocoded location
- `virtual_location` (TEXT) - Video call link
- `start_time_utc` (TIMESTAMPTZ) - Start time in UTC
- `end_time_utc` (TIMESTAMPTZ) - End time in UTC
- `duration_minutes` (INTEGER) - Auto-calculated
- `privacy_level` (TEXT) - public, friends-only, private
- `reminder_offset_minutes` (INTEGER) - Default 30
- `is_recurring` (BOOLEAN)
- `recurrence_rule` (JSONB) - RRULE or custom format
- `recurrence_parent_id` (UUID) - For recurring instances
- `status` (TEXT) - scheduled, confirmed, pending_conflict, cancelled, completed
- `color_code` (TEXT) - UI color
- `default_duration` (INTEGER) - Type-based default

#### `event_participants`
Many-to-many relationship between events and users.

**Columns:**
- `id` (UUID) - Primary key
- `event_id` (UUID) - Foreign key to calendar_events
- `user_id` (UUID) - Foreign key to auth.users
- `role` (TEXT) - participant, organizer, coach
- `rsvp_status` (TEXT) - invited, accepted, declined, tentative
- `availability_status` (TEXT) - available, busy, unknown
- `responded_at` (TIMESTAMPTZ)
- `proposed_time_start/end` (TIMESTAMPTZ) - Alternative time suggestion
- `notes` (TEXT)

#### `event_reminders_queue`
Queue for sending event reminders.

**Columns:**
- `id` (UUID) - Primary key
- `event_id` (UUID) - Foreign key
- `user_id` (UUID) - Recipient
- `reminder_time` (TIMESTAMPTZ) - When to send
- `sent` (BOOLEAN) - Delivery status
- `sent_at` (TIMESTAMPTZ)
- `notification_type` (TEXT) - push, email, sms

#### `availability_conflicts`
Tracks scheduling conflicts.

**Columns:**
- `id` (UUID) - Primary key
- `event_id` (UUID)
- `user_id` (UUID)
- `conflict_type` (TEXT) - existing_event, user_availability, proposed_time
- `conflict_details` (JSONB)
- `resolved` (BOOLEAN)

---

## 🔐 Security & Access Control

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

**calendar_events:**
- Creators can create, read, update, delete their own events
- Users can view events based on privacy level
- Public events visible to all authenticated users
- Friends-only visible to accepted friends
- Private visible only to creator and participants

**event_participants:**
- Event creators manage all participant records
- Users can update their own RSVP status
- Users can view participants of events they have access to

**event_reminders_queue:**
- Users view their own reminders
- System (service role) manages all reminders

**availability_conflicts:**
- Users view their own conflicts
- Event creators view conflicts for their events

### Helper Functions

#### `can_view_event(event_id, user_id)`
Returns boolean indicating if user can view the event based on privacy settings.

#### `check_event_conflicts(user_id, start_time, end_time, exclude_event_id)`
Returns conflicting events and blocked time slots for a user.

---

## 📡 API Endpoints

### Base URL
All Edge Functions are available at:
```
https://<your-project>.supabase.co/functions/v1/
```

### Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <user_jwt_token>
```

---

## 1. Create Event

**Endpoint:** `POST /create-event`

**Description:** Creates a new calendar event with optional participants and automatic conflict detection.

**Request Body:**
```json
{
  "event_type": "match",
  "event_name": "Singles Match with Alex",
  "description": "Friendly singles match",
  "location_name": "Central Tennis Club",
  "location_type": "physical",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "start_time_utc": "2025-10-18T14:00:00Z",
  "end_time_utc": "2025-10-18T16:00:00Z",
  "privacy_level": "public",
  "reminder_offset_minutes": 30,
  "is_recurring": false,
  "recurrence_rule": null,
  "participants": ["user-uuid-1", "user-uuid-2"],
  "color_code": "#3B82F6",
  "check_conflicts": true
}
```

**Response (Success with conflicts):**
```json
{
  "success": true,
  "event": {
    "id": "event-uuid",
    "event_type": "match",
    "event_name": "Singles Match with Alex",
    "start_time_utc": "2025-10-18T14:00:00Z",
    "status": "pending_conflict",
    ...
  },
  "conflicts": [
    {
      "user_id": "user-uuid-1",
      "conflicts": [
        {
          "conflict_type": "existing_event",
          "conflict_event_id": "other-event-uuid",
          "conflict_start": "2025-10-18T13:30:00Z",
          "conflict_end": "2025-10-18T15:00:00Z",
          "conflict_title": "Practice Session"
        }
      ]
    }
  ],
  "message": "Event created with scheduling conflicts. Participants have been notified."
}
```

**Response (Success no conflicts):**
```json
{
  "success": true,
  "event": { ... },
  "conflicts": null,
  "message": "Event created successfully"
}
```

**Default Durations by Type:**
- match: 120 minutes
- lesson: 60 minutes
- tournament: 240 minutes
- practice: 90 minutes

---

## 2. Scheduling Assistant

**Endpoint:** `POST /scheduling-assistant`

**Description:** Analyzes participant availability and suggests optimal meeting times.

**Request Body:**
```json
{
  "participants": ["user-uuid-1", "user-uuid-2"],
  "start_date": "2025-10-18",
  "end_date": "2025-10-25",
  "desired_duration": 120,
  "preferred_times": [
    {
      "day_of_week": 1,
      "start_hour": 18,
      "end_hour": 22
    }
  ]
}
```

**Parameters:**
- `participants` - Array of user UUIDs (current user automatically included)
- `start_date` - Search start date (YYYY-MM-DD)
- `end_date` - Search end date (YYYY-MM-DD)
- `desired_duration` - Event duration in minutes
- `preferred_times` - Optional array of preferred time windows
  - `day_of_week` - 0 (Sunday) to 6 (Saturday)
  - `start_hour` - Hour in 24-hour format (0-23)
  - `end_hour` - Hour in 24-hour format (0-23)

**Response:**
```json
{
  "success": true,
  "participants": [
    {
      "user_id": "user-uuid",
      "user_name": "John Doe",
      "busy_blocks": [
        {
          "start": "2025-10-18T14:00:00Z",
          "end": "2025-10-18T16:00:00Z"
        }
      ]
    }
  ],
  "suggestions": [
    {
      "start": "2025-10-19T18:00:00Z",
      "end": "2025-10-19T20:00:00Z"
    },
    {
      "start": "2025-10-20T19:00:00Z",
      "end": "2025-10-20T21:00:00Z"
    }
  ],
  "message": "Found 10 available time slots"
}
```

**No Availability Response:**
```json
{
  "success": true,
  "participants": [...],
  "suggestions": [],
  "message": "No common availability found for all participants"
}
```

**Algorithm:**
- Checks every 30-minute slot within search period
- Default search hours: 6:00 - 22:00 (24-hour format)
- Respects preferred times if specified
- Returns top 10 suggestions
- Considers existing events and blocked availability

---

## 3. Event Search

**Endpoint:** `GET /event-search`

**Description:** Full-text search across events with filtering and pagination.

**Query Parameters:**
- `q` - Search query (searches name, description, location)
- `type` - Filter by event_type (match, lesson, tournament, practice)
- `status` - Filter by status
- `start_date` - Filter events starting from this date
- `end_date` - Filter events ending before this date
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)

**Example Request:**
```
GET /event-search?q=tennis&type=match&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "events": [
    {
      "id": "event-uuid",
      "event_name": "Tennis Match",
      "event_type": "match",
      "start_time_utc": "2025-10-18T14:00:00Z",
      "end_time_utc": "2025-10-18T16:00:00Z",
      "location_name": "Central Court",
      "status": "scheduled",
      "creator": {
        "id": "user-uuid",
        "first_name": "John",
        "last_name": "Doe",
        "profile_picture_url": "..."
      },
      "participants": [
        {
          "user_id": "user-uuid",
          "rsvp_status": "accepted",
          "availability_status": "available",
          "user": {
            "first_name": "Jane",
            "last_name": "Smith",
            "profile_picture_url": "..."
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

**Privacy Filtering:**
Events are automatically filtered based on:
- User is creator
- User is participant
- Event is public
- Event is friends-only and users are friends

---

## 4. Update Event RSVP

**Endpoint:** `POST /update-event-rsvp`

**Description:** Update participant response to event invitation with optional time proposal.

**Request Body:**
```json
{
  "event_id": "event-uuid",
  "rsvp_status": "accepted",
  "proposed_time_start": "2025-10-19T15:00:00Z",
  "proposed_time_end": "2025-10-19T17:00:00Z",
  "notes": "Can we move it an hour later?"
}
```

**Parameters:**
- `event_id` - Required
- `rsvp_status` - Required: invited, accepted, declined, tentative
- `proposed_time_start` - Optional alternative start time
- `proposed_time_end` - Optional alternative end time
- `notes` - Optional participant notes

**Response:**
```json
{
  "success": true,
  "participant": {
    "id": "participant-uuid",
    "event_id": "event-uuid",
    "user_id": "user-uuid",
    "rsvp_status": "accepted",
    "responded_at": "2025-10-18T10:30:00Z",
    ...
  },
  "message": "RSVP updated to accepted"
}
```

**Auto-Status Updates:**
- When all participants accept → Event status changes to 'confirmed'
- Event creator receives notification of each RSVP
- If time proposed → Notifies creator with proposed times

---

## 5. Send Event Reminders (System Function)

**Endpoint:** `POST /send-event-reminders`

**Description:** Background job to send event reminders. Should be triggered by cron job.

**Authentication:** Uses `SUPABASE_SERVICE_ROLE_KEY` (system function)

**Request:** No body required

**Response:**
```json
{
  "success": true,
  "sent_count": 15,
  "failed_count": 2,
  "failed_reminder_ids": ["reminder-uuid-1", "reminder-uuid-2"],
  "message": "Sent 15 reminders, 2 failed"
}
```

**Behavior:**
- Processes up to 100 reminders per execution
- Sends single reminder per event per user
- Uses 24-hour time format in notifications
- Marks reminders as sent after successful delivery
- Logs failures for retry

**Notification Format:**
```
Title: "Upcoming match: Singles Match"
Message: "Your match 'Singles Match' starts at Oct 18 at 14:00 at Central Tennis Club"
```

**Recommended Cron Schedule:**
```
*/5 * * * *  (Every 5 minutes)
```

---

## 🔄 Event Lifecycle

### 1. Creation Flow
```
User creates event
  ↓
System checks conflicts for all participants
  ↓
Status: scheduled (no conflicts) OR pending_conflict (has conflicts)
  ↓
Participants receive invitations
  ↓
Reminders scheduled based on reminder_offset_minutes
```

### 2. RSVP Flow
```
Participant receives invitation (status: invited)
  ↓
Participant responds:
  - Accept → status: accepted
  - Decline → status: declined
  - Tentative → status: tentative (can propose new time)
  ↓
If all accept → Event status: confirmed
  ↓
Creator receives notification of each response
```

### 3. Conflict Resolution Flow
```
Event created with conflicts (status: pending_conflict)
  ↓
Participants notified of conflicts
  ↓
Options:
  1. Accept anyway → status: confirmed
  2. Propose new time → Creator receives proposal
  3. Decline → status: declined
```

### 4. Reminder Flow
```
Event created/updated
  ↓
Trigger: schedule_event_reminders()
  ↓
Reminders inserted into event_reminders_queue
  ↓
Cron job runs send-event-reminders
  ↓
Due reminders sent as notifications
  ↓
Marked as sent with timestamp
```

---

## 📅 Recurring Events

### Recurrence Rule Format
```json
{
  "repeat": "weekly",
  "interval": 1,
  "until": "2025-12-31",
  "by_day": ["MO", "WE", "FR"]
}
```

**Supported Patterns:**
- `daily` - Every day
- `weekly` - Every week
- `biweekly` - Every 2 weeks
- `monthly` - Every month

**Implementation:**
- Parent event stored with `is_recurring = true`
- Child instances reference `recurrence_parent_id`
- Can edit single instance or all future instances
- Deletion of parent cascades to children

---

## ⏰ Time Format Standards

### Critical Requirements:
1. **All timestamps stored in UTC**
2. **24-hour (military) time format**
3. **ISO 8601 format** for all API responses
4. **Never use locale-based time formatting**

### Examples:
```
✅ Correct: "2025-10-18T14:00:00Z"
✅ Correct: "Oct 18 at 14:00"
❌ Wrong: "2025-10-18T2:00:00PM"
❌ Wrong: "Oct 18 at 2:00 PM"
```

---

## 🔔 Notification Types

### Event Notifications:
- `event_invitation` - New event invitation
- `event_accepted` - Participant accepted
- `event_declined` - Participant declined
- `event_rsvp` - General RSVP update
- `event_reminder` - Scheduled reminder
- `event_updated` - Event details changed
- `event_cancelled` - Event cancelled

### Format:
```json
{
  "type": "event_invitation",
  "title": "Event Invitation",
  "message": "John Doe invited you to 'Singles Match' on Oct 18 at 14:00",
  "action_url": "/dashboard?tab=schedule",
  "metadata": {
    "event_id": "event-uuid",
    "creator_id": "user-uuid"
  }
}
```

---

## 🎯 Best Practices

### For Frontend Integration:

1. **Always include timezone context**
   ```typescript
   const eventTime = new Date(event.start_time_utc)
   // Display in user's local timezone
   ```

2. **Conflict Detection**
   ```typescript
   // Always check conflicts before finalizing
   const response = await fetch('/create-event', {
     body: JSON.stringify({ ...eventData, check_conflicts: true })
   })
   ```

3. **Availability Checking**
   ```typescript
   // Use scheduling assistant before suggesting times
   const suggestions = await fetchSchedulingAssistant({
     participants,
     start_date,
     end_date
   })
   ```

4. **Error Handling**
   ```typescript
   try {
     await createEvent(data)
   } catch (error) {
     if (error.conflicts) {
       // Show conflict UI
     }
   }
   ```

### For Backend Operations:

1. **Always use service role key for system functions**
2. **Batch process reminders (100 at a time)**
3. **Index frequently queried fields**
4. **Use RLS policies for all data access**
5. **Log all notification deliveries**

---

## 🚀 Deployment Checklist

- [ ] All edge functions deployed
- [ ] Database migrations run
- [ ] RLS policies verified
- [ ] Cron job configured for reminders
- [ ] Search indexes created
- [ ] Service role key secured
- [ ] CORS headers configured
- [ ] Error logging enabled
- [ ] Notification system tested

---

## 📞 Support & Documentation

For issues or questions:
1. Check Supabase Edge Function logs
2. Review RLS policy documentation
3. Verify authentication headers
4. Test with Postman/Insomnia

**Edge Function Logs:**
```
https://supabase.com/dashboard/project/<project-id>/functions/<function-name>/logs
```
