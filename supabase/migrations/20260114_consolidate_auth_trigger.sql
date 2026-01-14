-- Drop any existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Consolidated function with error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  random_suffix TEXT;
  new_username TEXT;
BEGIN
  random_suffix := (floor(random() * 90000 + 10000))::text;
  new_username := 'user_' || random_suffix;

  -- 1. Create free tier subscription (safe - ON CONFLICT)
  INSERT INTO public.user_subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Initialize usage tracking (safe - ON CONFLICT)
  INSERT INTO public.usage_tracking (user_id, period_start, period_end)
  VALUES (
    NEW.id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT (user_id, period_start) DO NOTHING;

  -- 3. Create user profile with username (CRITICAL - uses user_profiles plural)
  INSERT INTO public.user_profiles (id, user_id, username, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.id,
    new_username,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      'Weave User'
    ),
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- 4. Create user progress row
  INSERT INTO public.user_progress (id, user_id, created_at, updated_at)
  VALUES (
    uuid_generate_v4(),
    NEW.id,
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth transaction
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
