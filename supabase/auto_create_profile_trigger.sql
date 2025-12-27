-- ═══════════════════════════════════════════════════════════════════════════
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to automatically create a user_profile
-- when a new user signs up via any auth method (Apple, Email, etc.)
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, display_name)
  VALUES (
    NEW.id,
    -- Generate username from email or random
    COALESCE(
      LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '', 'g')) || FLOOR(RANDOM() * 1000)::TEXT,
      'user' || FLOOR(RANDOM() * 100000)::TEXT
    ),
    -- Use name from metadata or default
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      'Weave User'
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Username already exists, try with more random suffix
    INSERT INTO public.user_profiles (id, username, display_name)
    VALUES (
      NEW.id,
      'user' || FLOOR(RANDOM() * 10000000)::TEXT,
      COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        'Weave User'
      )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires after user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Now when users sign up, their profile is auto-created.
-- ═══════════════════════════════════════════════════════════════════════════
