-- Add league_id column to matches table to enable league-specific performance tracking
ALTER TABLE public.matches 
ADD COLUMN league_id TEXT;

-- Add an index for better query performance
CREATE INDEX idx_matches_league_id ON public.matches(league_id);

-- Add a comment to explain the column
COMMENT ON COLUMN public.matches.league_id IS 'Links match to a specific league for performance tracking';