-- Add missing columns to user_profiles table
-- Required for: timezone support, archetype quiz, and profile features

-- Add timezone column (for scheduling notifications in user's timezone)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'timezone'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN timezone TEXT DEFAULT 'UTC';
    END IF;
END $$;

-- Add quiz_result column (stores archetype quiz results as JSONB)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'quiz_result'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN quiz_result JSONB;
    END IF;
END $$;

-- Add archetype column (primary archetype from quiz or manual selection)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'archetype'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN archetype TEXT;
    END IF;
END $$;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
ORDER BY ordinal_position;
