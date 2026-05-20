-- Auto-generate round-robin schedule when a division becomes active.
-- Also backfills existing active divisions that have no schedule yet.

-- ── Trigger function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_generate_round_robin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Fire when a division transitions to 'active' status
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status <> 'active') THEN
    -- generate_round_robin_schedule returns -1 if schedule already exists (idempotent)
    PERFORM public.generate_round_robin_schedule(NEW.id, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

-- ── Trigger on divisions ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_auto_round_robin ON public.divisions;
CREATE TRIGGER trg_auto_round_robin
  AFTER INSERT OR UPDATE OF status ON public.divisions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_round_robin();

-- ── Backfill: generate schedule for all active divisions that have none ────────
DO $$
DECLARE
  div RECORD;
  result INTEGER;
BEGIN
  FOR div IN
    SELECT d.id
    FROM public.divisions d
    WHERE d.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.league_matches lm
        WHERE lm.division_id = d.id AND lm.week_number IS NOT NULL
        LIMIT 1
      )
  LOOP
    result := public.generate_round_robin_schedule(div.id, CURRENT_DATE);
    IF result > 0 THEN
      RAISE NOTICE 'Generated % matches for division %', result, div.id;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_generate_round_robin() TO service_role;

NOTIFY pgrst, 'reload schema';
