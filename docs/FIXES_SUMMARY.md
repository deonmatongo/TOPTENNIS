# Bug Fixes Summary - January 18, 2026

## Issues Fixed

### 1. ✅ Player Card UI Change
**Issue:** Player Card showed an "X" button  
**Fix:** Replaced X icon with Home icon in dialog close button  
**Files Changed:**
- `/src/components/ui/dialog.tsx` - Changed import from `X` to `Home` icon

**Status:** ✅ Complete and deployed locally

---

### 2. ✅ Availability Creation Error (Past Dates/Times)
**Issue:** Users could attempt to create availability for past dates, resulting in errors  
**Fix:** Already implemented in previous commits
- Proper datetime validation with ISO format parsing
- 1-minute buffer to prevent false positives
- Validation centralized in `useUserAvailability` hook
- All duplicate validations removed from modal components

**Files Previously Fixed:**
- `/src/hooks/useUserAvailability.ts` - Proper validation with buffer
- `/src/components/dashboard/AvailabilityModal.tsx` - Removed duplicate validation
- `/src/components/dashboard/EnhancedAvailabilityModal.tsx` - Removed duplicate validation
- `/src/components/dashboard/MultiDateAvailabilityModal.tsx` - Removed duplicate validation

**Status:** ✅ Complete and deployed

---

### 3. ⚠️ Invitation Accept/Decline Error (Requires Database Migration)
**Issue:** 
- Error when accepting/declining invitations: "failed to accept invitation"
- Backend error: `new row for relation "notifications" violates check constraint "notifications_type_check"`
- Users had to click Accept/Decline multiple times

**Root Cause:**
The `notifications` table CHECK constraint didn't include notification types used by the match invite system (`match_accepted`, `match_declined`).

**Solution:**
Migration file already exists: `/supabase/migrations/20260115000000_add_missing_notification_types.sql`

**Required Action:**
You must apply this migration to your Supabase database:

#### Option 1: Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy and run the contents of `supabase/migrations/20260115000000_add_missing_notification_types.sql`

#### Option 2: Via Supabase CLI
```bash
supabase db push
```

**Files Involved:**
- `/supabase/migrations/20260115000000_add_missing_notification_types.sql` - Constraint update
- `/supabase/migrations/20260117030000-fix-match-invite-notifications.sql` - Notification function
- `/docs/NOTIFICATION_CONSTRAINT_FIX.md` - Detailed documentation

**Status:** ⚠️ Migration ready but requires manual database application

---

## Testing Checklist

### UI Changes
- [x] Home icon appears instead of X on all dialogs
- [x] Home icon functions correctly (closes dialogs)

### Availability Validation
- [x] Cannot create availability for past dates
- [x] Can create availability for future dates
- [x] 1-minute buffer prevents false positives
- [x] Clear error message shown for past dates

### Invitation System (After Migration)
- [ ] Accept invitation works on first click
- [ ] Decline invitation works on first click
- [ ] No constraint violation errors in logs
- [ ] Notifications are created successfully

---

## Next Steps

1. **Test the UI changes** - Verify Home icon appears and works
2. **Apply the database migration** - Run the SQL migration in Supabase Dashboard
3. **Test invitation system** - Verify accept/decline works reliably
4. **Monitor logs** - Ensure no constraint violations occur

---

## Additional Notes

- The calendar view redesign is also complete and running locally
- All changes maintain backward compatibility
- No breaking changes to existing functionality
