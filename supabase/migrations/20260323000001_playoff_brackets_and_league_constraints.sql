-- ─────────────────────────────────────────────────────────────────────────────
-- Playoff brackets, group constraints, and league standings
-- Groups (divisions) are same-sex, same-skill, max 10 players
-- ─────────────────────────────────────────────────────────────────────────────

-- Enforce max 10 players per division by default
ALTER TABLE divisions ALTER COLUMN max_players SET DEFAULT 10;

-- Add check if missing — won't error if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'divisions' AND constraint_name = 'divisions_max_players_check'
  ) THEN
    ALTER TABLE divisions ADD CONSTRAINT divisions_max_players_check
      CHECK (max_players BETWEEN 1 AND 10);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- playoff_brackets: stores the bracket structure for each division's playoffs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playoff_brackets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id    UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,

  -- Bracket position
  round_number   INTEGER NOT NULL CHECK (round_number >= 1),
  match_number   INTEGER NOT NULL CHECK (match_number >= 1),

  -- Players (NULL when slot not yet determined)
  player1_id     UUID REFERENCES auth.users(id),
  player2_id     UUID REFERENCES auth.users(id),
  seed_player1   INTEGER,   -- seeding rank
  seed_player2   INTEGER,
  is_tbd         BOOLEAN NOT NULL DEFAULT false,  -- true = winner of previous match fills this slot

  -- Result
  winner_id      UUID REFERENCES auth.users(id),
  score          JSONB,     -- { "sets": [[6,4],[7,5]] }

  -- Scheduling
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','scheduled','completed','bye','cancelled')),
  scheduled_date DATE,
  scheduled_time TIME,
  court_location TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_winner
    CHECK (winner_id IS NULL OR winner_id = player1_id OR winner_id = player2_id),
  CONSTRAINT unique_bracket_position
    UNIQUE (division_id, round_number, match_number)
);

CREATE INDEX IF NOT EXISTS idx_playoff_brackets_division
  ON playoff_brackets(division_id);
CREATE INDEX IF NOT EXISTS idx_playoff_brackets_round
  ON playoff_brackets(division_id, round_number);
CREATE INDEX IF NOT EXISTS idx_playoff_brackets_players
  ON playoff_brackets(player1_id, player2_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION _set_playoff_brackets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_playoff_brackets_updated_at ON playoff_brackets;
CREATE TRIGGER trg_playoff_brackets_updated_at
  BEFORE UPDATE ON playoff_brackets
  FOR EACH ROW EXECUTE FUNCTION _set_playoff_brackets_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE playoff_brackets ENABLE ROW LEVEL SECURITY;

-- Any active division member can read the bracket
CREATE POLICY "division members read bracket"
  ON playoff_brackets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM division_assignments da
      WHERE da.division_id = playoff_brackets.division_id
        AND da.user_id     = auth.uid()
        AND da.status      = 'active'
    )
  );

-- Only admins/moderators can create or modify brackets
CREATE POLICY "admins manage brackets"
  ON playoff_brackets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin','moderator')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- league_standings view: cross-group rankings for a league
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW league_standings AS
SELECT
  da.user_id,
  da.division_id,
  d.league_id,
  d.division_name,
  d.gender_preference,
  d.skill_level_range,
  d.season,
  COALESCE(p.name,
    TRIM(CONCAT(prof.first_name, ' ', prof.last_name))) AS player_name,
  prof.profile_picture_url                              AS avatar_url,
  COALESCE(p.wins,           0)  AS wins,
  COALESCE(p.losses,         0)  AS losses,
  COALESCE(p.total_matches,  0)  AS total_matches,
  COALESCE(p.skill_level,    3)  AS skill_level,
  p.usta_rating,
  -- Points: 3 per win + 1 bonus per every 2 matches completed
  (COALESCE(p.wins, 0) * 3)
    + FLOOR(da.matches_completed::numeric / 2)         AS points,
  da.matches_completed,
  da.matches_required,
  da.playoff_eligible
