-- ═══════════════════════════════════════════════════════════════════════════
-- Username Protection System
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds cooldowns, yearly limits, and username reservation for social discovery
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add tracking columns to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS username_changes_this_year INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS username_year_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create reserved usernames table
CREATE TABLE IF NOT EXISTS reserved_usernames (
  username VARCHAR(30) PRIMARY KEY,
  reserved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_reserved_expires ON reserved_usernames(expires_at);

-- RLS: Only the system/functions can modify, but allow reads for availability checks
ALTER TABLE reserved_usernames ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Anyone can check reserved usernames" ON reserved_usernames;
DROP POLICY IF EXISTS "Users can manage own reservations" ON reserved_usernames;

-- Allow authenticated users to check if a username is reserved
CREATE POLICY "Anyone can check reserved usernames" 
  ON reserved_usernames FOR SELECT 
  USING (true);

-- Only the owner can see their own reservations in detail
CREATE POLICY "Users can manage own reservations" 
  ON reserved_usernames FOR ALL 
  USING (reserved_by = auth.uid());

-- 3. Cleanup function for expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_username_reservations()
RETURNS void AS $$
BEGIN
  DELETE FROM reserved_usernames WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to change username with all protections
CREATE OR REPLACE FUNCTION change_username(
  p_user_id UUID,
  p_new_username VARCHAR(30)
)
RETURNS jsonb AS $$
DECLARE
  v_old_username VARCHAR(30);
  v_changed_at TIMESTAMPTZ;
  v_changes_count INT;
  v_year_reset TIMESTAMPTZ;
  v_cooldown_days INT := 30;
  v_max_changes_per_year INT := 3;
  v_reservation_days INT := 14;
BEGIN
  -- Clean up expired reservations first
  PERFORM cleanup_expired_username_reservations();
  
  -- Get current user data
  SELECT username, username_changed_at, username_changes_this_year, username_year_reset_at
  INTO v_old_username, v_changed_at, v_changes_count, v_year_reset
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- Check if username is the same
  IF v_old_username = p_new_username THEN
    RETURN jsonb_build_object('success', false, 'error', 'same_username');
  END IF;
  
  -- Reset yearly counter if we're in a new year
  IF v_year_reset IS NULL OR EXTRACT(YEAR FROM v_year_reset) < EXTRACT(YEAR FROM NOW()) THEN
    v_changes_count := 0;
    v_year_reset := NOW();
  END IF;
  
  -- Check cooldown (30 days)
  IF v_changed_at IS NOT NULL AND (NOW() - v_changed_at) < (v_cooldown_days || ' days')::INTERVAL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'cooldown',
      'cooldown_ends_at', v_changed_at + (v_cooldown_days || ' days')::INTERVAL
    );
  END IF;
  
  -- Check yearly limit
  IF v_changes_count >= v_max_changes_per_year THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'yearly_limit',
      'resets_at', DATE_TRUNC('year', NOW()) + INTERVAL '1 year'
    );
  END IF;
  
  -- Check if new username is already taken
  IF EXISTS (SELECT 1 FROM user_profiles WHERE username = p_new_username AND id != p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'taken');
  END IF;
  
  -- Check if new username is reserved by someone else
  IF EXISTS (SELECT 1 FROM reserved_usernames WHERE username = p_new_username AND reserved_by != p_user_id AND expires_at > NOW()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'reserved');
  END IF;
  
  -- All checks passed! Reserve old username
  INSERT INTO reserved_usernames (username, reserved_by, expires_at)
  VALUES (v_old_username, p_user_id, NOW() + (v_reservation_days || ' days')::INTERVAL)
  ON CONFLICT (username) DO UPDATE SET
    reserved_by = p_user_id,
    reserved_at = NOW(),
    expires_at = NOW() + (v_reservation_days || ' days')::INTERVAL;
  
  -- Update the username
  UPDATE user_profiles
  SET 
    username = p_new_username,
    username_changed_at = NOW(),
    username_changes_this_year = v_changes_count + 1,
    username_year_reset_at = v_year_reset,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'old_username', v_old_username,
    'new_username', p_new_username,
    'changes_remaining', v_max_changes_per_year - (v_changes_count + 1),
    'old_username_reserved_until', NOW() + (v_reservation_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to check if username change is allowed
CREATE OR REPLACE FUNCTION can_change_username(p_user_id UUID)
RETURNS jsonb AS $$
DECLARE
  v_changed_at TIMESTAMPTZ;
  v_changes_count INT;
  v_year_reset TIMESTAMPTZ;
  v_cooldown_days INT := 30;
  v_max_changes_per_year INT := 3;
BEGIN
  -- Clean up expired reservations
  PERFORM cleanup_expired_username_reservations();
  
  SELECT username_changed_at, username_changes_this_year, username_year_reset_at
  INTO v_changed_at, v_changes_count, v_year_reset
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- Reset yearly counter if we're in a new year
  IF v_year_reset IS NULL OR EXTRACT(YEAR FROM v_year_reset) < EXTRACT(YEAR FROM NOW()) THEN
    v_changes_count := 0;
  END IF;
  
  -- Check cooldown
  IF v_changed_at IS NOT NULL AND (NOW() - v_changed_at) < (v_cooldown_days || ' days')::INTERVAL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'cooldown',
      'cooldown_ends_at', v_changed_at + (v_cooldown_days || ' days')::INTERVAL,
      'changes_remaining', v_max_changes_per_year - v_changes_count
    );
  END IF;
  
  -- Check yearly limit
  IF v_changes_count >= v_max_changes_per_year THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'yearly_limit',
      'resets_at', DATE_TRUNC('year', NOW()) + INTERVAL '1 year',
      'changes_remaining', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'changes_remaining', v_max_changes_per_year - v_changes_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION change_username(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION can_change_username(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_username_reservations() TO authenticated;
