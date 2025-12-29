-- Add Identity columns for Phase 3 (Contact Discovery)

-- 1. Add phone column (Unique identifier for contact matching)
-- using text for E.164 format (e.g. +15551234567)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'phone'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN phone TEXT;
        ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_phone_key UNIQUE (phone);
    END IF;
END $$;

-- 2. Add email column (Synced from auth.users for easier lookup/display)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 3. Add google_id column (For potential future Google linking/lookup)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'google_id'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN google_id TEXT;
    END IF;
END $$;

-- 4. Comment on Privacy
-- Note: 'phone' column should be treated as private. 
-- Ensure client-side queries do not select 'phone' when fetching public profiles.
-- Contact matching will be performed via secure Edge Functions.

-- Verify columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
AND column_name IN ('phone', 'email', 'google_id');
