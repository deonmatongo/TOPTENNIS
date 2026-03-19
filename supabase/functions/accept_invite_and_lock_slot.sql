-- Atomic function to accept invite and lock slot to prevent double booking
-- This function ensures that slot locking and invite acceptance happen in a single transaction

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
    v_slot_owner_id UUID;
    v_result JSON;
    v_conflict_count INTEGER;
BEGIN
    -- Get the invite details and lock the row
    SELECT * INTO v_invite 
    FROM match_invites 
    WHERE id = p_invite_id 
    AND receiver_id = p_user_id
    AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or not pending';
    END IF;

    -- Extract availability details
    v_availability_id := v_invite.availability_id;
    v_slot_date := v_invite.date;
    v_slot_start_time := v_invite.start_time;
    v_slot_end_time := v_invite.end_time;
    v_slot_owner_id := v_invite.sender_id;

    -- Check if the slot is still available (atomic check)
    SELECT COUNT(*) INTO v_conflict_count
    FROM user_availability
    WHERE id = v_availability_id
    AND booking_status = 'booked';

    IF v_conflict_count > 0 THEN
        RAISE EXCEPTION 'Slot already booked';
    END IF;

    -- Update the invite status to accepted
    UPDATE match_invites 
    SET 
        status = 'accepted',
        response_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invite_id;

    -- Lock the availability slot
    UPDATE user_availability
    SET 
        booking_status = 'booked',
        updated_at = NOW()
    WHERE id = v_availability_id
    AND booking_status != 'booked'; -- Ensure we don't double-book

    -- Decline conflicting invites (if any provided)
    IF p_conflicting_invite_ids IS NOT NULL AND array_length(p_conflicting_invite_ids, 1) > 0 THEN
        UPDATE match_invites
        SET 
            status = 'declined',
            response_at = NOW(),
            updated_at = NOW()
        WHERE id = ANY(p_conflicting_invite_ids)
        AND status = 'pending';
    END IF;

    -- Auto-decline any other pending invites for the same slot
    UPDATE match_invites
    SET 
        status = 'declined',
        response_at = NOW(),
        updated_at = NOW()
    WHERE availability_id = v_availability_id
    AND status = 'pending'
    AND id != p_invite_id;

    -- Return success result
    v_result := json_build_object(
        'success', true,
        'invite_id', p_invite_id,
        'availability_id', v_availability_id,
        'slot_date', v_slot_date,
        'slot_start_time', v_slot_start_time,
        'slot_end_time', v_slot_end_time,
        'conflicts_declined', COALESCE(array_length(p_conflicting_invite_ids, 1), 0)
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_invite_and_lock_slot TO authenticated;

-- Add comment
COMMENT ON FUNCTION accept_invite_and_lock_slot IS 'Atomically accepts a match invite and locks the availability slot to prevent double booking';
