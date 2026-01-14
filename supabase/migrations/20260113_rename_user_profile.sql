-- Rename table from singular to plural to match codebase
ALTER TABLE IF EXISTS user_profile RENAME TO user_profiles;

-- Update triggers if they exist with the old name
DROP TRIGGER IF EXISTS update_user_profile_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();