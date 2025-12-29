-- Mutual Reminders Schema
-- Tracks which reminders have been sent for shared plans to prevent duplicates

CREATE TABLE shared_weave_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_weave_id uuid NOT NULL REFERENCES shared_weaves(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    reminder_type text NOT NULL DEFAULT 'one_hour', -- 'one_hour', 'one_day', etc.
    sent_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(shared_weave_id, user_id, reminder_type)
);

-- RLS: Service role only (cron job uses service role key)
ALTER TABLE shared_weave_reminders ENABLE ROW LEVEL SECURITY;

-- Index for efficient querying
CREATE INDEX idx_shared_weave_reminders_shared_weave_id ON shared_weave_reminders(shared_weave_id);
CREATE INDEX idx_shared_weave_reminders_user_id ON shared_weave_reminders(user_id);

-- No client-side policies needed; this table is managed by backend Edge Functions only.
