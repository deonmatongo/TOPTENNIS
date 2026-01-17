# My Schedule - Comprehensive Technical Guide

## Table of Contents
1. [Overview](#overview)
2. [Database Architecture](#database-architecture)
3. [Component Structure](#component-structure)
4. [Data Flow](#data-flow)
5. [Features & Functionality](#features--functionality)
6. [Integration with My Leagues](#integration-with-my-leagues)
7. [User Journeys](#user-journeys)
8. [Advanced Features](#advanced-features)

---

## Overview

**My Schedule** is a comprehensive scheduling and match coordination system that enables tennis players to:
- Manage their availability with timezone support
- Send and receive match invitations
- View scheduled and confirmed matches
- Respond to pending invites
- Coordinate match times with opponents
- Track upcoming and past matches
- Seamlessly schedule with league opponents

The system acts as the **central hub** for all match coordination, bridging the gap between finding opponents (via My Leagues/Matching) and actually playing matches.

---

## Database Architecture

### Core Tables

#### 1. `user_availability`
Stores when users are available to play tennis.

```sql
- id: UUID (Primary Key)
- user_id: UUID (References auth.users)
- date: DATE (When available)
- start_time: TIME (Availability start)
- end_time: TIME (Availability end)
- is_available: BOOLEAN (Default: true)
- is_blocked: BOOLEAN (Default: false, for blocking time)
- notes: TEXT (Optional notes about availability)
- privacy_level: TEXT ('public', 'private', 'division-only')
- recurrence_rule: TEXT (For recurring availability)
- timezone: TEXT (User's timezone, e.g., 'America/New_York')
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**Purpose**: Allows players to broadcast when they're free to play, enabling smart match scheduling.

**Privacy Levels**:
- **public**: Visible to all players
- **private**: Only visible to user
- **division-only**: Only visible to division members (league integration)

#### 2. `match_invites`
Stores match invitation requests between players.

```sql
- id: UUID (Primary Key)
- sender_id: UUID (References auth.users - who sent invite)
- receiver_id: UUID (References auth.users - who receives invite)
- availability_id: UUID (Optional reference to user_availability)
- date: DATE (Original proposed match date)
- start_time: TIME (Original proposed start time)
- end_time: TIME (Original proposed end time)
- proposed_date: DATE (Counter-proposed date, if any)
- proposed_start_time: TIME (Counter-proposed start time)
- proposed_end_time: TIME (Counter-proposed end time)
- proposed_by_user_id: UUID (Who made the counter-proposal)
- proposed_at: TIMESTAMP (When counter-proposal was made)
- court_location: TEXT (Where to play)
- message: TEXT (Optional message from sender)
- status: TEXT ('pending', 'accepted', 'declined', 'cancelled')
- response_at: TIMESTAMP (When receiver responded)
- cancelled_at: TIMESTAMP (When cancelled, if applicable)
- cancelled_by_user_id: UUID (Who cancelled)
- cancellation_reason: TEXT (Why cancelled)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**Purpose**: Manages the entire match invitation lifecycle from proposal to confirmation or cancellation.

**Status Flow**:
```
pending → accepted (Match confirmed)
pending → declined (Invitation rejected)
pending → proposed (Counter-proposal made) → pending
accepted → cancelled (Match cancelled after confirmation)
```

### Key Features

#### Timezone Support
- Each availability slot stores the user's timezone
- Times are converted between timezones for cross-timezone scheduling
- Display shows both original and converted times
- Prevents scheduling confusion for players in different locations

#### Real-time Updates
Both tables have real-time subscriptions via Supabase:
- Instant notification when someone sends you an invite
- Live updates when availability changes
- Automatic refresh of match lists

#### Security (Row Level Security)
- Users can only view/edit their own availability
- Division members can view each other's availability (if privacy_level allows)
- Both parties in an invite can view/modify it
- Prevents unauthorized access to scheduling data

---

## Component Structure

### Main Components

#### 1. `ScheduleTab.tsx`
**Location**: `/src/components/dashboard/ScheduleTab.tsx`

Main orchestrator component with view management.

**State Management**:
```typescript
const [currentView, setCurrentView] = useState<
  'dashboard' | 'slots' | 'matches' | 'invites'
>('dashboard');
```

**Props**:
```typescript
interface ScheduleTabProps {
  player?: Tables<'players'> | null;
  matches?: Match[];
  matchesLoading?: boolean;
  preSelectedOpponent?: {id?: string, name?: string} | null;
  onClearOpponent?: () => void;
}
```

**View Routing**:
- `dashboard` → ScheduleDashboard (overview)
- `slots` → AvailableSlotsPage (manage availability)
- `matches` → ScheduledMatchesPage (view matches)
- `invites` → PendingInvitesPage (respond to invites)

**League Integration**:
- Accepts `preSelectedOpponent` from My Leagues
- Auto-navigates to slots view when opponent is selected
- Clears opponent context on back navigation

#### 2. `ScheduleDashboard.tsx`
**Location**: `/src/components/schedule/ScheduleDashboard.tsx`

Overview page showing summary cards and quick actions.

**Key Features**:
- **3 Summary Cards**:
  1. Available Slots (count + next slot preview)
  2. Scheduled Matches (count + next match preview)
  3. Pending Invites (count + action required badge)
- **Pre-selected Opponent Banner** (when coming from My Leagues)
- **Quick Actions Section** (shortcuts to each view)

**Data Sources**:
```typescript
const { availability } = useUserAvailability();
const { invites, getPendingInvites, getConfirmedInvites } = useMatchInvites();
```

**Smart Filtering**:
- Only shows future slots/matches
- Sorts by date (earliest first)
- Highlights urgent actions (pending invites)

#### 3. `AvailableSlotsPage.tsx`
**Location**: `/src/components/schedule/AvailableSlotsPage.tsx`

Full-featured availability management interface.

**Features**:
- **Week Calendar View**: Visual week selector with slot indicators
- **Day Detail View**: All slots for selected day
- **Next 7 Days Summary**: Quick overview of upcoming availability
- **Timezone Selector**: Convert times between timezones
- **Add/Edit/Delete Slots**: Full CRUD operations
- **Recurring Availability**: Set repeating time slots
- **Privacy Controls**: Public/private/division-only settings

**Props**:
```typescript
interface AvailableSlotsPageProps {
  onBack: () => void;
  preSelectedOpponent?: {id?: string, name?: string} | null;
}
```

**Visual Indicators**:
- Orange badge when scheduling with specific opponent
- Timezone conversion toggle for each slot
- Color-coded privacy levels
- Dots on calendar days with availability

#### 4. `ScheduledMatchesPage.tsx`
**Location**: `/src/components/schedule/ScheduledMatchesPage.tsx`

View all confirmed matches (upcoming and past).

**Features**:
- **Two Sections**:
  1. Upcoming Matches (sorted chronologically)
  2. Past Matches (sorted reverse chronologically)
- **Match Cards** showing:
  - Opponent avatar and name
  - Date, time, location
  - Status badge (Upcoming/Completed)
  - Message preview
- **Match Details Modal**: Full information on click
- **Empty States**: Helpful messages when no matches

**Data Processing**:
```typescript
const confirmedMatches = getConfirmedInvites()
  .filter(invite => invite.status === 'accepted');

const upcomingMatches = confirmedMatches
  .filter(match => isFuture(parseISO(match.proposed_date)))
  .sort((a, b) => new Date(a.proposed_date) - new Date(b.proposed_date));
```

#### 5. `PendingInvitesPage.tsx`
**Location**: `/src/components/schedule/PendingInvitesPage.tsx`

Respond to match invitations from other players.

**Features**:
- **Alert Banner**: Shows count of pending invites
- **Invite Cards** with:
  - Sender information and avatar
  - Proposed date, time, location
  - Personal message from sender
  - Timestamp (when sent)
  - Accept/Decline buttons
- **Confirmation Dialogs**: Prevent accidental responses
- **Empty State**: "All caught up!" when no pending invites

**Actions**:
```typescript
const handleRespond = (inviteId: string, action: 'accept' | 'decline') => {
  // Shows confirmation dialog
  setRespondingTo(inviteId);
  setActionType(action);
};

const confirmResponse = async () => {
  await respondToInvite(respondingTo, actionType);
  // Updates database, sends notifications
};
```

**Notifications**:
- Toast notification on response
- Browser notification to sender
- Real-time update for both parties

### Custom Hooks

#### 1. `useUserAvailability()`
**Location**: `/src/hooks/useUserAvailability.ts`

Manages user availability data and operations.

**Returns**:
```typescript
{
  availability: UserAvailability[],
  loading: boolean,
  createAvailability: (data) => Promise<UserAvailability>,
  updateAvailability: (id, updates) => Promise<UserAvailability>,
  deleteAvailability: (id) => Promise<void>,
  fetchAvailability: () => Promise<void>
}
```

**Key Functions**:

**createAvailability()**:
- Validates date/time is not in the past
- Inserts into database
- Updates local state immediately
- Sends real-time notification
- Shows success toast

**updateAvailability()**:
- Updates specific slot
- Maintains sort order
- Notifies connected users

**deleteAvailability()**:
- Removes slot from database
- Updates UI instantly
- Notifies if slot was shared

**Real-time Subscription**:
```typescript
const unsubscribe = subscribeToUserChanges((payload) => {
  if (payload.table === 'user_availability') {
    fetchAvailability(); // Refresh data
  }
});
```

#### 2. `useMatchInvites()`
**Location**: `/src/hooks/useMatchInvites.ts`

Manages match invitation lifecycle.

**Returns**:
```typescript
{
  invites: MatchInvite[],
  loading: boolean,
  sendInvite: (data) => Promise<MatchInvite>,
  respondToInvite: (id, status) => Promise<void>,
  proposeNewTime: (id, date, start, end) => Promise<void>,
  acceptProposedTime: (id) => Promise<void>,
  cancelInvite: (id, reason?) => Promise<void>,
  getPendingInvites: () => MatchInvite[],
  getSentInvites: () => MatchInvite[],
  getConfirmedInvites: () => MatchInvite[],
  isSlotBooked: (date, start, end, userId?) => boolean,
  refetch: () => Promise<void>
}
```

**Key Functions**:

**sendInvite()**:
```typescript
const sendInvite = async (inviteData: {
  receiver_id: string;
  availability_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  court_location?: string;
  message?: string;
}) => {
  // Creates invite in database
  // Sends real-time notification to receiver
  // Shows browser notification
  // Returns created invite
}
```

**respondToInvite()**:
```typescript
const respondToInvite = async (
  inviteId: string, 
  status: 'accepted' | 'declined'
) => {
  // Verifies user is receiver
  // Updates invite status
  // Records response timestamp
  // If accepted, creates conversation
  // Notifies sender
  // Refreshes invite list
}
```

**proposeNewTime()** (Counter-proposal):
```typescript
const proposeNewTime = async (
  inviteId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
) => {
  // Stores proposed time in separate fields
  // Marks who proposed it
  // Sets status back to 'pending'
  // Notifies original sender
}
```

**acceptProposedTime()**:
```typescript
const acceptProposedTime = async (inviteId: string) => {
  // Moves proposed time to actual time
  // Clears proposal fields
  // Sets status to 'accepted'
  // Confirms match
}
```

**Helper Functions**:
- `getPendingInvites()`: Filters invites where user is receiver and status is pending
- `getSentInvites()`: Filters invites where user is sender
- `getConfirmedInvites()`: Filters accepted invites
- `isSlotBooked()`: Checks if a time slot conflicts with existing matches

**Real-time Features**:
```typescript
// Listens for new invites
if (payload.eventType === 'INSERT') {
  const newInvite = payload.new;
  if (newInvite.receiver_id === user.id) {
    // Show toast notification
    toast.info(`New match invite from ${senderName}!`);
    
    // Send browser notification
    sendNotification('New Match Invite', {
      body: message,
      clickUrl: '/dashboard?tab=matching'
    });
  }
}
```

---

## Data Flow

### Flow 1: Adding Availability

```
User clicks "Add Availability"
    ↓
EnhancedAvailabilityModal opens
    ↓
User selects:
  - Date
  - Start time
  - End time
  - Privacy level (public/private/division-only)
  - Optional: Court location, notes, recurrence
    ↓
User clicks "Save"
    ↓
useUserAvailability.createAvailability()
    ↓
Validation:
  - Check date/time not in past
  - Validate time range (end > start)
    ↓
Insert into user_availability table
    ↓
Real-time notification sent to:
  - Division members (if division-only)
  - All users (if public)
    ↓
UI updates immediately
    ↓
Success toast shown
    ↓
Slot appears in calendar and list views
```

### Flow 2: Sending Match Invite

```
User finds opponent (via My Leagues or Matching)
    ↓
Clicks "Schedule Match" or "Send Invite"
    ↓
System shows opponent's available slots
    ↓
User selects a slot or proposes custom time
    ↓
User adds optional message and court location
    ↓
useMatchInvites.sendInvite()
    ↓
Insert into match_invites table:
  - sender_id: current user
  - receiver_id: opponent
  - date, start_time, end_time
  - court_location, message
  - status: 'pending'
    ↓
Real-time notification triggers
    ↓
Receiver sees:
  - Browser notification (if enabled)
  - Toast notification (if app open)
  - Badge on Pending Invites card
    ↓
Sender sees success toast
    ↓
Invite appears in receiver's Pending Invites
```

### Flow 3: Responding to Invite

```
Receiver navigates to My Schedule → Pending Invites
    ↓
Sees invite card with all details
    ↓
Clicks "Accept" or "Decline"
    ↓
Confirmation dialog appears
    ↓
User confirms action
    ↓
useMatchInvites.respondToInvite(id, status)
    ↓
Update match_invites:
  - status: 'accepted' or 'declined'
  - response_at: current timestamp
    ↓
If ACCEPTED:
  - Create conversation between players
  - Add to Scheduled Matches
  - Block time slot for both players
    ↓
If DECLINED:
  - Notify sender
  - Remove from pending list
    ↓
Real-time notification to sender
    ↓
UI updates for both users
    ↓
Success toast shown
```

### Flow 4: League Integration Flow

```
User in My Leagues → Division Standings
    ↓
Clicks "Schedule" next to opponent name
    ↓
Dashboard.onNavigateToSchedule(opponentId, opponentName)
    ↓
Dashboard sets state:
  - selectedOpponent: { id, name }
  - activeTab: 'schedule'
    ↓
ScheduleTab receives preSelectedOpponent prop
    ↓
useEffect triggers:
  - Auto-navigates to 'slots' view
    ↓
AvailableSlotsPage renders with:
  - Orange banner: "Scheduling match with [Opponent Name]"
  - Opponent context preserved
    ↓
User adds availability
    ↓
System can now:
  - Match availability with opponent
  - Send invite with context
  - Complete scheduling workflow
    ↓
User clicks back
    ↓
onClearOpponent() called
    ↓
Context cleared, returns to dashboard
```

---

## Features & Functionality

### 1. Availability Management

#### Week Calendar View
**Visual Features**:
- 7-day week grid (Sunday-Saturday)
- Current day highlighted with border
- Selected day highlighted with primary color
- Dots indicate days with availability
- Smooth navigation (previous/next week)
- "Today" quick jump button

**Interaction**:
- Click any day to view its slots
- Hover shows preview
- Responsive design (mobile-friendly)

#### Day Detail View
**Shows**:
- All slots for selected day
- Start/end times
- Privacy level badge
- Timezone indicator
- Notes (if any)
- Edit/Delete buttons on hover

**Actions**:
- Click slot to edit
- Hover to see action buttons
- Delete with confirmation
- Quick timezone conversion

#### Next 7 Days Summary
**Purpose**: Quick overview of upcoming availability

**Features**:
- Grouped by date
- Expandable/collapsible
- Shows slot count per day
- Quick edit/delete access
- Scroll to specific day

#### Timezone Management
**Features**:
- Dropdown selector with common timezones
- Auto-detect user's timezone
- Convert times on-the-fly
- Show both original and converted times
- Prevent scheduling confusion

**Example**:
```
Original: 2:00 PM - 4:00 PM EST
Converted: 11:00 AM - 1:00 PM PST
```

**Toggle Button**:
- "Show in EST" / "Convert to PST"
- Per-slot conversion
- Remembers preference

#### Privacy Levels

**Public**:
- Visible to all players
- Appears in global availability search
- Anyone can send invite for this slot

**Private**:
- Only visible to user
- Not shown to others
- User can still send invites manually

**Division-Only**:
- Visible only to division members
- Enables league-specific scheduling
- Balances privacy and coordination

### 2. Match Invitations

#### Sending Invites

**From Available Slots**:
```
User views opponent's availability
    ↓
Clicks on opponent's available slot
    ↓
"Send Invite" button appears
    ↓
Modal opens with pre-filled time
    ↓
User adds message and court location
    ↓
Clicks "Send Invite"
```

**From Custom Time**:
```
User clicks "Propose Custom Time"
    ↓
Date/time picker opens
    ↓
User selects preferred time
    ↓
Adds message and location
    ↓
Sends invite
```

**Invite Data**:
- Proposed date and time
- Court location (optional)
- Personal message (optional)
- Reference to availability slot (if applicable)

#### Receiving Invites

**Notification Flow**:
1. **Real-time**: Instant notification when invite arrives
2. **Browser**: Desktop notification (if enabled)
3. **In-app**: Toast message (if app is open)
4. **Badge**: Red badge on Pending Invites card

**Invite Card Information**:
- Sender's name and avatar
- Proposed date and time
- Court location
- Personal message
- Time since sent
- Accept/Decline buttons

**Response Options**:
1. **Accept**: Confirm the match
2. **Decline**: Reject the invitation
3. **Propose New Time**: Counter-proposal (future feature)

#### Counter-Proposals

**Scenario**: Receiver can't make proposed time but wants to play

**Flow**:
```
Receiver views invite
    ↓
Clicks "Propose New Time"
    ↓
Selects alternative date/time
    ↓
Adds optional message
    ↓
Submits counter-proposal
    ↓
Original sender receives notification
    ↓
Sender can accept or propose another time
    ↓
Continues until both agree
```

**Database State**:
```typescript
{
  date: "2024-01-20",           // Original proposal
  start_time: "14:00",
  end_time: "16:00",
  proposed_date: "2024-01-21",  // Counter-proposal
  proposed_start_time: "15:00",
  proposed_end_time: "17:00",
  proposed_by_user_id: "receiver-id",
  status: "pending"
}
```

### 3. Scheduled Matches View

#### Upcoming Matches Section

**Display**:
- Chronologically sorted (earliest first)
- Match cards with full details
- Countdown to match (future enhancement)
- Quick actions (reschedule, cancel)

**Match Card Contents**:
- Opponent avatar and name
- Date and time
- Court location
- Status: "Upcoming"
- Original message
- Click for full details

#### Past Matches Section

**Display**:
- Reverse chronological (most recent first)
- Grayed out styling
- Status: "Completed"
- Link to score entry (if not entered)

**Purpose**:
- Match history reference
- Verify past commitments
- Track playing frequency

#### Match Details Modal

**Triggered by**: Clicking any match card

**Shows**:
- Large opponent avatar
- Full opponent profile info
- Complete date/time details
- Court location with map link (future)
- Full message thread
- Match status
- Action buttons (Cancel, Reschedule, etc.)

### 4. Pending Invites Management

#### Alert System

**Visual Hierarchy**:
1. **Red badge** on tab/card (most urgent)
2. **Orange banner** at top of page
3. **Action Required** badge on each invite

**Alert Banner**:
```
⚠️ Action Required
You have 3 pending invitations waiting for your response
```

#### Invite Prioritization

**Sort Order**:
1. Oldest invites first (prevent forgetting)
2. Invites with soonest proposed dates
3. Invites from division members (league priority)

**Visual Distinction**:
- Orange border for pending invites
- Green border for accepted (in transition)
- Red border for declined (briefly shown)

#### Response Actions

**Accept Flow**:
```
Click "Accept"
    ↓
Confirmation dialog:
  "Accept Match Invitation?"
  "This match will be added to your schedule"
    ↓
Click "Accept" to confirm
    ↓
Database updated
    ↓
Conversation created
    ↓
Both users notified
    ↓
Match appears in Scheduled Matches
```

**Decline Flow**:
```
Click "Decline"
    ↓
Confirmation dialog:
  "Decline Match Invitation?"
  "The inviter will be notified"
    ↓
Click "Decline" to confirm
    ↓
Database updated
    ↓
Sender notified
    ↓
Invite removed from list
```

### 5. Quick Actions Section

**Purpose**: Shortcuts to common tasks

**Actions Available**:

1. **Add Availability**
   - Icon: Calendar
   - Description: "Set when you're free to play"
   - Shows current timezone
   - Direct link to AvailableSlotsPage

2. **View Matches**
   - Icon: CalendarCheck
   - Description: "See your upcoming games"
   - Direct link to ScheduledMatchesPage

3. **Check Invites**
   - Icon: Mail
   - Description: "Respond to match requests"
   - Shows pending count badge
   - Direct link to PendingInvitesPage

**Design**:
- Large clickable cards
- Icon + text layout
- Hover effects
- Responsive grid (3 columns desktop, 1 column mobile)

---

## Integration with My Leagues

### Connection Points

#### 1. Schedule Button in Division Standings

**Location**: My Leagues → League Details → Division Standings Tab

**Implementation**:
```typescript
{!player.isCurrentUser && (
  <Button
    size="sm"
    onClick={() => handleScheduleMatch(player.user_id, player.name)}
    className="bg-orange-500 hover:bg-orange-600 text-white"
  >
    <Calendar className="w-4 h-4 mr-1" />
    Schedule
  </Button>
)}
```

**Behavior**:
- Appears next to each opponent in standings
- Not shown for current user
- Orange color for visibility
- Passes opponent ID and name

#### 2. Reschedule Button in Match List

**Location**: My Leagues → League Details → Matches Tab

**Implementation**:
```typescript
{isScheduled && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => handleScheduleMatch(
      match.userIsPlayer1 ? match.player2_id : match.player1_id,
      match.opponent_name
    )}
  >
    Reschedule
  </Button>
)}
```

**Behavior**:
- Only shown for scheduled matches
- Allows changing match time
- Maintains opponent context

#### 3. Schedule a Match Button (League Overview)

**Location**: My Leagues → League Card

**Implementation**:
```typescript
<Button 
  onClick={() => handleLeagueClick(league)}
  className="bg-orange-500 hover:bg-orange-600 text-white"
>
  Schedule a Match
</Button>
```

**Behavior**:
- Opens league details view
- User can then select specific opponent
- Streamlined workflow

### Data Flow with League Integration

```
MY LEAGUES                          MY SCHEDULE
    ↓                                   ↓
Division Standings              ScheduleDashboard
    ↓                                   ↓
Click "Schedule"                Orange Banner:
next to opponent          "Ready to schedule with Sarah Chen"
    ↓                                   ↓
handleScheduleMatch()           Auto-navigate to
    ↓                           AvailableSlotsPage
onNavigateToSchedule()                  ↓
    ↓                           Orange Badge:
Dashboard State Update      "Scheduling match with Sarah Chen"
    ↓                                   ↓
selectedOpponent set                User adds
activeTab = 'schedule'              availability
    ↓                                   ↓
ScheduleTab receives            System can now:
preSelectedOpponent prop        - Match availability
    ↓                           - Send invite
useEffect triggers              - Complete scheduling
    ↓
setCurrentView('slots')
```

### Visual Indicators

#### Orange Banner (ScheduleDashboard)
```typescript
{preSelectedOpponent && preSelectedOpponent.name && (
  <Card className="border-orange-500 bg-orange-50">
    <CardContent className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-full">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-orange-900">
              Ready to schedule with {preSelectedOpponent.name}
            </h3>
            <p className="text-sm text-orange-700">
              Add your availability below to find a time that works
            </p>
          </div>
        </div>
        <Button 
          onClick={() => onNavigate('slots')}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Add Availability
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

#### Orange Badge (AvailableSlotsPage)
```typescript
{preSelectedOpponent && preSelectedOpponent.name && (
  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 
                  bg-orange-100 text-orange-900 rounded-full text-sm font-medium">
    <Calendar className="h-4 w-4" />
    <span>Scheduling match with {preSelectedOpponent.name}</span>
  </div>
)}
```

### Context Clearing

**When to Clear**:
- User clicks back button
- User navigates to different tab
- Match invite is sent
- User manually dismisses

**Implementation**:
```typescript
const handleBack = () => {
  setCurrentView('dashboard');
  if (onClearOpponent) {
    onClearOpponent(); // Clears opponent in Dashboard
  }
};
```

---

## User Journeys

### Journey 1: Setting Up Availability

**Goal**: Make yourself available for matches

```
1. Navigate to My Schedule tab
   - See dashboard with 0 available slots

2. Click "Add Availability" (Quick Actions or Available Slots card)
   - Taken to AvailableSlotsPage

3. Click "Add Availability" button
   - Modal opens with date/time pickers

4. Select availability:
   - Date: Tomorrow
   - Start: 2:00 PM
   - End: 4:00 PM
   - Privacy: Public
   - Location: Central Park Courts
   - Notes: "Prefer singles"

5. Click "Save"
   - Modal closes
   - Slot appears in calendar
   - Success toast: "Availability updated"
   - Slot visible to other players

6. Repeat for multiple days/times
   - Build up availability schedule
   - Enable recurring slots for regular times
```

### Journey 2: Receiving and Accepting an Invite

**Goal**: Respond to a match invitation

```
1. Receive notification
   - Browser notification: "New match invite from Mike Johnson!"
   - Badge appears on Pending Invites card (1)

2. Navigate to My Schedule → Pending Invites
   - See orange alert banner
   - Invite card shows:
     * Mike Johnson's avatar
     * Proposed: Saturday, Jan 20 at 2:00 PM
     * Location: Central Park Courts
     * Message: "Hey! Want to play this weekend?"
     * Sent 5 minutes ago

3. Review details
   - Check calendar for conflicts
   - Verify location is convenient
   - Read message

4. Click "Accept"
   - Confirmation dialog appears
   - "Accept Match Invitation?"
   - "This match will be added to your schedule"

5. Confirm acceptance
   - Click "Accept" in dialog
   - Database updated
   - Success toast: "Match invitation accepted!"
   - Mike receives notification

6. Match appears in Scheduled Matches
   - Navigate to Scheduled Matches
   - See upcoming match with Mike
   - Can view full details
```

### Journey 3: Scheduling with League Opponent

**Goal**: Schedule a match with someone from your division

```
1. Navigate to My Leagues
   - View active league
   - Click on league to see details

2. Go to Division Standings tab
   - See list of division members
   - Current ranking: #3
   - Sarah Chen is #1

3. Click "Schedule" next to Sarah Chen
   - Automatically navigate to My Schedule
   - Orange banner appears:
     "Ready to schedule with Sarah Chen"

4. Click "Add Availability"
   - Taken to Available Slots page
   - Orange badge shows:
     "Scheduling match with Sarah Chen"

5. Add availability
   - Select multiple time slots
   - Set privacy to "division-only"
   - Save slots

6. System matches availability (future feature)
   - Shows overlapping times
   - Suggests best match times
   - User selects preferred time

7. Send invite to Sarah
   - Pre-filled with opponent info
   - Add message: "Looking forward to our match!"
   - Click "Send Invite"

8. Sarah receives and accepts
   - Match confirmed
   - Both players notified
   - Match appears in league matches list
```

### Journey 4: Managing Scheduled Matches

**Goal**: View and manage upcoming matches

```
1. Navigate to My Schedule → Scheduled Matches
   - See 3 upcoming matches

2. View match details
   - Click on match with Sarah Chen
   - Modal shows:
     * Date: Saturday, Jan 20
     * Time: 2:00 PM - 4:00 PM
     * Location: Central Park Courts
     * Message: "Looking forward to our match!"

3. Need to reschedule
   - Click "Reschedule" (future feature)
   - Propose new time
   - Sarah receives notification
   - Can accept or counter-propose

4. Cancel match (if needed)
   - Click "Cancel Match"
   - Provide reason: "Injury - need to rest"
   - Confirm cancellation
   - Sarah notified immediately
   - Match removed from schedule

5. After match is played
   - Match moves to Past Matches section
   - Can enter score (links to My Leagues)
   - Match history preserved
```

### Journey 5: Timezone Coordination

**Goal**: Schedule match with player in different timezone

```
1. User in New York (EST)
   - Sets availability: 2:00 PM - 4:00 PM EST

2. Player in California (PST) views availability
   - Sees slot with timezone indicator
   - Click "Convert to PST"
   - Shows: 11:00 AM - 1:00 PM PST

3. California player sends invite
   - Proposes: 11:00 AM PST
   - System stores both timezones

4. New York player receives invite
   - Sees: 2:00 PM EST (11:00 AM PST)
   - Both times displayed
   - No confusion

5. Match confirmed
   - Each player sees time in their timezone
   - Calendar events created with correct times
   - Reminders sent at appropriate local times
```

---

## Advanced Features

### 1. Smart Availability Matching

**Concept**: Automatically find overlapping availability between players

**Algorithm**:
```typescript
function findMatchingSlots(user1Availability, user2Availability) {
  const matches = [];
  
  for (const slot1 of user1Availability) {
    for (const slot2 of user2Availability) {
      // Same date
      if (slot1.date === slot2.date) {
        // Check for overlap
        const overlapStart = max(slot1.start_time, slot2.start_time);
        const overlapEnd = min(slot1.end_time, slot2.end_time);
        
        if (overlapStart < overlapEnd) {
          // At least 1 hour overlap
          const duration = timeDiff(overlapStart, overlapEnd);
          if (duration >= 60) {
            matches.push({
              date: slot1.date,
              start: overlapStart,
              end: overlapEnd,
              duration,
              user1Slot: slot1,
              user2Slot: slot2
            });
          }
        }
      }
    }
  }
  
  return matches.sort((a, b) => a.date - b.date);
}
```

**UI Display**:
```
Matching Times with Sarah Chen:
✓ Saturday, Jan 20: 2:00 PM - 4:00 PM (2 hours)
✓ Sunday, Jan 21: 10:00 AM - 12:00 PM (2 hours)
✓ Tuesday, Jan 23: 6:00 PM - 7:30 PM (1.5 hours)

[Send Invite for Saturday 2:00 PM]
```

### 2. Recurring Availability

**Use Case**: Players with regular weekly schedules

**Setup**:
```
Add Availability
  ↓
Select "Recurring"
  ↓
Choose pattern:
  - Every week
  - Every 2 weeks
  - Custom (select days of week)
  ↓
Set end date or number of occurrences
  ↓
Creates multiple availability slots
```

**Example**:
```
Recurrence: Every Tuesday and Thursday
Time: 6:00 PM - 8:00 PM
Duration: 8 weeks
Location: Central Park Courts

Creates 16 availability slots automatically
```

**Management**:
- Edit single occurrence
- Edit all future occurrences
- Delete series
- Skip specific dates

### 3. Court Location Integration

**Features**:
- Autocomplete for court names
- Save favorite locations
- Map integration (future)
- Distance calculation
- Court availability checking (future)

**Favorite Locations**:
```typescript
const favoriteLocations = [
  "Central Park Tennis Center",
  "Riverside Park Courts",
  "Brooklyn Bridge Park Courts"
];
```

**Quick Select**:
- Dropdown of favorites
- Recent locations
- Manual entry option

### 4. Notification System

**Notification Types**:

1. **New Invite Received**
   - Browser: "New match invite from Mike Johnson!"
   - Toast: "Mike wants to play Saturday at 2 PM"
   - Email: Detailed invite with accept/decline links

2. **Invite Accepted**
   - Browser: "Sarah accepted your match invite!"
   - Toast: "Match confirmed for Saturday at 2 PM"
   - Calendar: Event added automatically

3. **Invite Declined**
   - Toast: "Mike declined your invite"
   - Option to propose new time

4. **Match Reminder**
   - 24 hours before: "Match tomorrow with Sarah at 2 PM"
   - 1 hour before: "Match starting soon at Central Park"
   - Push notification on mobile

5. **Availability Match Found**
   - "You and Sarah both have availability Saturday at 2 PM"
   - Quick action to send invite

**Notification Settings**:
```typescript
{
  browserNotifications: true,
  emailNotifications: true,
  matchReminders: true,
  reminderTiming: '24h', // 24h, 1h, both
  availabilityMatches: true
}
```

### 5. Calendar Integration

**Export Options**:
- iCal (.ics) file download
- Google Calendar sync
- Outlook integration
- Apple Calendar

**Sync Features**:
- Two-way sync (future)
- Auto-update on changes
- Conflict detection
- Timezone handling

**Calendar Event Format**:
```
Title: Tennis Match vs Sarah Chen
Date: Saturday, January 20, 2024
Time: 2:00 PM - 4:00 PM EST
Location: Central Park Tennis Center
Description: Division match - Spring League 2024
Reminder: 1 hour before
```

### 6. Match History & Analytics

**Statistics Tracked**:
- Total matches played
- Matches per month
- Favorite playing times
- Most played opponents
- Preferred courts
- Average match duration
- Acceptance rate (invites sent vs accepted)
- Response time (how quickly you respond to invites)

**Visualizations**:
- Calendar heatmap (playing frequency)
- Time distribution chart
- Opponent network graph
- Court usage pie chart

**Insights**:
- "You play most often on Saturday afternoons"
- "Your acceptance rate is 85%"
- "You've played 12 matches this month"
- "Central Park is your most frequent court"

### 7. Conflict Detection

**Scenarios**:

1. **Double Booking**:
   ```
   Warning: You already have a match at 2:00 PM on Saturday
   Existing: vs Mike Johnson at Central Park
   New: vs Sarah Chen at Riverside Park
   
   [Cancel Existing] [Choose Different Time]
   ```

2. **Availability Conflict**:
   ```
   Notice: This time overlaps with your blocked time
   Blocked: 2:00 PM - 3:00 PM (Personal appointment)
   Invite: 1:00 PM - 3:00 PM
   
   [Update Availability] [Decline Invite]
   ```

3. **Travel Time Warning**:
   ```
   Warning: Tight schedule detected
   Previous match ends: 12:00 PM at Central Park
   Next match starts: 1:00 PM at Riverside Park
   Travel time: ~30 minutes
   
   [Proceed Anyway] [Reschedule]
   ```

### 8. Group Scheduling (Future)

**Use Case**: Doubles matches or group clinics

**Features**:
- Invite multiple players
- Require all to accept
- Show combined availability
- Coordinate 4-player schedules

**Flow**:
```
Create Group Match
  ↓
Add players:
  - Player 1 (Partner)
  - Player 2 (Opponent 1)
  - Player 3 (Opponent 2)
  ↓
System finds common availability
  ↓
Send group invite
  ↓
All must accept
  ↓
Match confirmed when all accepted
```

---

## Technical Implementation Details

### State Management

**Component-level State**:
```typescript
// ScheduleTab
const [currentView, setCurrentView] = useState('dashboard');

// AvailableSlotsPage
const [currentDate, setCurrentDate] = useState(new Date());
const [showAddModal, setShowAddModal] = useState(false);
const [selectedDate, setSelectedDate] = useState<Date | null>(null);

// PendingInvitesPage
const [respondingTo, setRespondingTo] = useState<string | null>(null);
const [actionType, setActionType] = useState<'accept' | 'decline' | null>(null);
```

**Custom Hooks for Data**:
```typescript
const { availability, loading, createAvailability } = useUserAvailability();
const { invites, sendInvite, respondToInvite } = useMatchInvites();
```

### Real-time Subscriptions

**Supabase Realtime**:
```typescript
// Subscribe to availability changes
const channel = supabase
  .channel('user-availability-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'user_availability',
    filter: `user_id=eq.${user.id}`
  }, (payload) => {
    fetchAvailability();
  })
  .subscribe();

// Subscribe to invite changes
const channel = supabase
  .channel('match-invites-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'match_invites',
    filter: `receiver_id=eq.${user.id}`
  }, (payload) => {
    if (payload.eventType === 'INSERT') {
      showNotification(payload.new);
    }
    fetchInvites();
  })
  .subscribe();
```

### Performance Optimizations

1. **Lazy Loading**:
   - Only fetch data for current view
   - Paginate past matches
   - Limit initial data load

2. **Caching**:
   - Cache availability data
   - Invalidate on changes
   - Optimistic updates

3. **Debouncing**:
   - Timezone conversion calculations
   - Search/filter operations
   - Auto-save drafts

4. **Memoization**:
   ```typescript
   const sortedSlots = useMemo(() => {
     return availability.sort((a, b) => 
       new Date(a.date).getTime() - new Date(b.date).getTime()
     );
   }, [availability]);
   ```

### Error Handling

**Validation**:
```typescript
// Past date check
if (availDate < now) {
  toast.error('Cannot create availability for past dates');
  throw new Error('Past date not allowed');
}

// Time range check
if (endTime <= startTime) {
  toast.error('End time must be after start time');
  throw new Error('Invalid time range');
}

// Conflict check
if (isSlotBooked(date, startTime, endTime)) {
  toast.error('This time slot is already booked');
  throw new Error('Slot conflict');
}
```

**Network Errors**:
```typescript
try {
  await sendInvite(data);
} catch (error) {
  if (error.code === 'PGRST116') {
    toast.error('Opponent not found');
  } else if (error.message.includes('network')) {
    toast.error('Network error. Please check your connection');
  } else {
    toast.error('Failed to send invite. Please try again');
  }
  logger.error('Send invite error', { error, data });
}
```

### Security

**Row Level Security Policies**:
```sql
-- Users can only view their own availability
CREATE POLICY "Users can view own availability"
ON user_availability FOR SELECT
USING (auth.uid() = user_id);

-- Division members can view each other's availability
CREATE POLICY "Division members can view availability"
ON user_availability FOR SELECT
USING (
  privacy_level = 'division-only' AND
  EXISTS (
    SELECT 1 FROM division_assignments da1
    JOIN division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.user_id = user_availability.user_id
    AND da2.user_id = auth.uid()
  )
);

-- Both parties can view match invites
CREATE POLICY "Invite parties can view"
ON match_invites FOR SELECT
USING (
  auth.uid() = sender_id OR
  auth.uid() = receiver_id
);
```

---

## Summary

**My Schedule** is a comprehensive scheduling system that:

✅ **Manages Availability** with timezone support and privacy controls
✅ **Facilitates Match Invitations** with real-time notifications
✅ **Tracks Scheduled Matches** with upcoming and past views
✅ **Handles Pending Invites** with accept/decline/counter-propose
✅ **Integrates with My Leagues** for seamless opponent scheduling
✅ **Provides Real-time Updates** via Supabase subscriptions
✅ **Ensures Security** with row-level policies
✅ **Offers Rich UI** with multiple views and visual indicators

The system serves as the **central coordination hub** for all tennis matches, bridging the gap between finding opponents and actually playing, while maintaining flexibility, security, and user-friendly interfaces throughout the entire scheduling lifecycle.
