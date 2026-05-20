-- Add week_number to league_matches for round-robin scheduling
ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS week_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_league_matches_week ON public.league_matches(division_id, week_number);

-- Refresh user_league_matches view to include week_number (must drop+recreate after adding column to base table)
DROP VIEW IF EXISTS public.user_league_matches;
CREATE VIEW public.user_league_matches AS
SELECT
  lm.*,
  d.division_name,
  d.league_id,
  p1.first_name  AS player1_first_name,
  p1.last_name   AS player1_last_name,
  p2.first_name  AS player2_first_name,
  p2.last_name   AS player2_last_name,
  CASE WHEN lm.player1_id = auth.uid()
    THEN p2.first_name || ' ' || p2.last_name
    ELSE p1.first_name || ' ' || p1.last_name
  END AS opponent_name,
  CASE WHEN lm.player1_id = auth.uid()
    THEN lm.player2_id
    ELSE lm.player1_id
  END AS opponent_id
FROM public.league_matches lm
JOIN public.divisions       d  ON d.id  = lm.division_id
JOIN public.profiles        p1 ON p1.id = lm.player1_id
JOIN public.profiles        p2 ON p2.id = lm.player2_id
WHERE lm.player1_id = auth.uid()
   OR lm.player2_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON public.user_league_matches TO authenticated;

-- ── generate_round_robin_schedule ─────────────────────────────────────────────
-- Generates a full round-robin schedule for a division using the circle/polygon
-- rotation algorithm. Each pair of players meets exactly once.
--
-- Returns the number of matches created, or -1 if matches already exist.
--
-- p_season_start: first day of the season; matches are spaced 1 week apart.
-- Players are assigned to weeks (week 1 = p_season_start, week 2 = +7 days, …).
CREATE OR REPLACE FUNCTION public.generate_round_robin_schedule(
  p_division_id  UUID,
  p_season_start DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_players UUID[];
  v_n       INTEGER;
  v_rounds  INTEGER;
  v_round   INTEGER;
  v_i       INTEGER;
  v_j       INTEGER;
  v_tmp     UUID;
  v_p1      UUID;
  v_p2      UUID;
  v_count   INTEGER := 0;
BEGIN
  -- Abort if a round-robin schedule already exists for this division
  IF EXISTS (
    SELECT 1 FROM public.league_matches
    WHERE division_id = p_division_id AND week_number IS NOT NULL
    LIMIT 1
  ) THEN
    RETURN -1;
  END IF;

  -- Collect active players ordered by assignment date (deterministic)
  SELECT ARRAY_AGG(user_id ORDER BY user_id)
  INTO v_players
  FROM public.division_assignments
  WHERE division_id = p_division_id AND status = 'active';

  IF v_players IS NULL OR array_length(v_players, 1) < 2 THEN
    RETURN 0;
  END IF;

  v_n := array_length(v_players, 1);

  -- Pad to even count with NULL sentinel (bye round)
  IF v_n % 2 = 1 THEN
    v_players := v_players || ARRAY[NULL::UUID];
    v_n       := v_n + 1;
  END IF;

  v_rounds := v_n - 1;

  -- Circle / polygon-rotation algorithm
  -- Position 1 (v_players[1]) is fixed; positions 2..N rotate each round.
  FOR v_round IN 1..v_rounds LOOP
    -- Pair position 1 with position N (they face each other each round)
    v_p1 := v_players[1];
    v_p2 := v_players[v_n];

    IF v_p1 IS NOT NULL AND v_p2 IS NOT NULL THEN
      INSERT INTO public.league_matches
        (division_id, player1_id, player2_id, week_number, status, scheduled_date)
      VALUES
        (p_division_id, v_p1, v_p2, v_round, 'pending',
         p_season_start + ((v_round - 1) * 7));
      v_count := v_count + 1;
    END IF;

    -- Pair positions 2..N/2 with positions N-1..N/2+1
    FOR v_i IN 2..(v_n / 2) LOOP
      v_p1 := v_players[v_i];
      v_p2 := v_players[v_n + 1 - v_i];   -- mirror position

      IF v_p1 IS NOT NULL AND v_p2 IS NOT NULL THEN
        INSERT INTO public.league_matches
          (division_id, player1_id, player2_id, week_number, status, scheduled_date)
        VALUES
          (p_division_id, v_p1, v_p2, v_round, 'pending',
           p_season_start + ((v_round - 1) * 7));
        v_count := v_count + 1;
      END IF;
    END LOOP;

    -- Rotate positions 2..N clockwise:
    -- last element wraps to position 2; others shift right by one
    v_tmp := v_players[v_n];
    FOR v_j IN REVERSE v_n..3 LOOP
      v_players[v_j] := v_players[v_j - 1];
    END LOOP;
    v_players[2] := v_tmp;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_round_robin_schedule(UUID, DATE) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
