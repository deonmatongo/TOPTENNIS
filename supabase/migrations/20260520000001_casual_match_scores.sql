-- Add score tracking columns to match_invites for casual (non-league) matches.
-- player1_score / player2_score = sets won by sender / receiver respectively.
-- winner_id references the auth user UUID of the match winner.

ALTER TABLE public.match_invites
  ADD COLUMN IF NOT EXISTS winner_id       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS player1_score   INTEGER,
  ADD COLUMN IF NOT EXISTS player2_score   INTEGER;

-- Index for querying unscored past matches efficiently
CREATE INDEX IF NOT EXISTS idx_match_invites_winner ON public.match_invites(winner_id)
  WHERE winner_id IS NOT NULL;
