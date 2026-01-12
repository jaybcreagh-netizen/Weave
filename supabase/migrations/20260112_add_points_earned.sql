-- Migration: Add points_earned column to interaction_friends
-- Purpose: Store actual points awarded for accurate score reversal on deletion
-- Date: 2026-01-12

ALTER TABLE public.interaction_friends 
ADD COLUMN IF NOT EXISTS points_earned NUMERIC DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.interaction_friends.points_earned IS 
  'Actual points credited to this friend for this interaction. Used for accurate deletion reversal.';
