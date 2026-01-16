-- Add cancellation tracking fields to match_invites
ALTER TABLE match_invites
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid REFERENCES auth.users(id);