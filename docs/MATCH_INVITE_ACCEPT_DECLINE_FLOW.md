# Match Invite Accept/Decline Flow - Complete Implementation

## Overview
This document describes the complete flow for accepting and declining match invites, ensuring both users (sender and receiver) see the updated status in real-time.

## Database Changes

### Migration: `20260117030000_fix_match_invite_notifications.sql`

**What it does**:
- Enhances the `notify_match_invite()` trigger function
- Adds notifications for **declined** invites (previously missing)
- Adds notifications for **cancelled** invites
- Ensures both sender and receiver get proper notifications

**Notification Types**:
1. **New Invite** (INSERT) → Notifies receiver
2. **Accepted** (UPDATE: pending → accepted) → Notifies sender
3. **Declined** (UPDATE: pending → declined) → Notifies sender ✨ NEW
4. **Cancelled** (UPDATE: * → cancelled) → Notifies the other party ✨ NEW

## Frontend Changes

### Enhanced Real-time Subscription in `useMatchInvites.ts`

**Previous Behavior**:
- Only handled INSERT events (new invites)
- Sender had no real-time feedback when invite was accepted/declined

**New Behavior**:
- Handles both INSERT and UPDATE events
- Sender receives instant notification when receiver responds
- Both users' invite lists refresh automatically

**Implementation**:

```typescript
// Handle invite status changes (UPDATE)
if (payload.eventType === 'UPDATE') {
  const oldInvite = payload.old as any;
  const updatedInvite = payload.new as any;
  
  // Check if status changed
  if (oldInvite.status !== updatedInvite.status) {
    // If current user is the sender, notify them of receiver's response
    if (updatedInvite.sender_id === user.id) {
      const receiverName = await getReceiverName(updatedInvite.receiver_id);
      
      if (updatedInvite.status === 'accepted') {
        toast.success(`${receiverName} accepted your match invite!`);
        sendNotification('Match Invite Accepted', {
          body: message,
          clickUrl: '/dashboard?tab=schedule',
        });
      } else if (updatedInvite.status === 'declined') {
        toast.info(`${receiverName} declined your match invite`);
        sendNotification('Match Invite Declined', {
          body: message,
          clickUrl: '/dashboard?tab=schedule',
        });
      }
    }
  }
}

// Always refresh invites list for both users
fetchInvites();
```

## Complete Flow Diagram

### Scenario 1: Accept Invite

```
RECEIVER SIDE                          DATABASE                           SENDER SIDE
     │                                     │                                    │
     │  1. Clicks "Accept"                 │                                    │
     │─────────────────────────────────────>│                                    │
     │                                     │                                    │
     │  2. Confirmation dialog             │                                    │
     │     "Accept Match Invitation?"      │                                    │
     │                                     │                                    │
     │  3. Confirms                        │                                    │
     │─────────────────────────────────────>│                                    │
     │                                     │                                    │
     │                                     │  4. UPDATE match_invites           │
     │                                     │     SET status = 'accepted'        │
     │                                     │     SET response_at = NOW()        │
     │                                     │                                    │
     │                                     │  5. Trigger fires:                 │
     │                                     │     notify_match_invite()          │
     │                                     │                                    │
     │                                     │  6. Create notification            │
     │                                     │     for sender                     │
     │                                     │─────────────────────────────────────>│
     │                                     │                                    │
     │  7. Real-time UPDATE event          │  8. Real-time UPDATE event         │
     │<─────────────────────────────────────│─────────────────────────────────────>│
     │                                     │                                    │
     │  9. fetchInvites()                  │  10. fetchInvites()                │
     │     - Invite removed from           │      - Invite status updated       │
     │       pending list                  │      - Shows as "accepted"         │
     │     - Added to scheduled            │                                    │
     │       matches                       │                                    │
     │                                     │  11. Toast notification:           │
     │  12. Toast: "Match invitation       │      "[Name] accepted your         │
     │      accepted!"                     │      match invite!"                │
     │                                     │                                    │
     │                                     │  12. Browser notification          │
     │                                     │      (if enabled)                  │
     │                                     │                                    │
     │  13. Conversation created           │  13. Match added to                │
     │      between both users             │      scheduled matches             │
     │                                     │                                    │
```

### Scenario 2: Decline Invite

```
RECEIVER SIDE                          DATABASE                           SENDER SIDE
     │                                     │                                    │
     │  1. Clicks "Decline"                │                                    │
     │─────────────────────────────────────>│                                    │
     │                                     │                                    │
     │  2. Confirmation dialog             │                                    │
     │     "Decline Match Invitation?"     │                                    │
     │                                     │                                    │
     │  3. Confirms                        │                                    │
     │─────────────────────────────────────>│                                    │
     │                                     │                                    │
     │                                     │  4. UPDATE match_invites           │
     │                                     │     SET status = 'declined'        │
     │                                     │     SET response_at = NOW()        │
     │                                     │                                    │
     │                                     │  5. Trigger fires:                 │
     │                                     │     notify_match_invite()          │
     │                                     │                                    │
     │                                     │  6. Create notification ✨ NEW     │
     │                                     │     for sender                     │
     │                                     │─────────────────────────────────────>│
     │                                     │                                    │
     │  7. Real-time UPDATE event          │  8. Real-time UPDATE event ✨ NEW  │
     │<─────────────────────────────────────│─────────────────────────────────────>│
     │                                     │                                    │
     │  9. fetchInvites()                  │  10. fetchInvites() ✨ NEW         │
     │     - Invite removed from           │      - Invite status updated       │
     │       pending list                  │      - Shows as "declined"         │
     │                                     │                                    │
     │  10. Toast: "Match invitation       │  11. Toast notification: ✨ NEW    │
     │       declined"                     │      "[Name] declined your         │
     │                                     │      match invite"                 │
     │                                     │                                    │
     │                                     │  12. Browser notification ✨ NEW   │
     │                                     │      (if enabled)                  │
     │                                     │                                    │
```

