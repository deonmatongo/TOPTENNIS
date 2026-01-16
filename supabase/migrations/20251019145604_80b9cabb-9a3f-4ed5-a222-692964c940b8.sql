-- Add age_competition_preference and travel_distance columns to players table
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS age_competition_preference character varying,
ADD COLUMN IF NOT EXISTS travel_distance character varying;

-- Add comments for documentation
COMMENT ON COLUMN public.players.age_competition_preference IS 'Player preference for age bracket competition (within-bracket, below-bracket, no-preference)';
COMMENT ON COLUMN public.players.travel_distance IS 'Maximum distance player is willing to travel (0-5, 0-10, 0-15, 0-20, 0-30, no-limit)';