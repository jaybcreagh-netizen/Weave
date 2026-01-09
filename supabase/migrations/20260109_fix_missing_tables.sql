-- Migration: Create missing tables and fix column types for sync

-- 1. Create 'shared_weave_refs' table
CREATE TABLE IF NOT EXISTS public.shared_weave_refs (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id), -- Owner of the record
    interaction_id text NOT NULL, -- Link to local interaction (text ID)
    server_weave_id text NOT NULL,
    created_by_user_id text NOT NULL, -- Supabase user ID (uuid formatted as text usually)
    is_creator boolean DEFAULT false,
    status text NOT NULL, -- 'pending', 'accepted', 'declined', 'expired'
    role text, -- 'viewer', 'editor'
    can_participant_edit boolean DEFAULT false,
    shared_at timestamptz,
    responded_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create 'groups' table
CREATE TABLE IF NOT EXISTS public.groups (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    name text NOT NULL,
    type text NOT NULL, -- 'manual', 'smart'
    smart_confidence double precision,
    photo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Create 'group_members' table
CREATE TABLE IF NOT EXISTS public.group_members (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    group_id text NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    friend_id text NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Create 'social_battery_logs' table
CREATE TABLE IF NOT EXISTS public.social_battery_logs (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    value double precision NOT NULL,
    timestamp timestamptz NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. Create 'sync_queue' table
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    operation_type text NOT NULL,
    payload text NOT NULL,
    status text NOT NULL,
    retry_count integer DEFAULT 0,
    last_error text,
    queued_at timestamptz,
    processed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6. Add missing column to 'user_profile'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profile' AND column_name = 'ai_features_enabled') THEN
        ALTER TABLE public.user_profile ADD COLUMN ai_features_enabled boolean;
    END IF;
END $$;

-- 7. Fix 'interactions' column types (Convert bigint timestamps to timestamptz)
-- The error "invalid input syntax for type bigint: 2026-01-09T..." implies the column is currently bigint.
-- We must cast it to compatible type. If it's epochs, we need to convert to timestamp.

-- Helper function to safely convert epoch (ms) to timestamp if needed, or cast if possible
-- But direct ALTER with USING is best.

-- Check and alter 'interaction_date'
DO $$
BEGIN
    -- Check if column exists and is NOT (timestamp with time zone)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'interactions' 
        AND column_name = 'interaction_date' 
        AND data_type NOT LIKE 'timestamp%'
    ) THEN
        -- Assume it's bigint (milliseconds) based on WatermelonDB generic default
        -- We convert to timestamptz. Handle NULLs.
        -- Syntax: to_timestamp(col / 1000.0) -> requires seconds
        ALTER TABLE public.interactions 
        ALTER COLUMN interaction_date TYPE timestamptz 
        USING to_timestamp(interaction_date::double precision / 1000.0);
    END IF;
END $$;
