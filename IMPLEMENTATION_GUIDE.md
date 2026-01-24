# League Match Scoring System - Implementation Guide

## Overview
This system implements a comprehensive tennis match scoring system with:
- ✅ Proper tennis scoring validation (sets, games, tiebreaks)
- ✅ Winner reports score, opponent confirms
- ✅ Dispute resolution mechanism
- ✅ Automatic leaderboard calculations
- ✅ Playoff qualification tracking
- ✅ Fair play enforcement

---

## Step 1: Run SQL Migration

**File:** `LEAGUE_SCORING_SYSTEM.sql`

1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `LEAGUE_SCORING_SYSTEM.sql`
3. Run the script
4. Verify no errors

### What This Does:
- Adds scoring columns to `league_matches` table
- Creates validation functions for tennis scores
- Creates `submit_league_match_score()` function
- Creates `confirm_league_match_score()` function
- Creates `dispute_league_match_score()` function
- Creates `calculate_division_leaderboard()` function
- Creates `get_playoff_qualifiers()` function
- Sets up proper RLS policies

---

## Step 2: Update TypeScript Types

After running the SQL, regenerate your Supabase types:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

This will add the new RPC functions to your TypeScript types and fix the lint errors.

---

## Step 3: Components Already Created

### ✅ MatchScoringModal.tsx (Updated)
- Located: `src/components/dashboard/MatchScoringModal.tsx`
- Uses `submit_league_match_score()` RPC function
- Validates tennis scores
- Notifies opponent to confirm

### ✅ ScoreConfirmationModal.tsx (New)
- Located: `src/components/dashboard/ScoreConfirmationModal.tsx`
- Allows opponent to confirm or dispute scores
- Shows match result summary
- Handles dispute submission

---

## Step 4: Integrate Components

### In EnhancedMyLeaguesTab.tsx:

```typescript
import ScoreConfirmationModal from './ScoreConfirmationModal';

// Add state
const [confirmingMatch, setConfirmingMatch] = useState<any>(null);

// Add handler for matches requiring confirmation
const matchesRequiringConfirmation = matches.filter(
  m => m.status === 'completed' && 
       !m.confirmed_by_opponent && 
       m.reported_by_user_id !== user?.id
);

// Show badge/notification for pending confirmations
{matchesRequiringConfirmation.length > 0 && (
  <Badge variant="destructive">
    {matchesRequiringConfirmation.length} score(s) to confirm
  </Badge>
)}

// Add modal
<ScoreConfirmationModal
  open={!!confirmingMatch}
  onOpenChange={(open) => !open && setConfirmingMatch(null)}
  match={confirmingMatch}
  userId={user?.id || ''}
  onConfirmed={() => {
    // Refresh matches
    refetchMatches();
  }}
/>
```

---

## Step 5: Update Leaderboard Display

### Use the new leaderboard function:

```typescript
const { data: leaderboard } = await supabase
  .rpc('calculate_division_leaderboard', {
    p_division_id: divisionId
  });

// Display columns:
- Rank
- Player Name
- Matches Played
- Wins / Losses
- Sets Won / Lost
- Games Won / Lost
- Win %
- Points (3 per win)
```

---

## Step 6: Add Playoff Qualification Display

```typescript
const { data: qualifiers } = await supabase
  .rpc('get_playoff_qualifiers', {
    p_division_id: divisionId,
    p_num_qualifiers: 4 // Top 4 qualify
  });

// Show which players qualify for playoffs
qualifiers.forEach(player => {
  if (player.qualifies) {
    // Show playoff badge
  }
});
```

---

## How It Works

### 1. Match Completion Flow

```
Player 1 completes match
    ↓
Opens MatchScoringModal
    ↓
Enters score (sets, games, tiebreak)
    ↓
Submits → submit_league_match_score()
    ↓
Validates tennis scoring rules
    ↓
Saves score to database
    ↓
Sends notification to Player 2
    ↓
Player 2 receives notification
    ↓
Opens ScoreConfirmationModal
    ↓
Reviews score
    ↓
Confirms OR Disputes
    ↓
If Confirmed: Leaderboard updates
If Disputed: Admin review required
```

