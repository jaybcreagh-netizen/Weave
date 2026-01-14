-- Enable Realtime for shared_weaves table
-- This allows clients to receive UPDATE events when weave details change

BEGIN;

  -- Add to publication if it exists
  DO $$
  BEGIN
      IF NOT EXISTS (
          SELECT 1
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'shared_weaves'
      ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_weaves;
      END IF;
  END $$;

COMMIT;
