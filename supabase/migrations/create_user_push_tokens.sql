-- Create user_push_tokens table for storing Expo push tokens
-- This enables server-sent notifications for shared weaves, link requests, etc.

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    device_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one token per user/device combination
    UNIQUE(user_id, push_token)
);

-- Create index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON public.user_push_tokens(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tokens
CREATE POLICY "Users can insert their own tokens"
    ON public.user_push_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tokens"
    ON public.user_push_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
    ON public.user_push_tokens
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
    ON public.user_push_tokens
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can read all tokens (for sending push notifications)
CREATE POLICY "Service can read all tokens"
    ON public.user_push_tokens
    FOR SELECT
    TO service_role
    USING (true);

-- Comment on table purpose
COMMENT ON TABLE public.user_push_tokens IS 'Stores Expo push tokens for sending remote notifications';
