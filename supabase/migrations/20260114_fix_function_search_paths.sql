-- Fix function search paths to prevent search_path manipulation vulnerabilities

-- 1. username protection functions
ALTER FUNCTION public.cleanup_expired_username_reservations() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.change_username(UUID, VARCHAR) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.can_change_username(UUID) SET search_path = public, extensions, pg_temp;

-- 2. phone hashing function
ALTER FUNCTION public.handle_phone_hashing() SET search_path = public, extensions, pg_temp;

-- 3. tombstone functions
ALTER FUNCTION public.cleanup_old_tombstones() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.record_deletion() SET search_path = public, extensions, pg_temp;

-- 4. shared weave notification functions
ALTER FUNCTION public.notify_shared_weave_participant() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_shared_weave_acceptance() SET search_path = public, extensions, pg_temp;

-- 5. user management functions
ALTER FUNCTION public.handle_new_user() SET search_path = public, extensions, pg_temp;

-- 6. timestamp update function
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, extensions, pg_temp;
