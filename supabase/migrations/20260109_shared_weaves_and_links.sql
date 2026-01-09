-- ============================================================================
-- SHARED WEAVES & FRIEND LINKING TABLES
-- These are required for the social sharing features to work
-- ============================================================================

-- 0. Add avatar_url to user_profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.user_profiles ADD COLUMN avatar_url text;
    END IF;
END $$;

-- 1. shared_weaves - Main shared weave records
CREATE TABLE IF NOT EXISTS public.shared_weaves (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by uuid NOT NULL REFERENCES auth.users(id),
    weave_date timestamptz NOT NULL,
    title text,
    location text,
    category text,
    duration text,
    note text,
    status text DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled'
    can_participant_edit boolean DEFAULT false,
    last_edited_by uuid REFERENCES auth.users(id),
    last_edited_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Safely add columns to shared_weaves if they don't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shared_weaves' AND column_name = 'can_participant_edit') THEN
        ALTER TABLE public.shared_weaves ADD COLUMN can_participant_edit boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shared_weaves' AND column_name = 'last_edited_by') THEN
        ALTER TABLE public.shared_weaves ADD COLUMN last_edited_by uuid REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shared_weaves' AND column_name = 'last_edited_at') THEN
        ALTER TABLE public.shared_weaves ADD COLUMN last_edited_at timestamptz;
    END IF;
END $$;

-- 2. shared_weave_participants - Users invited to a shared weave
CREATE TABLE IF NOT EXISTS public.shared_weave_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_weave_id uuid NOT NULL REFERENCES public.shared_weaves(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    response text DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    responded_at timestamptz,
    role text DEFAULT 'viewer', -- 'viewer', 'editor'
    local_interaction_id text, -- Client's local interaction ID
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(shared_weave_id, user_id)
);

-- Safely add columns to shared_weave_participants if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shared_weave_participants' AND column_name = 'role') THEN
        ALTER TABLE public.shared_weave_participants ADD COLUMN role text DEFAULT 'viewer';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shared_weave_participants' AND column_name = 'local_interaction_id') THEN
        ALTER TABLE public.shared_weave_participants ADD COLUMN local_interaction_id text;
    END IF;
END $$;

-- 3. friend_links - Connect users across the app
CREATE TABLE IF NOT EXISTS public.friend_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id uuid NOT NULL REFERENCES auth.users(id),
    user_b_id uuid NOT NULL REFERENCES auth.users(id),
    user_a_friend_id text, -- Local friend ID on user A's device
    user_b_friend_id text, -- Local friend ID on user B's device
    initiated_by uuid NOT NULL REFERENCES auth.users(id),
    status text DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'unlinked'
    linked_at timestamptz,
    unlinked_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    -- Ensure unique links between users (order-independent)
    CONSTRAINT unique_user_pair CHECK (user_a_id < user_b_id),
    UNIQUE(user_a_id, user_b_id)
);

-- Safely add unlinked_at if it's missing (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'friend_links' AND column_name = 'unlinked_at') THEN
        ALTER TABLE public.friend_links ADD COLUMN unlinked_at timestamptz;
    END IF;

    -- Safely add updated_at if it's missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'friend_links' AND column_name = 'updated_at') THEN
        ALTER TABLE public.friend_links ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;

