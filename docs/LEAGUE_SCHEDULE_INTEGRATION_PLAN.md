# League-Schedule Integration Plan

## Overview
Connect the league system with the schedule system so users with the same skill level compete within their division, and all league matches are managed through the schedule interface.

## Current State Analysis

### Existing Tables
1. **league_registrations** - User registrations for leagues
2. **divisions** - Skill-based groups within leagues
3. **division_assignments** - Maps users to divisions
4. **match_invites** - General match invitation system
5. **user_availability** - User availability slots

### Existing Functionality
- ✅ Skill-based division assignment (assign_player_to_division RPC)
- ✅ Division matching by skill_level, competitiveness, age_range, gender_preference
- ✅ Schedule calendar view (CalendarScheduleView)
- ✅ Match invite system
- ✅ Availability management

### Gaps Identified
- ❌ No dedicated league_matches table
- ❌ League matches not shown in schedule calendar
- ❌ No direct navigation from league to schedule with context
- ❌ Schedule buttons in league UI don't connect to schedule
- ❌ No way to filter schedule by league/division

## Implementation Strategy

### Phase 1: Database Schema Enhancement

#### 1.1 Create league_matches Table
```sql
CREATE TABLE public.league_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID REFERENCES public.divisions(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES auth.users(id),
  player2_id UUID NOT NULL REFERENCES public.profiles(id),
  match_invite_id UUID REFERENCES public.match_invites(id),
  scheduled_date DATE,
  scheduled_time TIME,
  status TEXT DEFAULT 'pending', -- pending, scheduled, completed, cancelled
  court_location TEXT,
  match_number INTEGER,
  round_number INTEGER,
  is_playoff BOOLEAN DEFAULT false,
  winner_id UUID,
  score JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 1.2 Add league_context to match_invites
```sql
ALTER TABLE public.match_invites 
ADD COLUMN IF NOT EXISTS league_match_id UUID REFERENCES public.league_matches(id),
ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES public.divisions(id),
ADD COLUMN IF NOT EXISTS is_league_match BOOLEAN DEFAULT false;
```

### Phase 2: Backend Integration

#### 2.1 Create useLeagueMatches Hook
- Fetch league matches for user's divisions
- Subscribe to real-time updates
- Provide scheduling functions
- Return matches grouped by status

#### 2.2 Enhance useMatchInvites Hook
- Add league context filtering
- Identify league vs casual matches
- Link to league_matches table

#### 2.3 Create useDivisionOpponents Hook
- Fetch opponents in same division
- Filter by skill level match
- Provide opponent details for scheduling

### Phase 3: UI Integration

#### 3.1 Update CalendarScheduleView
- Show league matches alongside regular matches
- Add league badge/indicator
- Display division name
- Different color coding for league matches
- Filter toggle for league/casual matches

#### 3.2 Update EnhancedMyLeaguesTab
- Add "Schedule Match" buttons that navigate to schedule
- Pass division context to schedule
- Pre-select opponent from division
- Show upcoming league matches
- Link to schedule for match details

#### 3.3 Create LeagueMatchScheduler Component
- Modal for scheduling league matches
- Shows available opponents in division
- Integrates with availability system
- Creates both league_match and match_invite

### Phase 4: Navigation & Context

#### 4.1 Schedule Navigation with Context
```typescript
interface ScheduleContext {
  source: 'league' | 'casual';
  divisionId?: string;
  opponentId?: string;
  opponentName?: string;
  leagueMatchId?: string;
}
```

#### 4.2 URL Parameters
- `/schedule?source=league&divisionId=xxx&opponentId=yyy`
- Preserve context across navigation
- Auto-filter based on context

### Phase 5: Skill-Based Grouping Verification

#### 5.1 Test Division Assignment
- Verify same skill level → same division
- Test max_players limit
- Test division creation logic
- Verify competitiveness matching

#### 5.2 Test Match Scheduling
- Verify only division members can schedule
- Test match invite creation
- Verify calendar display

## Implementation Order

1. **Database Migration** (league_matches table + match_invites updates)
2. **useLeagueMatches Hook** (data fetching)
3. **useDivisionOpponents Hook** (opponent list)
4. **CalendarScheduleView Updates** (display league matches)
5. **EnhancedMyLeaguesTab Updates** (schedule buttons)
6. **Navigation Integration** (context passing)
7. **Testing** (end-to-end flow)
8. **Documentation** (user guide)

## Success Criteria

✅ Users in same division can see each other
✅ "Schedule Match" button navigates to schedule with opponent pre-selected
✅ League matches appear in calendar with league badge
✅ Can filter schedule by league/casual matches
✅ Match invites link to league matches
✅ Real-time updates work for league matches
✅ Skill-based grouping works correctly
✅ All scheduling flows through schedule interface

## Technical Considerations

### Performance
- Index on division_id, player1_id, player2_id
- Efficient queries for division members
- Real-time subscription optimization

### Security
- RLS policies for league_matches
- Verify division membership before scheduling
- Prevent cross-division scheduling

### UX
- Clear visual distinction between league and casual matches
- Easy navigation between league and schedule
- Context preservation across pages
- Mobile-responsive design

## Timeline Estimate
- Phase 1: 30 minutes (database)
- Phase 2: 45 minutes (hooks)
- Phase 3: 60 minutes (UI)
- Phase 4: 30 minutes (navigation)
- Phase 5: 30 minutes (testing)
- **Total: ~3 hours**
