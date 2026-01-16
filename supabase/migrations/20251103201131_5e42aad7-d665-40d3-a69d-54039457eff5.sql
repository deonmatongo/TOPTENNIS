-- Add proposed time fields to match_bookings table for counter-proposals
ALTER TABLE public.match_bookings 
ADD COLUMN IF NOT EXISTS proposed_date DATE,
ADD COLUMN IF NOT EXISTS proposed_start_time TIME,
ADD COLUMN IF NOT EXISTS proposed_end_time TIME,
ADD COLUMN IF NOT EXISTS proposed_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS proposed_at TIMESTAMP WITH TIME ZONE;