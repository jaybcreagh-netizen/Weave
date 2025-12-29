-- Add phone_hash column for privacy-preserving matching
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS phone_hash text;

CREATE INDEX IF NOT EXISTS user_profiles_phone_hash_idx ON public.user_profiles (phone_hash);

-- Enable pgcrypto if not already enabled (needed for hashing in trigger)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create function to auto-hash phone
CREATE OR REPLACE FUNCTION public.handle_phone_hashing() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    -- Normalize and hash. 
    -- Note: Client sends SHA-256 of E.164. 
    -- We assume NEW.phone is already E.164. 
    -- We computes SHA-256 hex string matches client logic.
    NEW.phone_hash := encode(digest(NEW.phone, 'sha256'), 'hex');
  ELSE
    NEW.phone_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_user_phone_change ON public.user_profiles;
CREATE TRIGGER on_user_phone_change
  BEFORE INSERT OR UPDATE OF phone ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_phone_hashing();

-- Backfill existing phones (if any)
UPDATE public.user_profiles 
SET phone = phone 
WHERE phone IS NOT NULL AND phone_hash IS NULL;
