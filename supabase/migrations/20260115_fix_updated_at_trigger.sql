-- ============================================================================
-- FIX: update_updated_at_column() trigger function
--
-- Problem: The trigger tries to set `updated_at_ts` but user_profiles table
-- only has `updated_at` column. This causes errors on any UPDATE.
--
-- Solution: Update the trigger to use `server_updated_at` (the correct column
-- for server-side timestamps) instead of the non-existent `updated_at_ts`.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the server timestamp column (exists on all synced tables)
  NEW.server_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger itself (update_user_profiles_updated_at) is already attached
-- to the user_profiles table, so we just need to fix the function definition.
