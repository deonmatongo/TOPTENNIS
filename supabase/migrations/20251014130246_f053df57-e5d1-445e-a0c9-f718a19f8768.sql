-- Drop the existing check constraint
ALTER TABLE match_bookings DROP CONSTRAINT IF EXISTS match_bookings_status_check;

-- Add the updated check constraint with all valid statuses
ALTER TABLE match_bookings ADD CONSTRAINT match_bookings_status_check 
CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled'));