## Key Improvements

### 1. Database Level
✅ **Added declined notification trigger**
- Previously: Only accepted invites triggered sender notification
- Now: Both accepted AND declined invites notify sender

✅ **Added cancelled notification trigger**
- Notifies the other party when a match is cancelled
- Includes cancellation reason in notification

### 2. Real-time Subscription Level
✅ **Handle UPDATE events**
- Previously: Only INSERT events (new invites)
- Now: Both INSERT and UPDATE events

✅ **Sender receives instant feedback**
- Toast notification when invite is accepted/declined
- Browser notification (if enabled)
- Automatic list refresh

✅ **Both users see updates simultaneously**
- No need to refresh page
- Status changes appear instantly

### 3. User Experience Level
✅ **Clear visual feedback**
- Receiver: Confirmation dialog before responding
- Sender: Instant notification of response
- Both: Updated invite lists

✅ **Proper status tracking**
- Pending invites show in "Pending Invites" page
- Accepted invites move to "Scheduled Matches"
- Declined invites are removed from both lists
- Sender can see declined status briefly before removal

## Testing Checklist

### Test 1: Accept Invite
- [ ] User A sends invite to User B
- [ ] User B receives notification (browser + toast)
- [ ] User B sees invite in Pending Invites page
- [ ] User B clicks "Accept"
- [ ] Confirmation dialog appears
- [ ] User B confirms acceptance
- [ ] User B sees success toast
- [ ] User A receives notification (browser + toast) ✨
- [ ] User A's invite list updates to show "accepted" ✨
- [ ] Match appears in both users' Scheduled Matches
- [ ] Conversation created between users

### Test 2: Decline Invite
- [ ] User A sends invite to User B
- [ ] User B receives notification
- [ ] User B sees invite in Pending Invites page
- [ ] User B clicks "Decline"
- [ ] Confirmation dialog appears
- [ ] User B confirms decline
- [ ] User B sees success toast
- [ ] User A receives notification (browser + toast) ✨ NEW
- [ ] User A's invite list updates to show "declined" ✨ NEW
- [ ] Invite removed from both users' pending lists
- [ ] No match created

### Test 3: Real-time Updates
- [ ] User A and User B both have app open
- [ ] User A sends invite
- [ ] User B sees invite appear without refresh
- [ ] User B accepts invite
- [ ] User A sees status change without refresh ✨ NEW
- [ ] Both users see match in Scheduled Matches without refresh

### Test 4: Offline/Online Scenarios
- [ ] User A sends invite while User B is offline
- [ ] User B comes online and sees invite
- [ ] User B accepts while User A is offline
- [ ] User A comes online and sees accepted status ✨ NEW
- [ ] Database notification created for User A ✨ NEW

## Database Queries for Verification

### Check invite status
```sql
SELECT 
  id,
  sender_id,
  receiver_id,
  status,
  response_at,
  created_at,
  updated_at
FROM match_invites
WHERE id = 'invite-id-here';
```

### Check notifications created
```sql
SELECT 
  user_id,
  type,
  title,
  message,
  created_at
FROM notifications
WHERE metadata->>'invite_id' = 'invite-id-here'
ORDER BY created_at DESC;
```

### Check both users can see the invite
```sql
-- As sender
SELECT * FROM match_invites WHERE sender_id = 'user-a-id';

-- As receiver
SELECT * FROM match_invites WHERE receiver_id = 'user-b-id';
```

## Troubleshooting

### Issue: Sender not receiving notification
**Check**:
1. Database trigger is installed: `\df notify_match_invite`
2. Trigger is attached: `\d match_invites`
3. Notification was created: Query notifications table
4. Real-time subscription is active: Check browser console

### Issue: Status not updating in real-time
**Check**:
1. Supabase Realtime is enabled for match_invites table
2. RLS policies allow both users to SELECT the invite
3. Browser console for subscription errors
4. Network tab for realtime connection

### Issue: Both users can't update the invite
**Check**:
1. RLS policy allows both sender and receiver to UPDATE
2. Migration `20251111174932` was applied
3. Policy name: "Users can update invites they sent or received"

## Summary

The accept/decline functionality now works correctly with:

✅ **Database notifications** for both accepted and declined invites
✅ **Real-time updates** for both sender and receiver
✅ **Visual feedback** through toasts and browser notifications
✅ **Automatic list refresh** without page reload
✅ **Proper status tracking** across all views
✅ **Security** through RLS policies allowing both parties to view/update

Both users will see the invite status change in real-time, and the sender will be immediately notified when their invite is accepted or declined.