### 2. Tennis Score Validation

The system validates:
- ✅ Sets must be won 6-4, 6-3, 7-5, or 7-6
- ✅ Winner must win at least 2 sets
- ✅ Scores must be between 0-7 games
- ✅ Tiebreak scores must be valid (7+ points, win by 2)
- ✅ Winner ID must match the set winners

### 3. Leaderboard Calculation

**Points System:**
- Win = 3 points
- Loss = 0 points

**Ranking Order:**
1. Total Points (highest first)
2. Match Wins (most first)
3. Sets Won (most first)
4. Games Won (most first)

**Stats Tracked:**
- Matches Played/Won/Lost
- Sets Won/Lost
- Games Won/Lost
- Win Percentage
- Rank

### 4. Fair Play Enforcement

**Score Confirmation:**
- Winner reports score
- Opponent must confirm
- Leaderboard only updates after confirmation

**Dispute Resolution:**
- Opponent can dispute with reason
- Match status reverts to "in_progress"
- Admin notified for review
- Both players notified

**Prevents:**
- False score reporting
- Unilateral score changes
- Unfair leaderboard manipulation

---

## Testing Checklist

### ✅ Score Submission
- [ ] Can submit valid tennis scores
- [ ] Cannot submit invalid scores (e.g., 8-5)
- [ ] Cannot submit without winner selection
- [ ] Opponent receives notification

### ✅ Score Confirmation
- [ ] Opponent can view reported score
- [ ] Can confirm correct scores
- [ ] Can dispute incorrect scores
- [ ] Leaderboard updates after confirmation

### ✅ Leaderboard
- [ ] Shows all active players
- [ ] Calculates wins/losses correctly
- [ ] Calculates sets/games correctly
- [ ] Ranks players by points → wins → sets → games
- [ ] Updates in real-time after confirmation

### ✅ Playoffs
- [ ] Identifies top 4 qualifiers
- [ ] Shows qualification status
- [ ] Updates as matches complete

---

## Database Functions Reference

### submit_league_match_score()
```sql
Parameters:
- p_match_id: UUID
- p_winner_id: UUID
- p_set1_p1, p_set1_p2: INTEGER
- p_set2_p1, p_set2_p2: INTEGER
- p_set3_p1, p_set3_p2: INTEGER (optional)
- p_tiebreak_p1, p_tiebreak_p2: INTEGER (optional)
- p_reported_by: UUID

Returns: UUID (match_id)
```

### confirm_league_match_score()
```sql
Parameters:
- p_match_id: UUID
- p_confirming_user_id: UUID

Returns: BOOLEAN
```

### dispute_league_match_score()
```sql
Parameters:
- p_match_id: UUID
- p_disputing_user_id: UUID
- p_dispute_reason: TEXT

Returns: BOOLEAN
```

### calculate_division_leaderboard()
```sql
Parameters:
- p_division_id: UUID

Returns: TABLE with player stats and rankings
```

### get_playoff_qualifiers()
```sql
Parameters:
- p_division_id: UUID
- p_num_qualifiers: INTEGER (default 4)

Returns: TABLE with qualified players
```

---

## Next Steps

1. ✅ Run `LEAGUE_SCORING_SYSTEM.sql` in Supabase
2. ✅ Regenerate TypeScript types
3. ⏳ Integrate ScoreConfirmationModal in EnhancedMyLeaguesTab
4. ⏳ Update leaderboard display to use new function
5. ⏳ Add playoff qualification indicators
6. ⏳ Test complete flow with real users

---

## Support & Fair Play

**For Disputes:**
- Admin can view disputed matches
- Admin can manually update scores if needed
- Both players are notified of resolution

**Fair Play Rules:**
- Only match players can report/confirm scores
- Cannot confirm your own reported score
- Scores must follow tennis rules
- False reporting may result in penalties

---

**Questions?** Check the SQL file for detailed function documentation.
