-- ============================================================================
-- AUTO-ASSIGN USERNAME MIGRATION
-- Ensures every new user gets a user_profile row with a username
-- ============================================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  random_suffix TEXT;
  new_username TEXT;
BEGIN
  -- Generate a random numeric suffix (10000-99999)
  random_suffix := (floor(random() * 90000 + 10000))::text;
  new_username := 'user_' || random_suffix;

  -- 1. Create free tier subscription for new user
  INSERT INTO public.user_subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active');

  -- 2. Initialize usage tracking
  INSERT INTO public.usage_tracking (user_id, period_start, period_end)
  VALUES (
    NEW.id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  );
  
  -- 3. Create user profile (CRITICAL for username assignment)
  -- Uses ON CONFLICT to avoid errors if profile already exists (e.g. created by client)
  INSERT INTO public.user_profile (id, user_id, username, display_name, created_at, updated_at)
  VALUES (
    NEW.id::text, 
    NEW.id, 
    new_username, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Weave User'),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- 4. Create user progress row
  INSERT INTO public.user_progress (id, user_id, created_at)
  VALUES (NEW.id::text, NEW.id, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger (just in case)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Optional: Backfill for ANY existing users who don't have a profile
-- (Use with caution in production with many users, but safe here)
DO $$
DECLARE
  u record;
  random_suffix TEXT;
  new_username TEXT;
BEGIN
  FOR u IN SELECT id, raw_user_meta_data FROM auth.users LOOP
    -- Check if profile exists
    IF NOT EXISTS (SELECT 1 FROM public.user_profile WHERE user_id = u.id) THEN
      random_suffix := (floor(random() * 90000 + 10000))::text;
      new_username := 'user_' || random_suffix;
      
      INSERT INTO public.user_profile (id, user_id, username, display_name, created_at, updated_at)
      VALUES (
        u.id::text,
        u.id, 
        new_username, 
        COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', 'Weave User'),
        NOW(),
        NOW()
      );
    END IF;
  END LOOP;
END;
$$;
