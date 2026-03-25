-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: lock availability slots on accept; unlock on cancel/decline
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Updated accept_invite_and_lock_slot ────────────────────────────────────
-- Changes vs previous version:
--   • Locks slots by date/time overlap when availability_id is NULL
--   • Also locks the SENDER's overlapping availability slot
--   • Returns IDs of all locked slots so the caller can track them

CREATE OR REPLACE FUNCTION accept_invite_and_lock_slot(
    p_invite_id UUID,
    p_user_id   UUID,
    p_conflicting_invite_ids UUID[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite              RECORD;
    v_availability_id     UUID;
    v_slot_date           DATE;
    v_slot_start_time     TIME;
    v_slot_end_time       TIME;
    v_conflict_count      INTEGER;
    v_locked_ids          UUID[] := '{}';
    v_result              JSON;
BEGIN
    -- Lock the invite row to prevent concurrent modifications
    SELECT * INTO v_invite
    FROM match_invites
    WHERE id          = p_invite_id
      AND receiver_id = p_user_id
      AND status      = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or not pending';
    END IF;

    v_availability_id := v_invite.availability_id;
    v_slot_date       := v_invite.date;
    v_slot_start_time := v_invite.start_time;
    v_slot_end_time   := v_invite.end_time;

    -- ── Guard: reject if the specific slot is already booked ──────────────────
    IF v_availability_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_conflict_count
        FROM user_availability
        WHERE id             = v_availability_id
          AND booking_status = 'booked';

        IF v_conflict_count > 0 THEN
            RAISE EXCEPTION 'Slot already booked';
        END IF;
    END IF;

    -- ── Accept the invite ─────────────────────────────────────────────────────
    UPDATE match_invites
    SET status      = 'accepted',
        response_at = NOW(),
        updated_at  = NOW()
    WHERE id = p_invite_id;

    -- ── Lock RECEIVER's availability slot(s) ──────────────────────────────────
    IF v_availability_id IS NOT NULL THEN
        -- Lock the explicit slot reference
        UPDATE user_availability
        SET booking_status = 'booked',
            updated_at     = NOW()
        WHERE id             = v_availability_id
          AND booking_status IS DISTINCT FROM 'booked'
        RETURNING id INTO v_availability_id;

        IF v_availability_id IS NOT NULL THEN
            v_locked_ids := array_append(v_locked_ids, v_availability_id);
        END IF;
    ELSE
        -- No explicit reference: lock every overlapping slot for the receiver
        WITH locked AS (
            UPDATE user_availability
            SET booking_status = 'booked',
                updated_at     = NOW()
            WHERE user_id      = p_user_id
              AND date         = v_slot_date
              AND start_time  <= v_slot_start_time
              AND end_time    >= v_slot_end_time
              AND is_available = TRUE
              AND (booking_status IS NULL OR booking_status != 'booked')
            RETURNING id
        )
        SELECT array_agg(id) INTO v_locked_ids FROM locked;
        v_locked_ids := COALESCE(v_locked_ids, '{}');
    END IF;

    -- ── Lock SENDER's availability slot(s) ────────────────────────────────────
    WITH locked AS (
        UPDATE user_availability
        SET booking_status = 'booked',
            updated_at     = NOW()
        WHERE user_id      = v_invite.sender_id
          AND date         = v_slot_date
          AND start_time  <= v_slot_start_time
          AND end_time    >= v_slot_end_time
          AND is_available = TRUE
          AND (booking_status IS NULL OR booking_status != 'booked')
        RETURNING id
    )
    SELECT v_locked_ids || array_agg(id) INTO v_locked_ids FROM locked;
    v_locked_ids := COALESCE(v_locked_ids, '{}');

    -- ── Decline explicitly-passed conflicting invites ─────────────────────────
    IF p_conflicting_invite_ids IS NOT NULL
       AND array_length(p_conflicting_invite_ids, 1) > 0
    THEN
        UPDATE match_invites
        SET status      = 'declined',
            response_at = NOW(),
            updated_at  = NOW()
        WHERE id = ANY(p_conflicting_invite_ids)
          AND status = 'pending';
    END IF;

    -- ── Auto-decline all other pending invites for the same slot ──────────────
    IF v_availability_id IS NOT NULL THEN
        UPDATE match_invites
        SET status      = 'declined',
            response_at = NOW(),
            updated_at  = NOW()
        WHERE availability_id = v_availability_id
          AND status          = 'pending'
          AND id             != p_invite_id;
    END IF;

    v_result := json_build_object(
        'success',            TRUE,
        'invite_id',          p_invite_id,
        'availability_id',    v_invite.availability_id,
        'locked_slot_ids',    v_locked_ids,
        'slot_date',          v_slot_date,
        'slot_start_time',    v_slot_start_time,
        'slot_end_time',      v_slot_end_time,
        'conflicts_declined', COALESCE(array_length(p_conflicting_invite_ids, 1), 0)
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error',   SQLERRM,
            'detail',  SQLSTATE
        );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invite_and_lock_slot TO authenticated;


-- ── 2. New function: unlock_slots_for_invite ──────────────────────────────────
-- Called when an accepted invite is cancelled or a pending invite is declined.
-- Clears booking_status for availability slots that overlap the invite's time
-- for both sender and receiver.

CREATE OR REPLACE FUNCTION unlock_slots_for_invite(
    p_invite_id UUID,
    p_user_id   UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite          RECORD;
    v_unlocked_count  INTEGER := 0;
BEGIN
    -- Fetch the invite (caller must be sender or receiver)
    SELECT * INTO v_invite
    FROM match_invites
    WHERE id = p_invite_id
      AND (sender_id = p_user_id OR receiver_id = p_user_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or access denied';
    END IF;

    -- Unlock receiver's overlapping slots
    WITH unlocked AS (
        UPDATE user_availability
        SET booking_status = NULL,
            updated_at     = NOW()
        WHERE user_id      = v_invite.receiver_id
          AND date         = v_invite.date
          AND start_time  <= v_invite.start_time
          AND end_time    >= v_invite.end_time
          AND booking_status = 'booked'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_unlocked_count FROM unlocked;

    -- Unlock sender's overlapping slots
    WITH unlocked AS (
        UPDATE user_availability
        SET booking_status = NULL,
            updated_at     = NOW()
        WHERE user_id      = v_invite.sender_id
          AND date         = v_invite.date
          AND start_time  <= v_invite.start_time
          AND end_time    >= v_invite.end_time
          AND booking_status = 'booked'
        RETURNING id
    )
    SELECT v_unlocked_count + COUNT(*) INTO v_unlocked_count FROM unlocked;

    RETURN json_build_object(
        'success',         TRUE,
        'invite_id',       p_invite_id,
        'unlocked_count',  v_unlocked_count
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error',   SQLERRM,
            'detail',  SQLSTATE
        );
END;
$$;

GRANT EXECUTE ON FUNCTION unlock_slots_for_invite TO authenticated;

COMMENT ON FUNCTION unlock_slots_for_invite IS
  'Clears booking_status on availability slots for both parties when a match invite is cancelled or declined';