FROM division_assignments da
JOIN  divisions d    ON d.id      = da.division_id
LEFT JOIN players p  ON p.user_id = da.user_id
LEFT JOIN profiles prof ON prof.id = da.user_id
WHERE da.status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- generate_playoff_bracket(division_id, num_qualifiers)
-- Seeds the top N playoff-eligible players and creates the bracket rows.
-- Call this once the regular season ends (admin action).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_playoff_bracket(
  p_division_id    UUID,
  p_num_qualifiers INTEGER DEFAULT 4
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_qualifiers UUID[]  := '{}';
  v_count      INTEGER := 0;
  v_qualifier  RECORD;
  v_i          INTEGER;
  v_round      INTEGER;
  v_prev       INTEGER;
  v_curr       INTEGER;
BEGIN
  -- Collect top-N playoff-eligible players, ranked by points
  FOR v_qualifier IN
    SELECT da.user_id
    FROM   division_assignments da
    LEFT JOIN players p ON p.user_id = da.user_id
    WHERE  da.division_id    = p_division_id
      AND  da.playoff_eligible = true
      AND  da.status           = 'active'
    ORDER BY (COALESCE(p.wins, 0) * 3)
               + FLOOR(da.matches_completed::numeric / 2) DESC
    LIMIT p_num_qualifiers
  LOOP
    v_count := v_count + 1;
    v_qualifiers[v_count] := v_qualifier.user_id;
  END LOOP;

  IF v_count < 2 THEN
    RAISE EXCEPTION
      'Need at least 2 playoff-eligible players (found %).', v_count;
  END IF;

  -- Clear any previous bracket for this division
  DELETE FROM playoff_brackets WHERE division_id = p_division_id;

  -- Round 1: pair seed-1 vs seed-N, seed-2 vs seed-(N-1), …
  FOR v_i IN 1 .. FLOOR(v_count::numeric / 2)::int LOOP
    INSERT INTO playoff_brackets
      (division_id, round_number, match_number,
       player1_id,           player2_id,
       seed_player1,         seed_player2, status)
    VALUES
      (p_division_id, 1, v_i,
       v_qualifiers[v_i],    v_qualifiers[v_count - v_i + 1],
       v_i,                  v_count - v_i + 1, 'pending');
  END LOOP;

  -- Subsequent rounds: TBD placeholders
  v_prev  := FLOOR(v_count::numeric / 2)::int;
  v_round := 2;
  WHILE v_prev > 1 LOOP
    v_curr := CEIL(v_prev::numeric / 2)::int;
    FOR v_i IN 1..v_curr LOOP
      INSERT INTO playoff_brackets
        (division_id, round_number, match_number, is_tbd, status)
      VALUES
        (p_division_id, v_round, v_i, true, 'pending');
    END LOOP;
    v_prev  := v_curr;
    v_round := v_round + 1;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- advance_playoff_winner(bracket_match_id, winning_player_id, score_json)
-- Records a result and populates the next-round TBD slot.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION advance_playoff_winner(
  p_match_id  UUID,
  p_winner_id UUID,
  p_score     JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match        playoff_brackets%ROWTYPE;
  v_next_match   INTEGER;
  v_next_slot    TEXT;   -- 'player1_id' or 'player2_id'
  v_next_id      UUID;
BEGIN
  SELECT * INTO v_match FROM playoff_brackets WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Playoff match % not found', p_match_id;
  END IF;

  -- Validate winner is a participant
  IF p_winner_id <> v_match.player1_id AND p_winner_id <> v_match.player2_id THEN
    RAISE EXCEPTION 'Winner % is not a participant in match %', p_winner_id, p_match_id;
  END IF;

  -- Record result
  UPDATE playoff_brackets
  SET winner_id = p_winner_id,
      score     = p_score,
      status    = 'completed'
  WHERE id = p_match_id;

  -- Determine which slot in the next round to fill
  -- Even match_number → fills player2, odd → fills player1
  v_next_match := CEIL(v_match.match_number::numeric / 2)::int;
  IF v_match.match_number % 2 = 1 THEN
    v_next_slot := 'player1_id';
  ELSE
    v_next_slot := 'player2_id';
  END IF;

  -- Find the next-round TBD match
  SELECT id INTO v_next_id
  FROM   playoff_brackets
  WHERE  division_id  = v_match.division_id
    AND  round_number = v_match.round_number + 1
    AND  match_number = v_next_match
    AND  is_tbd       = true
  LIMIT 1;

  IF FOUND THEN
    IF v_next_slot = 'player1_id' THEN
      UPDATE playoff_brackets
      SET player1_id = p_winner_id, is_tbd = false
      WHERE id = v_next_id;
    ELSE
      UPDATE playoff_brackets
      SET player2_id = p_winner_id, is_tbd = false
      WHERE id = v_next_id;
    END IF;
  END IF;
END;
$$;
