-- Atomic RPC: accept a match invite and lock the availability slot in one transaction.
-- Prevents double-booking even under concurrent requests.

CREATE OR REPLACE FUNCTION accept_invite_and_lock_slot(
    p_invite_id UUID,
    p_user_id UUID,
    p_conflicting_invite_ids UUID[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite RECORD;
    v_availability_id UUID;
    v_slot_date DATE;
    v_slot_start_time TIME;
    v_slot_end_time TIME;
    v_result JSON;
    v_conflict_count INTEGER;
BEGIN
    -- Lock the invite row to prevent concurrent modifications
    SELECT * INTO v_invite
    FROM match_invites
    WHERE id = p_invite_id
      AND receiver_id = p_user_id
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or not pending';
    END IF;

    v_availability_id  := v_invite.availability_id;
    v_slot_date        := v_invite.date;
    v_slot_start_time  := v_invite.start_time;
    v_slot_end_time    := v_invite.end_time;

    -- Atomic double-booking guard
    IF v_availability_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_conflict_count
        FROM user_availability
        WHERE id = v_availability_id
          AND booking_status = 'booked';

        IF v_conflict_count > 0 THEN
            RAISE EXCEPTION 'Slot already booked';
        END IF;
    END IF;

    -- Accept the invite
    UPDATE match_invites
    SET status      = 'accepted',
        response_at = NOW(),
        updated_at  = NOW()
    WHERE id = p_invite_id;

    -- Lock the availability slot
    IF v_availability_id IS NOT NULL THEN
        UPDATE user_availability
        SET booking_status = 'booked',
            updated_at     = NOW()
        WHERE id = v_availability_id
          AND booking_status != 'booked';
    END IF;

    -- Decline explicitly-passed conflicting invites
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

    -- Auto-decline all other pending invites for the same slot
    IF v_availability_id IS NOT NULL THEN
        UPDATE match_invites
        SET status      = 'declined',
            response_at = NOW(),
            updated_at  = NOW()
        WHERE availability_id = v_availability_id
          AND status = 'pending'
          AND id != p_invite_id;
    END IF;

    v_result := json_build_object(
        'success',           true,
        'invite_id',         p_invite_id,
        'availability_id',   v_availability_id,
        'slot_date',         v_slot_date,
        'slot_start_time',   v_slot_start_time,
        'slot_end_time',     v_slot_end_time,
        'conflicts_declined', COALESCE(array_length(p_conflicting_invite_ids, 1), 0)
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error',   SQLERRM,
            'detail',  SQLSTATE
        );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invite_and_lock_slot TO authenticated;

COMMENT ON FUNCTION accept_invite_and_lock_slot IS
  'Atomically accepts a match invite and marks the availability slot as booked, preventing double-booking';
