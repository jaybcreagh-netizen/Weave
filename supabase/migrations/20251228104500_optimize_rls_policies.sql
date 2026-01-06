-- Migration: Optimize RLS policies for performance
-- Optimizes auth.uid() calls by wrapping them in (select auth.uid()) to avoid per-row evaluation
-- Consolidate duplicate/overlapping policies where appropriate

BEGIN;

--------------------------------------------------------------------------------
-- 1. user_push_tokens
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.user_push_tokens;
CREATE POLICY "Users can insert their own tokens" ON public.user_push_tokens
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own tokens" ON public.user_push_tokens;
CREATE POLICY "Users can view their own tokens" ON public.user_push_tokens
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own tokens" ON public.user_push_tokens;
CREATE POLICY "Users can update their own tokens" ON public.user_push_tokens
  FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.user_push_tokens;
CREATE POLICY "Users can delete their own tokens" ON public.user_push_tokens
  FOR DELETE USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 2. user_subscriptions
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 3. usage_tracking
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_tracking;
CREATE POLICY "Users can update own usage" ON public.usage_tracking
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_tracking;
CREATE POLICY "Users can view own usage" ON public.usage_tracking
  FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 4. user_profiles
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can search by username" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.user_profiles;

CREATE POLICY "Authenticated can view profiles" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);


--------------------------------------------------------------------------------
-- 5. friend_links
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create link requests" ON public.friend_links;
CREATE POLICY "Users can create link requests" ON public.friend_links
  FOR INSERT WITH CHECK ((select auth.uid()) = initiated_by);

DROP POLICY IF EXISTS "Users can update own links" ON public.friend_links;
CREATE POLICY "Users can update own links" ON public.friend_links
  FOR UPDATE USING ((select auth.uid()) IN (user_a_id, user_b_id));

DROP POLICY IF EXISTS "Users can view own links" ON public.friend_links;
CREATE POLICY "Users can view own links" ON public.friend_links
  FOR SELECT USING ((select auth.uid()) IN (user_a_id, user_b_id));


--------------------------------------------------------------------------------
-- 6. shared_weaves
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Creator can update weave" ON public.shared_weaves;
CREATE POLICY "Creator can update weave" ON public.shared_weaves
  FOR UPDATE USING ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can create weaves" ON public.shared_weaves;
CREATE POLICY "Users can create weaves" ON public.shared_weaves
  FOR INSERT WITH CHECK ((select auth.uid()) = created_by);

DROP POLICY IF EXISTS "Users can view own weaves" ON public.shared_weaves;
DROP POLICY IF EXISTS "Participants can view shared weaves" ON public.shared_weaves;
DROP POLICY IF EXISTS "Users can view related shared weaves" ON public.shared_weaves;

CREATE POLICY "Users can view related shared weaves" ON public.shared_weaves
  FOR SELECT USING (
    (select auth.uid()) = created_by OR 
    EXISTS (
      SELECT 1 FROM public.shared_weave_participants 
      WHERE shared_weave_id = id AND user_id = (select auth.uid())
    )
  );


--------------------------------------------------------------------------------
-- 7. shared_weave_participants
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Creator can add participants" ON public.shared_weave_participants;
CREATE POLICY "Creator can add participants" ON public.shared_weave_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shared_weaves
      WHERE id = shared_weave_id AND created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own participation" ON public.shared_weave_participants;
CREATE POLICY "Users can update own participation" ON public.shared_weave_participants
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own participations" ON public.shared_weave_participants;
CREATE POLICY "Users can view own participations" ON public.shared_weave_participants
  FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 8. friends
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own friends" ON public.friends;
CREATE POLICY "Users can insert own friends" ON public.friends FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own friends" ON public.friends;
CREATE POLICY "Users can update own friends" ON public.friends FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own friends" ON public.friends;
CREATE POLICY "Users can delete own friends" ON public.friends FOR DELETE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own friends" ON public.friends;
CREATE POLICY "Users can view own friends" ON public.friends FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 9. interactions
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own interactions" ON public.interactions;
CREATE POLICY "Users can insert own interactions" ON public.interactions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own interactions" ON public.interactions;
CREATE POLICY "Users can update own interactions" ON public.interactions FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own interactions" ON public.interactions;
CREATE POLICY "Users can delete own interactions" ON public.interactions FOR DELETE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own interactions" ON public.interactions;
CREATE POLICY "Users can view own interactions" ON public.interactions FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 10. interaction_friends
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own interaction_friends" ON public.interaction_friends;
CREATE POLICY "Users can insert own interaction_friends" ON public.interaction_friends FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own interaction_friends" ON public.interaction_friends;
CREATE POLICY "Users can delete own interaction_friends" ON public.interaction_friends FOR DELETE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own interaction_friends" ON public.interaction_friends;
CREATE POLICY "Users can view own interaction_friends" ON public.interaction_friends FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 11. intentions
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own intentions" ON public.intentions;
CREATE POLICY "Users can insert own intentions" ON public.intentions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own intentions" ON public.intentions;
CREATE POLICY "Users can update own intentions" ON public.intentions FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own intentions" ON public.intentions;
CREATE POLICY "Users can delete own intentions" ON public.intentions FOR DELETE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own intentions" ON public.intentions;
CREATE POLICY "Users can view own intentions" ON public.intentions FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 12. intention_friends
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own intention_friends" ON public.intention_friends;
CREATE POLICY "Users can insert own intention_friends" ON public.intention_friends FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own intention_friends" ON public.intention_friends;
CREATE POLICY "Users can delete own intention_friends" ON public.intention_friends FOR DELETE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own intention_friends" ON public.intention_friends;
CREATE POLICY "Users can view own intention_friends" ON public.intention_friends FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 13. life_events
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own life_events" ON public.life_events;
CREATE POLICY "Users can insert own life_events" ON public.life_events FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own life_events" ON public.life_events;
CREATE POLICY "Users can update own life_events" ON public.life_events FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own life_events" ON public.life_events;
CREATE POLICY "Users can delete own life_events" ON public.life_events FOR DELETE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own life_events" ON public.life_events;
CREATE POLICY "Users can view own life_events" ON public.life_events FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 14. weekly_reflections
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own weekly_reflections" ON public.weekly_reflections;
CREATE POLICY "Users can insert own weekly_reflections" ON public.weekly_reflections FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own weekly_reflections" ON public.weekly_reflections;
CREATE POLICY "Users can update own weekly_reflections" ON public.weekly_reflections FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own weekly_reflections" ON public.weekly_reflections;
CREATE POLICY "Users can delete own weekly_reflections" ON public.weekly_reflections FOR DELETE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own weekly_reflections" ON public.weekly_reflections;
CREATE POLICY "Users can view own weekly_reflections" ON public.weekly_reflections FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 15. journal_entries
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own journal_entries" ON public.journal_entries;
CREATE POLICY "Users can insert own journal_entries" ON public.journal_entries FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own journal_entries" ON public.journal_entries;
CREATE POLICY "Users can update own journal_entries" ON public.journal_entries FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own journal_entries" ON public.journal_entries;
CREATE POLICY "Users can delete own journal_entries" ON public.journal_entries FOR DELETE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own journal_entries" ON public.journal_entries;
CREATE POLICY "Users can view own journal_entries" ON public.journal_entries FOR SELECT USING ((select auth.uid()) = user_id);


--------------------------------------------------------------------------------
-- 16. user_progress
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_progress;
CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
CREATE POLICY "Users can update own progress" ON public.user_progress FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_progress;
CREATE POLICY "Users can view own progress" ON public.user_progress FOR SELECT USING ((select auth.uid()) = user_id);

COMMIT;
