-- Add booking_status field to user_availability table
-- This will track whether a slot is available, booked, or pending booking

ALTER TABLE user_availability 
ADD COLUMN booking_status TEXT DEFAULT 'available' 
CHECK (booking_status IN ('available', 'booked', 'pending'));

-- Create an index on booking_status for better query performance
CREATE INDEX idx_user_availability_booking_status ON user_availability(booking_status);

-- Create a composite index for efficient slot availability queries
CREATE INDEX idx_user_availability_slot_lookup ON user_availability(user_id, date, booking_status, is_available, is_blocked);

-- Update existing records to have the correct booking status
UPDATE user_availability 
SET booking_status = 'available' 
WHERE booking_status IS NULL 
AND is_available = true 
AND is_blocked = false;

-- Set booked status for slots that are already associated with accepted invites
UPDATE user_availability 
SET booking_status = 'booked' 
WHERE id IN (
  SELECT DISTINCT availability_id 
  FROM match_invites 
  WHERE status = 'accepted' 
  AND availability_id IS NOT NULL
);

COMMENT ON COLUMN user_availability.booking_status IS 'Tracks the booking status of a time slot: available, booked, or pending';
