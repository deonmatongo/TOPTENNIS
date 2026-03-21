-- Add booking_status field to user_availability table
-- Tracks whether a slot is available, booked, or pending booking

ALTER TABLE user_availability
ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'available'
CHECK (booking_status IN ('available', 'booked', 'pending'));

-- Indexes for efficient slot availability queries
CREATE INDEX IF NOT EXISTS idx_user_availability_booking_status
  ON user_availability(booking_status);

CREATE INDEX IF NOT EXISTS idx_user_availability_slot_lookup
  ON user_availability(user_id, date, booking_status, is_available, is_blocked);

-- Set correct status on existing records
UPDATE user_availability
SET booking_status = 'available'
WHERE booking_status IS NULL
  AND is_available = true
  AND is_blocked = false;

-- Backfill: mark slots that belong to accepted invites as booked
UPDATE user_availability
SET booking_status = 'booked'
WHERE id IN (
  SELECT DISTINCT availability_id
  FROM match_invites
  WHERE status = 'accepted'
    AND availability_id IS NOT NULL
);

COMMENT ON COLUMN user_availability.booking_status IS
  'Booking state of a time slot: available | booked | pending';
