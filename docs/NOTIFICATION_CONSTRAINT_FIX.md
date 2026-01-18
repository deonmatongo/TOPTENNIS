# Notification Constraint Fix

## Issue
When accepting or declining match invitations, users were experiencing the error:
```
"failed to accept invitation"
new row for relation "notifications" violates check constraint "notifications_type_check"
```

## Root Cause
The `notifications` table has a CHECK constraint that only allows specific notification types. When the `notify_match_invite()` database function tried to create notifications with types like `match_accepted` or `match_declined`, these types were not included in the original constraint.

## Solution

### Database Migration Applied
The migration `20260115000000_add_missing_notification_types.sql` updates the constraint to include all required notification types:

```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'friend_request',
    'message_received', 
    'match_invite',
    'match_confirmed',
    'match_cancelled',
    'match_accepted',      -- Added for accept responses
    'match_declined',      -- Added for decline responses
    'match_rescheduled',
    'booking_confirmed',
    'booking_cancelled',
    'league_update',
    'system_notification'
  ));
```

### Database Function
The `notify_match_invite()` function (in `20260117030000-fix-match-invite-notifications.sql`) creates notifications with these types:
- `match_invite` - When a new invite is sent
- `match_accepted` - When receiver accepts an invite
- `match_declined` - When receiver declines an invite
- `match_cancelled` - When either party cancels

## How to Apply the Fix

### Option 1: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Run the migration file: `supabase/migrations/20260115000000_add_missing_notification_types.sql`
3. Verify by running:
   ```sql
   SELECT constraint_name, check_clause 
   FROM information_schema.check_constraints 
   WHERE constraint_name = 'notifications_type_check';
   ```

### Option 2: Via Supabase CLI
```bash
supabase db push
```

## Verification
After applying the migration:
1. Accept a match invitation
2. Decline a match invitation
3. Both actions should succeed on the first attempt
4. No constraint violation errors should appear in logs

## Related Files
- `/supabase/migrations/20260115000000_add_missing_notification_types.sql` - Constraint update
- `/supabase/migrations/20260117030000-fix-match-invite-notifications.sql` - Notification function
- `/src/hooks/useMatchInvites.ts` - Frontend invitation handling
- `/src/hooks/useNotifications.ts` - Notification type definitions

## Status
✅ **Migration created and ready to apply**
⚠️ **Requires manual application via Supabase Dashboard or CLI**

Once the migration is applied to the database, the accept/decline functionality will work reliably on the first click.
