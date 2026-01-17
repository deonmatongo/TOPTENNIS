# My Leagues ↔ My Schedule Integration

## Overview
The My Leagues tab is now fully integrated with My Schedule, allowing seamless navigation and context passing when scheduling matches with league opponents.

## Integration Flow

### 1. From My Leagues → My Schedule

**Entry Points:**
- **Division Standings**: Click "Schedule" button next to any opponent's name
- **Match List**: Click "Reschedule" button on scheduled matches

**What Happens:**
1. User clicks schedule button with opponent context
2. Dashboard passes opponent info (`id` and `name`) to Schedule tab
3. Schedule tab auto-navigates to Available Slots page
4. Available Slots page displays opponent name in header banner
5. User can add availability to schedule match with that specific opponent

### 2. Visual Indicators

**In My Schedule Dashboard:**
- Orange banner appears at top showing "Ready to schedule with [Opponent Name]"
- Call-to-action button to add availability
- Clear messaging about next steps

**In Available Slots Page:**
- Orange badge in header showing "Scheduling match with [Opponent Name]"
- Context persists while user manages their availability

### 3. Navigation Back
- Clicking back button clears the opponent context
- Returns to Schedule dashboard in clean state

## Technical Implementation

### Components Modified

#### 1. Dashboard.tsx
```typescript
// Added state for selected opponent
const [selectedOpponent, setSelectedOpponent] = useState<{id?: string, name?: string} | null>(null);

// My Leagues navigation handler
onNavigateToSchedule={(opponentId, opponentName) => {
  setSelectedOpponent({ id: opponentId, name: opponentName });
  setActiveTab('schedule');
}}

// Schedule tab receives opponent context
<ScheduleTab 
  preSelectedOpponent={selectedOpponent}
  onClearOpponent={() => setSelectedOpponent(null)}
/>
```

#### 2. ScheduleTab.tsx
```typescript
// Accepts opponent context
interface ScheduleTabProps {
  preSelectedOpponent?: {id?: string, name?: string} | null;
  onClearOpponent?: () => void;
}

// Auto-navigates to slots when opponent is selected
useEffect(() => {
  if (preSelectedOpponent && preSelectedOpponent.name) {
    setCurrentView('slots');
  }
}, [preSelectedOpponent]);

// Clears context on back navigation
const handleBack = () => {
  setCurrentView('dashboard');
  if (onClearOpponent) {
    onClearOpponent();
  }
};
```

#### 3. ScheduleDashboard.tsx
```typescript
// Displays prominent banner when opponent is pre-selected
{preSelectedOpponent && preSelectedOpponent.name && (
  <Card className="border-orange-500 bg-orange-50">
    <CardContent>
      <h3>Ready to schedule with {preSelectedOpponent.name}</h3>
      <p>Add your availability below to find a time that works for both of you</p>
      <Button onClick={() => onNavigate('slots')}>
        Add Availability
      </Button>
    </CardContent>
  </Card>
)}
```

#### 4. AvailableSlotsPage.tsx
```typescript
// Shows opponent context in header
{preSelectedOpponent && preSelectedOpponent.name && (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-100 rounded-full">
    <Calendar className="h-4 w-4" />
    <span>Scheduling match with {preSelectedOpponent.name}</span>
  </div>
)}
```

#### 5. EnhancedMyLeaguesTab.tsx
```typescript
// Division standings now include Schedule buttons
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

## User Experience Flow

### Scenario: Scheduling a match with a division opponent

1. **User navigates to My Leagues tab**
   - Views their active leagues
   - Clicks on a league to see details

2. **User views Division Standings**
   - Sees list of players in their division
   - Each opponent has a "Schedule" button

3. **User clicks "Schedule" next to "Sarah Chen"**
   - Automatically navigated to My Schedule tab
   - Orange banner shows: "Ready to schedule with Sarah Chen"
   - Context is clear and actionable

4. **User clicks "Add Availability"**
   - Taken to Available Slots page
   - Header shows: "Scheduling match with Sarah Chen"
   - User adds their available time slots

5. **Next Steps (Future Enhancement)**
   - System can match user's availability with Sarah's
   - Send match invite with proposed times
   - Complete the scheduling workflow

## Benefits

✅ **Seamless Navigation**: No manual searching for opponents
✅ **Context Preservation**: Opponent info carries through the flow
✅ **Clear Visual Feedback**: Orange banners and badges show active scheduling context
✅ **Intuitive UX**: Natural flow from league standings to scheduling
✅ **Flexible**: Works from multiple entry points (standings, matches, etc.)

## Future Enhancements

1. **Auto-match availability**: Automatically show overlapping time slots
2. **Direct invite**: Send match invite directly from the flow
3. **Match history**: Show previous matches with selected opponent
4. **Preferred venues**: Suggest courts based on both players' preferences
5. **Smart scheduling**: AI-powered time suggestions based on patterns
