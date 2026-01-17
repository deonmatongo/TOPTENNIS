# My Leagues - Comprehensive Technical Guide

## Table of Contents
1. [Overview](#overview)
2. [Database Architecture](#database-architecture)
3. [Component Structure](#component-structure)
4. [Data Flow](#data-flow)
5. [Features & Functionality](#features--functionality)
6. [Integration Points](#integration-points)
7. [User Journey](#user-journey)

---

## Overview

**My Leagues** is a comprehensive league management system that allows tennis players to:
- Register for competitive leagues
- Get automatically assigned to skill-matched divisions
- View division standings and leaderboards
- Track matches and performance
- Schedule matches with division opponents
- View playoff brackets and tournament progress
- Access league history

---

## Database Architecture

### Core Tables

#### 1. `league_registrations`
Stores user registrations for leagues.

```sql
- id: UUID (Primary Key)
- user_id: UUID (References auth.users)
- league_id: TEXT (League identifier)
- league_name: TEXT
- status: TEXT ('active', 'inactive', 'completed')
- created_at: TIMESTAMP
```

**Purpose**: Tracks which leagues a user has joined.

#### 2. `divisions`
Organizes players into skill-matched groups within a league.

```sql
- id: UUID (Primary Key)
- league_id: TEXT (Links to league)
- division_name: TEXT (e.g., "Division A", "Division B")
- season: TEXT (Year)
- max_players: INTEGER (Default: 7)
- current_players: INTEGER (Default: 0)
- status: TEXT ('active', 'inactive')
- skill_level_range: TEXT (e.g., "Level 7", "4.0-4.5")
- competitiveness: TEXT ('casual', 'competitive', 'very-competitive')
- age_range: TEXT (e.g., "30-39", "40-49")
- gender_preference: TEXT ('male', 'female', 'mixed', 'no-preference')
- tournament_status: TEXT ('pending', 'active', 'completed')
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**Purpose**: Groups similar players together for fair competition.

#### 3. `division_assignments`
Links users to their divisions.

```sql
- id: UUID (Primary Key)
- user_id: UUID (References auth.users)
- division_id: UUID (References divisions)
- league_registration_id: UUID (References league_registrations)
- assigned_at: TIMESTAMP
- status: TEXT ('active', 'inactive')
- matches_completed: INTEGER (Default: 0)
- matches_required: INTEGER (Default: 5)
- playoff_eligible: BOOLEAN (Default: false)
```

**Purpose**: Tracks player membership in divisions and playoff eligibility.

### Key Database Functions

#### `assign_player_to_division()`
Automatically assigns players to appropriate divisions based on:
- Skill level
- Competitiveness preference
- Age range
- Gender preference

**Algorithm**:
1. Search for existing compatible division with available space
2. If found, assign player to that division
3. If not found, create new division and assign player
4. Update division player count
5. Return division ID

```sql
CREATE OR REPLACE FUNCTION assign_player_to_division(
  p_user_id UUID,
  p_league_registration_id UUID,
  p_league_id TEXT,
  p_skill_level TEXT,
  p_competitiveness TEXT,
  p_age_range TEXT,
  p_gender_preference TEXT
) RETURNS UUID
```

#### `can_view_division_calendar()`
Security function to check if a user can view another user's calendar.

**Logic**: Returns true if both users are in the same active division.

---

## Component Structure

### Main Components

#### 1. `MyLeaguesTab.tsx`
**Location**: `/src/components/dashboard/MyLeaguesTab.tsx`

Simple wrapper component that renders `EnhancedMyLeaguesTab`.

**Props**:
- `player`: Current player object
- `registrations`: Array of league registrations
- `onNavigateToSchedule`: Callback for scheduling navigation

#### 2. `EnhancedMyLeaguesTab.tsx`
**Location**: `/src/components/dashboard/EnhancedMyLeaguesTab.tsx`

Main component with all league functionality.

**State Management**:
```typescript
const [viewState, setViewState] = useState<LeagueViewState>({ 
  view: 'overview' | 'details',
  selectedLeague?: any 
});
const [divisionInfo, setDivisionInfo] = useState<DivisionInfo | null>(null);
const [scoringMatch, setScoringMatch] = useState<any>(null);
const [showHistory, setShowHistory] = useState(false);
```

**Key Features**:
- Two-view system: Overview and Details
- League history toggle
- Match scoring modal
- Division standings with schedule buttons
- League-wide standings
- Playoff bracket visualization

#### 3. `LeagueProgressTable.tsx`
**Location**: `/src/components/dashboard/LeagueProgressTable.tsx`

Displays historical league data in table format.

### Custom Hooks

#### 1. `useLeagueRegistrations()`
**Location**: `/src/hooks/useLeagueRegistrations.ts`

**Purpose**: Manages league registration data and operations.

**Returns**:
```typescript
{
  registrations: LeagueRegistration[],
  loading: boolean,
  error: string | null,
  refetch: () => void,
  registerForLeague: (leagueId, leagueName) => Promise<data>,
  isRegisteredForLeague: (leagueId) => boolean,
  getRegisteredLeagueIds: () => string[]
}
```

**Key Functions**:
- `fetchRegistrations()`: Loads user's league registrations
- `registerForLeague()`: Registers user for a league and auto-assigns to division
- `isRegisteredForLeague()`: Checks if user is in a specific league

#### 2. `useDivisionAssignments()`
**Location**: `/src/hooks/useDivisionAssignments.ts`

**Purpose**: Manages division membership data.

**Returns**:
```typescript
{
  assignments: DivisionAssignment[],
  loading: boolean,
  error: string | null,
  refetch: () => void,
  getDivisionMembers: (divisionId) => Promise<members[]>,
  updateMatchProgress: (assignmentId, matchesCompleted) => Promise<void>
}
```

**Features**:
- Fetches user's division assignments with full division details
- Gets all members of a division
- Updates match completion progress
- Automatically updates playoff eligibility (≥5 matches = eligible)

#### 3. `useDivisionMatches()`
**Location**: `/src/hooks/useDivisionMatches.ts`

**Purpose**: Fetches and manages matches within a division.

**Returns**:
```typescript
{
  matches: DivisionMatch[],
  loading: boolean,
  error: string | null,
  userMatches: DivisionMatch[],
  upcomingMatches: DivisionMatch[],
  recentMatches: DivisionMatch[]
}
```

**Process**:
1. Gets all users in the division
2. Fetches player records for those users
3. Queries matches involving those players
4. Enriches match data with opponent names and results
5. Categorizes matches (user's, upcoming, recent)

**Real-time Updates**: Subscribes to match table changes for live updates.

#### 4. `useDivisionLeaderboard()`
**Location**: `/src/hooks/useDivisionLeaderboard.ts`

**Purpose**: Calculates and maintains division standings.

**Returns**:
```typescript
{
  leaderboard: LeaderboardPlayer[],
  loading: boolean,
  error: string | null,
  currentUser: LeaderboardPlayer | undefined
}
```

**Leaderboard Calculation**:
- **Points**: 3 points per win + bonus for matches completed
- **Ranking**: Sorted by points, then win percentage
- **Stats**: Wins, losses, sets won/lost, playoff eligibility

**Real-time Updates**: Subscribes to both matches and division_assignments changes.

---

## Data Flow

### Registration Flow

```
User clicks "Join League"
    ↓
useLeagueRegistrations.registerForLeague()
    ↓
1. Create league_registration record
    ↓
2. Call assign_player_to_division() function
    ↓
3. Function finds/creates compatible division
    ↓
4. Creates division_assignment record
    ↓
5. Updates division.current_players count
    ↓
User is now in league and division
```

### League Details View Flow

```
User clicks on league card
    ↓
handleLeagueClick(league)
    ↓
setViewState({ view: 'details', selectedLeague: league })
    ↓
useDivisionAssignments finds division_id
    ↓
Parallel data fetching:
  - useDivisionMatches(divisionId) → Matches
  - useDivisionLeaderboard(divisionId) → Standings
  - Fetch division info from Supabase
    ↓
Render 4 tabs:
  1. Matches (with schedule/reschedule buttons)
  2. Division Standings (with schedule buttons)
  3. League Standings (overall rankings)
  4. Playoff Bracket (tournament visualization)
```

### Schedule Integration Flow

```
User clicks "Schedule" button next to opponent
    ↓
handleScheduleMatch(opponentId, opponentName)
    ↓
onNavigateToSchedule(opponentId, opponentName) callback
    ↓
Dashboard sets selectedOpponent state
    ↓
Dashboard switches to 'schedule' tab
    ↓
ScheduleTab receives preSelectedOpponent prop
    ↓
Auto-navigates to AvailableSlotsPage
    ↓
Shows banner: "Scheduling match with [Opponent Name]"
    ↓
User adds availability for that opponent
```

---

## Features & Functionality

### 1. League Overview

**Active Leagues View**:
- Grid of league cards showing:
  - League name
  - Season year
  - Status badge (In Progress/Completed)
  - "Schedule a Match" button
- Quick stats cards:
  - Last Match result
  - Next Match details
  - Season statistics (W-L record, win rate, streak, rank)
- Recent Matches list (last 5 matches with scores)

**League History View**:
- Toggle to view completed leagues
- Historical performance data
- Progress table format

### 2. League Details (4 Tabs)

#### Tab 1: Matches
Shows all division matches with:
- Match date and time
- Opponent name
- Court location
- Match status (Scheduled/Completed)
- Score (if completed)
- Result badge (Win/Loss/Scheduled)
- Home/Away indicator
- Action buttons:
  - "Report Score" (for completed matches without scores)
  - "Reschedule" (for scheduled matches)

**Active Tournament Indicator**:
- Green banner when tournament is active
- Pulsing animation
- Division name display

#### Tab 2: Division Standings
Leaderboard showing:
- Rank (1-7 typically)
- Player name
- Win-Loss record
- Points total
- Playoff eligibility status
- **Schedule button** for each opponent (except yourself)

**Current User Highlighting**:
- Primary color background
- Border accent
- Bold name

#### Tab 3: League Standings
Overall league rankings across all divisions:
- Top 8 players shown
- Division affiliation
- Win-Loss record
- Points
- Playoff status ("Playoff Bound" or "Eliminated")

#### Tab 4: Playoff Bracket
Tournament bracket visualization:
- Semifinals matches
- Championship final
- Championship result
- Trophy icon for winner
- Match scores and dates

### 3. Match Scheduling

**From Division Standings**:
- Click "Schedule" next to any opponent
- Automatically navigates to My Schedule
- Pre-fills opponent information
- Shows context throughout scheduling flow

**From Match List**:
- Click "Reschedule" on existing match
- Same navigation flow as above

### 4. Match Scoring

**Trigger**: Click "Report Score" on completed match

**Modal Features**:
- Set-by-set score entry
- Best of 3 sets format
- Automatic winner determination
- Validation (scores must be valid tennis scores)
- Updates division standings upon submission

### 5. Status Indicators

**League Status Calculation**:
```typescript
const getLeagueStatus = (league) => {
  const monthsAgo = (now - createdAt) / (1000 * 60 * 60 * 24 * 30);
  if (monthsAgo < 3) return 'In Progress';
  return 'Completed';
}
```

**Status Colors**:
- In Progress: Green
- Upcoming: Blue
- Completed: Gray

---

## Integration Points

### 1. My Schedule Integration
**Connected via**: `onNavigateToSchedule` callback

**Flow**:
```
My Leagues → Schedule Button → Dashboard State → My Schedule → Available Slots
```

**Context Passed**:
- Opponent ID
- Opponent Name

**Visual Indicators**:
- Orange banner in Schedule Dashboard
- Orange badge in Available Slots page
- Persistent context until cleared

### 2. Player Profile Integration
**Data Source**: `player` prop from Dashboard

**Used For**:
- Determining skill level for division assignment
- Displaying user stats
- Identifying current user in standings

### 3. Match System Integration
**Tables Used**:
- `matches`: Stores all match data
- Links to `players` table for player info

**Real-time Sync**:
- Subscriptions to match changes
- Automatic leaderboard updates
- Live tournament status

### 4. Authentication Integration
**Via**: `useAuth()` context

**Used For**:
- User identification
- Security policies (RLS)
- Personalized data fetching

---

## User Journey

### Journey 1: Joining a League

1. **Navigate to My Leagues tab**
   - Empty state shows "No active leagues"
   - "Join a League" button displayed

2. **Register for league** (via Register tab)
   - Select league from available options
   - Click "Register"

3. **Automatic division assignment**
   - System analyzes player profile:
     - Skill level (e.g., "Level 7")
     - Competitiveness ("competitive")
     - Age range ("30-39")
     - Gender preference ("no-preference")
   - Finds compatible division or creates new one
   - Assigns player to division

4. **View league details**
   - League card appears in My Leagues
   - Click to see division details
   - View other division members
   - See match schedule

### Journey 2: Scheduling a Match

1. **View division standings**
   - Navigate to My Leagues → Select League → Division Standings tab
   - See list of division opponents

2. **Select opponent**
   - Click "Schedule" button next to opponent name
   - Example: "Schedule" next to "Sarah Chen"

3. **Navigate to scheduling**
   - Automatically taken to My Schedule tab
   - Orange banner: "Ready to schedule with Sarah Chen"
   - Clear call-to-action

4. **Add availability**
   - Click "Add Availability" button
   - Taken to Available Slots page
   - Header shows: "Scheduling match with Sarah Chen"
   - Add time slots when available to play

5. **Complete scheduling** (future enhancement)
   - System matches availability with opponent
   - Send match invite
   - Confirm match details

### Journey 3: Playing and Reporting Matches

1. **Match is scheduled**
   - Appears in "Matches" tab
   - Shows date, time, location
   - Status: "Scheduled"

2. **Play the match**
   - Physical match takes place
   - Players compete

3. **Report score**
   - Return to My Leagues → League Details → Matches tab
   - Click "Report Score" on completed match
   - Enter set scores (e.g., 6-4, 7-5)
   - Submit

4. **Automatic updates**
   - Match status changes to "Completed"
   - Winner determined
   - Division standings updated
   - Points recalculated
   - Playoff eligibility checked

### Journey 4: Tracking Progress

1. **View personal stats**
   - My Leagues overview shows:
     - Current W-L record
     - Win percentage
     - Current streak
     - Division rank

2. **Monitor division standings**
   - See ranking among division peers
   - Track points accumulation
   - Check playoff eligibility (need 5+ matches)

3. **View league-wide rankings**
   - Compare against all league players
   - See top performers across divisions
   - Identify playoff competitors

4. **Follow playoff bracket**
   - Once playoffs start, view bracket
   - See semifinal matchups
   - Track championship progress
   - View final results

### Journey 5: Reviewing History

1. **Toggle to history view**
   - Click "View History" button
   - See all completed leagues

2. **Review past performance**
   - Final standings
   - Match results
   - Season statistics
   - Playoff results

3. **Return to active leagues**
   - Click "Active Leagues" button
   - Back to current competitions

---

## Technical Implementation Details

### State Management Pattern

**Component-level state** for UI:
```typescript
const [viewState, setViewState] = useState({ view: 'overview' });
const [showHistory, setShowHistory] = useState(false);
const [scoringMatch, setScoringMatch] = useState(null);
```

**Custom hooks** for data:
```typescript
const { registrations } = useLeagueRegistrations();
const { assignments } = useDivisionAssignments();
const { matches } = useDivisionMatches(divisionId);
const { leaderboard } = useDivisionLeaderboard(divisionId);
```

### Real-time Updates

**Supabase Realtime Subscriptions**:
```typescript
const channel = supabase
  .channel('division-matches-changes')
  .on('postgres_changes', { table: 'matches' }, () => {
    fetchDivisionMatches();
  })
  .subscribe();
```

**Benefits**:
- Instant leaderboard updates when matches complete
- Live tournament status changes
- Multi-user synchronization

### Security (Row Level Security)

**Division Assignments**:
- Users can view their own assignments
- Division members can view each other's assignments
- Prevents cross-division data leaks

**Calendar Access**:
- `can_view_division_calendar()` function
- Only division members can see each other's availability
- Protects privacy while enabling scheduling

### Performance Optimizations

1. **Conditional data fetching**:
   - Only fetch division data when league is selected
   - Lazy load match and leaderboard data

2. **Memoization**:
   - Calculated values cached in hooks
   - Prevents unnecessary recalculations

3. **Efficient queries**:
   - Join operations in database
   - Single query for related data
   - Indexed foreign keys

### Dummy Data Fallback

**For development/demo**:
```typescript
const dummyRegistrations = [/* ... */];
const allRegistrations = registrations.length > 0 
  ? registrations 
  : dummyRegistrations;
```

**Ensures**:
- Component always renders
- Easy testing without database
- Demo-ready interface

---

## Future Enhancements

### Planned Features

1. **Smart Match Scheduling**
   - AI-powered time suggestions
   - Automatic availability matching
   - Court booking integration

2. **Enhanced Statistics**
   - Head-to-head records
   - Performance trends
   - Shot statistics (if tracked)

3. **Social Features**
   - Division chat/messaging
   - Match comments
   - Photo sharing

4. **Tournament Automation**
   - Automatic bracket generation
   - Seeding based on regular season
   - Playoff scheduling

5. **Multi-league Support**
   - Participate in multiple leagues simultaneously
   - Cross-league rankings
   - League comparison stats

6. **Mobile App**
   - Native iOS/Android apps
   - Push notifications for matches
   - Quick score reporting

---

## Summary

**My Leagues** is a full-featured league management system that:

✅ **Automatically organizes** players into skill-matched divisions
✅ **Tracks performance** with detailed statistics and leaderboards  
✅ **Facilitates scheduling** through seamless integration with My Schedule
✅ **Manages tournaments** with playoff brackets and championship tracking
✅ **Provides real-time updates** via Supabase subscriptions
✅ **Ensures security** with row-level policies and access controls
✅ **Offers rich UI** with multiple views, tabs, and visualizations

The system handles the complete lifecycle from registration through playoffs, making competitive tennis league management effortless and engaging.
