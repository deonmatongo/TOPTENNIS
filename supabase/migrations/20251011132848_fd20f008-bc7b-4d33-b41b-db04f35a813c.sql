-- Add city and zip_code columns to players table
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT;