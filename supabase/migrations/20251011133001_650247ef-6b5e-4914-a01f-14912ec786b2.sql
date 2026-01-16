-- Add location column to players table
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS location TEXT;