-- Migrate any existing 'friends_only' privacy_level records to 'private'
-- This is a safe default: friends_only was more restrictive than public,
-- so private is the correct equivalent.
UPDATE user_availability
SET privacy_level = 'private'
WHERE privacy_level = 'friends_only';
