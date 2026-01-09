-- Migration: Change ID columns from UUID to TEXT to support WatermelonDB IDs
-- Robust version: Handles missing tables and constraints gracefully

-- 1. Core Tables (Assume these exist)
-- Drop constraints first
ALTER TABLE public.interaction_friends DROP CONSTRAINT IF EXISTS interaction_friends_interaction_id_fkey;
ALTER TABLE public.interaction_friends DROP CONSTRAINT IF EXISTS interaction_friends_friend_id_fkey;
ALTER TABLE public.intention_friends DROP CONSTRAINT IF EXISTS intention_friends_intention_id_fkey;
ALTER TABLE public.intention_friends DROP CONSTRAINT IF EXISTS intention_friends_friend_id_fkey;
ALTER TABLE public.life_events DROP CONSTRAINT IF EXISTS life_events_friend_id_fkey;

-- Parent Tables
ALTER TABLE public.friends ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.interactions ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.intentions ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.life_events ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.weekly_reflections ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.journal_entries ALTER COLUMN id TYPE text USING id::text;

-- Child Columns (Foreign Keys must match Parent ID type)
ALTER TABLE public.life_events ALTER COLUMN friend_id TYPE text USING friend_id::text;

-- Child Tables (Join Tables) - Core
ALTER TABLE public.interaction_friends 
  ALTER COLUMN id TYPE text USING id::text,
  ALTER COLUMN interaction_id TYPE text USING interaction_id::text,
  ALTER COLUMN friend_id TYPE text USING friend_id::text;

ALTER TABLE public.intention_friends 
  ALTER COLUMN id TYPE text USING id::text,
  ALTER COLUMN intention_id TYPE text USING intention_id::text,
  ALTER COLUMN friend_id TYPE text USING friend_id::text;

-- Re-add constraints for Core Tables
ALTER TABLE public.life_events
  ADD CONSTRAINT life_events_friend_id_fkey 
  FOREIGN KEY (friend_id) REFERENCES public.friends(id) ON DELETE CASCADE;

ALTER TABLE public.interaction_friends
  ADD CONSTRAINT interaction_friends_interaction_id_fkey 
  FOREIGN KEY (interaction_id) REFERENCES public.interactions(id) ON DELETE CASCADE;

ALTER TABLE public.interaction_friends
  ADD CONSTRAINT interaction_friends_friend_id_fkey 
  FOREIGN KEY (friend_id) REFERENCES public.friends(id) ON DELETE CASCADE;

ALTER TABLE public.intention_friends
  ADD CONSTRAINT intention_friends_intention_id_fkey 
  FOREIGN KEY (intention_id) REFERENCES public.intentions(id) ON DELETE CASCADE;

ALTER TABLE public.intention_friends
  ADD CONSTRAINT intention_friends_friend_id_fkey 
  FOREIGN KEY (friend_id) REFERENCES public.friends(id) ON DELETE CASCADE;


-- 2. Optional/Missing Tables (journal_entry_friends)
-- Use DO block to check existence before altering
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entry_friends') THEN
        -- Drop constraints
        ALTER TABLE public.journal_entry_friends DROP CONSTRAINT IF EXISTS journal_entry_friends_journal_entry_id_fkey;
        ALTER TABLE public.journal_entry_friends DROP CONSTRAINT IF EXISTS journal_entry_friends_friend_id_fkey;
        
        -- Alter columns
        ALTER TABLE public.journal_entry_friends 
          ALTER COLUMN id TYPE text USING id::text,
          ALTER COLUMN journal_entry_id TYPE text USING journal_entry_id::text,
          ALTER COLUMN friend_id TYPE text USING friend_id::text;
          
        -- Re-add constraints
        ALTER TABLE public.journal_entry_friends
          ADD CONSTRAINT journal_entry_friends_journal_entry_id_fkey 
          FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;

        ALTER TABLE public.journal_entry_friends
          ADD CONSTRAINT journal_entry_friends_friend_id_fkey 
          FOREIGN KEY (friend_id) REFERENCES public.friends(id) ON DELETE CASCADE;
    END IF;
END $$;


-- 3. Add missing columns detected in logs

-- Add 'is_draft' to journal_entries if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'is_draft') THEN
        ALTER TABLE public.journal_entries ADD COLUMN is_draft boolean DEFAULT false;
    END IF;
END $$;

-- Add 'ai_disclosure_acknowledged_at' to user_profile if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profile' AND column_name = 'ai_disclosure_acknowledged_at') THEN
        ALTER TABLE public.user_profile ADD COLUMN ai_disclosure_acknowledged_at timestamptz;
    END IF;
END $$;

-- Add 'avg_weave_duration_minutes' to friends if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'friends' AND column_name = 'avg_weave_duration_minutes') THEN
        ALTER TABLE public.friends ADD COLUMN avg_weave_duration_minutes double precision;
    END IF;
END $$;

-- Create 'suggestion_events' table if missing
CREATE TABLE IF NOT EXISTS public.suggestion_events (
    id text PRIMARY KEY,
    user_id uuid NOT NULL,
    suggestion_id text NOT NULL,
    friend_id text NOT NULL,
    suggestion_type text NOT NULL,
    urgency text NOT NULL,
    action_type text NOT NULL,
    event_type text NOT NULL,
    event_timestamp timestamptz NOT NULL,
    friend_score_at_event double precision,
    days_since_last_interaction double precision,
    resulting_interaction_id text,
    time_to_action_minutes double precision,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add foreign key for suggestion_events -> friends
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'suggestion_events_friend_id_fkey') THEN
        ALTER TABLE public.suggestion_events
        ADD CONSTRAINT suggestion_events_friend_id_fkey
        FOREIGN KEY (friend_id) REFERENCES public.friends(id) ON DELETE CASCADE;
    END IF;
END $$;