-- Safely add constraints if they don't exist (e.g. if table was created before constraints were added)
DO $$
BEGIN
    -- Check Constraint: user_a_id < user_b_id
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_pair') THEN
        -- We try to add it, but if data violates it, this might fail. 
        -- For now, we attempt it. If it fails, manual cleanup is needed.
        BEGIN
            ALTER TABLE public.friend_links ADD CONSTRAINT unique_user_pair CHECK (user_a_id < user_b_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add unique_user_pair constraint (likely data violation): %', SQLERRM;
        END;
    END IF;

    -- Unique Constraint: (user_a_id, user_b_id)
    -- Note: This is an index/constraint. 'friend_links_user_a_id_user_b_id_key' is the default name for UNIQUE(a,b)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friend_links_user_a_id_user_b_id_key') THEN
        BEGIN
            ALTER TABLE public.friend_links ADD CONSTRAINT friend_links_user_a_id_user_b_id_key UNIQUE(user_a_id, user_b_id);
        EXCEPTION WHEN OTHERS THEN
             RAISE NOTICE 'Could not add unique constraint (likely data violation): %', SQLERRM;
        END;
    END IF;
END $$;

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE public.shared_weaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_weave_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS (To break RLS recursion)
-- Must be defined BEFORE policies that reference them
-- ============================================================================

-- Check if current user is the creator of a weave (Security Definer to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.is_weave_creator(weave_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.shared_weaves 
        WHERE id = weave_id 
        AND created_by = auth.uid()
    );
$$;

-- Check if current user is a participant of a weave (Security Definer to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.is_weave_participant(weave_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.shared_weave_participants 
        WHERE shared_weave_id = weave_id 
        AND user_id = auth.uid()
    );
$$;

-- ============================================================================
-- RLS POLICIES - shared_weaves
-- ============================================================================

-- Drop existing policies first (idempotent)
DROP POLICY IF EXISTS "Creator can manage shared weaves" ON public.shared_weaves;
DROP POLICY IF EXISTS "Participants can view shared weaves" ON public.shared_weaves;
DROP POLICY IF EXISTS "Editors can update shared weaves" ON public.shared_weaves;

-- Creator can do anything
CREATE POLICY "Creator can manage shared weaves"
    ON public.shared_weaves
    FOR ALL
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Participants can read shared weaves they're invited to (uses function to avoid recursion)
CREATE POLICY "Participants can view shared weaves"
    ON public.shared_weaves
    FOR SELECT
    TO authenticated
    USING (public.is_weave_participant(id));

-- Participants can update shared weaves they're part of (uses function to avoid recursion)
CREATE POLICY "Editors can update shared weaves"
    ON public.shared_weaves
    FOR UPDATE
    TO authenticated
    USING (public.is_weave_participant(id));

-- ============================================================================
-- RLS POLICIES - shared_weave_participants
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own participation" ON public.shared_weave_participants;
DROP POLICY IF EXISTS "Creator can view participants" ON public.shared_weave_participants;
DROP POLICY IF EXISTS "Users can update own response" ON public.shared_weave_participants;
DROP POLICY IF EXISTS "Creator can add participants" ON public.shared_weave_participants;

-- Users can see their own participation records
CREATE POLICY "Users can view own participation"
    ON public.shared_weave_participants
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Weave creator can see all participants (uses function to avoid recursion)
CREATE POLICY "Creator can view participants"
    ON public.shared_weave_participants
    FOR SELECT
    TO authenticated
    USING (public.is_weave_creator(shared_weave_id));

-- Users can update their own response
CREATE POLICY "Users can update own response"
    ON public.shared_weave_participants
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Creator can add participants (uses function to avoid recursion)
CREATE POLICY "Creator can add participants"
    ON public.shared_weave_participants
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_weave_creator(shared_weave_id));

-- ============================================================================
-- RLS POLICIES - friend_links
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own links" ON public.friend_links;
DROP POLICY IF EXISTS "Users can create links" ON public.friend_links;
DROP POLICY IF EXISTS "Users can update links" ON public.friend_links;

-- Users can see links involving them
CREATE POLICY "Users can view own links"
    ON public.friend_links
    FOR SELECT
    TO authenticated
    USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Users can create links they initiate
CREATE POLICY "Users can create links"
    ON public.friend_links
    FOR INSERT
    TO authenticated
    WITH CHECK (initiated_by = auth.uid());

-- Users can update links involving them
CREATE POLICY "Users can update links"
    ON public.friend_links
    FOR UPDATE
    TO authenticated
    USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shared_weaves_created_by ON public.shared_weaves(created_by);
CREATE INDEX IF NOT EXISTS idx_shared_weave_participants_weave ON public.shared_weave_participants(shared_weave_id);
CREATE INDEX IF NOT EXISTS idx_shared_weave_participants_user ON public.shared_weave_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_links_user_a ON public.friend_links(user_a_id);
CREATE INDEX IF NOT EXISTS idx_friend_links_user_b ON public.friend_links(user_b_id);
CREATE INDEX IF NOT EXISTS idx_friend_links_status ON public.friend_links(status);
