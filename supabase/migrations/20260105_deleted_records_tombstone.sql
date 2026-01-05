-- =====================================================
-- Deleted Records Tombstone Table
-- =====================================================
-- Tracks deleted records for WatermelonDB sync protocol.
-- When a record is deleted, we store its ID here so other
-- devices know to delete it locally on next sync.
--
-- Tombstones are kept for 30 days then cleaned up.
-- =====================================================

CREATE TABLE IF NOT EXISTS deleted_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Unique constraint for upsert
  UNIQUE(user_id, table_name, record_id)
);

-- Enable RLS
ALTER TABLE deleted_records ENABLE ROW LEVEL SECURITY;

-- Users can only see their own deleted records
CREATE POLICY "Users can view own deleted records"
  ON deleted_records FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (from Edge Functions)
CREATE POLICY "Service role can insert deleted records"
  ON deleted_records FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- Users can insert their own deleted records
CREATE POLICY "Users can insert own deleted records"
  ON deleted_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for efficient querying
CREATE INDEX idx_deleted_records_user_table ON deleted_records(user_id, table_name);
CREATE INDEX idx_deleted_records_deleted_at ON deleted_records(deleted_at);

-- =====================================================
-- Cleanup Function
-- =====================================================
-- Removes tombstones older than 30 days
-- Should be called periodically via pg_cron or similar

CREATE OR REPLACE FUNCTION cleanup_old_tombstones()
RETURNS void AS $$
BEGIN
  DELETE FROM deleted_records
  WHERE deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger to auto-record deletions
-- =====================================================
-- Creates tombstone records automatically when rows are deleted
-- from synced tables. This ensures deletions are tracked even
-- when done directly via SQL.

CREATE OR REPLACE FUNCTION record_deletion()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO deleted_records (user_id, table_name, record_id, deleted_at)
  VALUES (OLD.user_id, TG_TABLE_NAME, OLD.id::text, NOW())
  ON CONFLICT (user_id, table_name, record_id) DO UPDATE
  SET deleted_at = NOW();

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply deletion triggers to all synced tables
CREATE TRIGGER track_friends_deletion
  AFTER DELETE ON friends
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

CREATE TRIGGER track_interactions_deletion
  AFTER DELETE ON interactions
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

CREATE TRIGGER track_interaction_friends_deletion
  AFTER DELETE ON interaction_friends
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

CREATE TRIGGER track_intentions_deletion
  AFTER DELETE ON intentions
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

CREATE TRIGGER track_intention_friends_deletion
  AFTER DELETE ON intention_friends
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

CREATE TRIGGER track_life_events_deletion
  AFTER DELETE ON life_events
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

CREATE TRIGGER track_weekly_reflections_deletion
  AFTER DELETE ON weekly_reflections
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

CREATE TRIGGER track_journal_entries_deletion
  AFTER DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

-- Note: user_profile and user_progress are singletons (1 per user)
-- and typically shouldn't be deleted, so no trigger needed
