-- ============================================================================
-- ADD USERNAME SEARCH INDEX
-- ============================================================================
-- Fixes slow user search by adding a GIN trgm index on user_profiles(username).
-- This optimizes ilike queries like: ilike('username', 'query%')
-- ============================================================================

-- 1. Enable pg_trgm extension if not already enabled
--    (Safe to check if exists, widely used for text search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create GIN index on username
--    using gin_trgm_ops for fast pattern matching (LIKE/ILIKE)
CREATE INDEX IF NOT EXISTS idx_user_profiles_username_search 
ON public.user_profiles 
USING GIN (username gin_trgm_ops);

-- 3. Comment explaining the index
COMMENT ON INDEX public.idx_user_profiles_username_search IS 'Optimizes user search by username (ILIKE)';
