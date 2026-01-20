-- ============================================================================
-- INVITE LINKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The invite code (short, shareable)
    code TEXT UNIQUE NOT NULL,

    -- Why nullable? To support unauthenticated sharing (snapshot only, no linking)
    creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_display_name TEXT,  -- Cached or provided manually for anonymous users

    -- The local ID of the friend record on the Creator's device
    -- This allows us to merge the local record with the new real user later
    creator_friend_local_id TEXT,

    -- Optional: Link to existing shared_weave
    shared_weave_id UUID REFERENCES shared_weaves(id) ON DELETE SET NULL,

    -- Snapshot of weave data (for creating in new user's app)
    -- Contains: title, date, location, category, duration, note, etc.
    weave_snapshot JSONB,

    -- Friend name (what creator called them locally)
    friend_name TEXT,

    -- Status
    status TEXT DEFAULT 'pending',  -- 'pending', 'claimed', 'expired'

    -- Claim info
    claimed_by UUID REFERENCES auth.users(id),
    claimed_at TIMESTAMPTZ,

    -- Expiry (7 days default)
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure creator_id is nullable (fix for existing tables)
ALTER TABLE public.invite_links ALTER COLUMN creator_id DROP NOT NULL;

-- Index for quick code lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);

-- Index for user's invites
CREATE INDEX IF NOT EXISTS idx_invite_links_creator ON invite_links(creator_id);

-- RLS Policies
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- Creators can see their own invites
DROP POLICY IF EXISTS "Creators can view own invites" ON invite_links;
CREATE POLICY "Creators can view own invites"
    ON invite_links FOR SELECT
    USING (creator_id = auth.uid());

-- Anyone can claim (but RPC handles validation/update)
-- We might restrict this to 'true' for insert/update via RPC if needed,
-- but typically RPCs with SECURITY DEFINER bypass RLS.
-- We'll just allow SELECT for RPC internal usage context if needed (though SECURITY DEFINER handles it).
-- Keeping it minimal for now.

-- ============================================================================
-- RPC: CREATE INVITE
-- ============================================================================

-- Drop old signature to prevent ambiguity (overloading error)
DROP FUNCTION IF EXISTS create_invite(JSONB, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_invite(
    p_weave_snapshot JSONB,
    p_friend_name TEXT DEFAULT NULL,
    p_creator_friend_local_id TEXT DEFAULT NULL,
    p_display_name TEXT DEFAULT NULL  -- Optional manual name for anonymous users
)
RETURNS TABLE (code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code TEXT;
    v_user_id UUID;
    v_display_name TEXT;
BEGIN
    v_user_id := auth.uid();
    
    -- If authenticated, prefer profile name, otherwise use provided name or default
    IF v_user_id IS NOT NULL THEN
        SELECT display_name INTO v_display_name
        FROM user_profiles WHERE id = v_user_id;
        
        -- Fallback if profile name is empty but manual name provided
        IF v_display_name IS NULL THEN
            v_display_name := p_display_name;
        END IF;
    ELSE
        -- Anonymous: Use provided name or generic fallback
        v_display_name := COALESCE(p_display_name, 'A Friend');
    END IF;

    -- Generate unique 6-char code
    -- Loop to ensure uniqueness
    LOOP
        v_code := upper(substring(md5(random()::text) from 1 for 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM invite_links WHERE invite_links.code = v_code);
    END LOOP;

    -- Insert invite
    INSERT INTO invite_links (
        code, 
        creator_id, 
        creator_display_name, 
        weave_snapshot, 
        friend_name,
        creator_friend_local_id
    )
    VALUES (
        v_code, 
        v_user_id,  -- Can be NULL now
        v_display_name, 
        p_weave_snapshot, 
        p_friend_name,
        p_creator_friend_local_id
    );

    RETURN QUERY
    SELECT v_code, NOW() + INTERVAL '7 days';
END;
$$;

-- ============================================================================
-- RPC: CLAIM INVITE
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_invite(p_code TEXT)
RETURNS TABLE (
    weave_snapshot JSONB,
    creator_id UUID,
    creator_name TEXT,
    friend_name TEXT,
    creator_friend_local_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite invite_links%ROWTYPE;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find and lock the invite
    SELECT * INTO v_invite
    FROM invite_links
    WHERE invite_links.code = upper(p_code)
      AND status = 'pending'
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite code';
    END IF;

    -- Can't claim your own invite
    IF v_invite.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Cannot claim your own invite';
    END IF;

    -- Mark as claimed
    UPDATE invite_links
    SET status = 'claimed',
        claimed_by = v_user_id,
        claimed_at = NOW()
    WHERE id = v_invite.id;

    -- Return invite data including the local ID context
    RETURN QUERY
    SELECT v_invite.weave_snapshot,
           v_invite.creator_id,
           v_invite.creator_display_name,
           v_invite.friend_name,
           v_invite.creator_friend_local_id;
END;
$$;
