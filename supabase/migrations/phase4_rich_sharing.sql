-- Phase 4: Rich Sharing Schema Updates

-- 1. Updates to shared_weaves
-- Allow creators to control if participants can edit details
ALTER TABLE public.shared_weaves
ADD COLUMN IF NOT EXISTS can_participant_edit boolean DEFAULT false;

-- Track who last edited to show in UI ("Edited by Jay")
ALTER TABLE public.shared_weaves
ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES auth.users(id);

ALTER TABLE public.shared_weaves
ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- Store the shared note content
ALTER TABLE public.shared_weaves
ADD COLUMN IF NOT EXISTS note text;

-- 2. Updates to shared_weave_participants
-- Define role (viewer vs editor) and tracking for plan invitations
ALTER TABLE public.shared_weave_participants
ADD COLUMN IF NOT EXISTS role text DEFAULT 'viewer'; -- 'viewer', 'editor'

ALTER TABLE public.shared_weave_participants
ADD COLUMN IF NOT EXISTS invitation_sent_at timestamptz;

-- 3. Update RLS Policies (Draft)
-- We'll likely need to update RLS to allow updates if role = 'editor' OR can_participant_edit = true
-- For now, we ensure the columns are readable
