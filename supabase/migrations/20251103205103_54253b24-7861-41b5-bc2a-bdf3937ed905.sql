-- Add proposal fields to match_invites table
ALTER TABLE public.match_invites
ADD COLUMN IF NOT EXISTS proposed_date date,
ADD COLUMN IF NOT EXISTS proposed_start_time time without time zone,
ADD COLUMN IF NOT EXISTS proposed_end_time time without time zone,
ADD COLUMN IF NOT EXISTS proposed_by_user_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS proposed_at timestamp with time zone;

-- Update the status check constraint to allow 'cancelled'
ALTER TABLE public.match_invites 
DROP CONSTRAINT IF EXISTS match_invites_status_check;

ALTER TABLE public.match_invites 
ADD CONSTRAINT match_invites_status_check 
CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired'));

-- Migrate data from match_bookings to match_invites
INSERT INTO public.match_invites (
  sender_id,
  receiver_id,
  availability_id,
  date,
  start_time,
  end_time,
  court_location,
  message,
  status,
  home_away_indicator,
  proposed_date,
  proposed_start_time,
  proposed_end_time,
  proposed_by_user_id,
  proposed_at,
  created_at,
  updated_at
)
SELECT 
  booker_id as sender_id,
  opponent_id as receiver_id,
  availability_id,
  date,
  start_time,
  end_time,
  court_location,
  message,
  CASE 
    WHEN status = 'confirmed' THEN 'accepted'
    ELSE status
  END as status,
  home_away_indicator,
  proposed_date,
  proposed_start_time,
  proposed_end_time,
  proposed_by_user_id,
  proposed_at,
  created_at,
  updated_at
FROM public.match_bookings
WHERE NOT EXISTS (
  SELECT 1 FROM public.match_invites mi
  WHERE mi.sender_id = match_bookings.booker_id
  AND mi.receiver_id = match_bookings.opponent_id
  AND mi.date = match_bookings.date
  AND mi.start_time = match_bookings.start_time
);

-- Drop the match_bookings table with cascade to remove triggers and functions
DROP TABLE IF EXISTS public.match_bookings CASCADE;