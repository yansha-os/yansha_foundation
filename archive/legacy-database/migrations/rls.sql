-- RLS for ARISE tenant tables.
-- Apply AFTER the Prisma migration that creates tables.
-- Policies use: current_setting('app.current_user_id', true)
-- Set per-request via: SELECT set_config('app.current_user_id', '<userId>', true);

-- Force RLS even for table owners so Prisma cannot accidentally bypass.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'progress',
    'workouts',
    'meals',
    'health_logs',
    'quest_days',
    'day_totals',
    'streak_states',
    'difficulty_states',
    'achievement_states',
    'daily_awards',
    'system_notices',
    'prayer_days',
    'qada_items',
    'worship_events',
    'guilds',
    'guild_members',
    'guild_challenges',
    'guild_challenge_entries',
    'circles',
    'circle_members',
    'circle_assignments',
    'sync_queue_items'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Helper: drop + recreate policy for owner-scoped tables (user_id column)
CREATE OR REPLACE FUNCTION arise_owner_policy(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS arise_owner_all ON %I', table_name);
  EXECUTE format(
    'CREATE POLICY arise_owner_all ON %I
       FOR ALL
       USING ("userId" = current_setting(''app.current_user_id'', true))
       WITH CHECK ("userId" = current_setting(''app.current_user_id'', true))',
    table_name
  );
END;
$$ LANGUAGE plpgsql;

SELECT arise_owner_policy('profiles');
SELECT arise_owner_policy('progress');
SELECT arise_owner_policy('workouts');
SELECT arise_owner_policy('meals');
SELECT arise_owner_policy('health_logs');
SELECT arise_owner_policy('quest_days');
SELECT arise_owner_policy('day_totals');
SELECT arise_owner_policy('streak_states');
SELECT arise_owner_policy('difficulty_states');
SELECT arise_owner_policy('achievement_states');
SELECT arise_owner_policy('daily_awards');
SELECT arise_owner_policy('system_notices');
SELECT arise_owner_policy('prayer_days');
SELECT arise_owner_policy('qada_items');
SELECT arise_owner_policy('worship_events');
SELECT arise_owner_policy('sync_queue_items');
SELECT arise_owner_policy('guild_members');
SELECT arise_owner_policy('guild_challenge_entries');

-- Guilds: owner can manage; members can read guilds they belong to
DROP POLICY IF EXISTS arise_guild_select ON guilds;
CREATE POLICY arise_guild_select ON guilds
  FOR SELECT
  USING (
    "ownerId" = current_setting('app.current_user_id', true)
    OR EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm."guildId" = guilds.id
        AND gm."userId" = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS arise_guild_insert ON guilds;
CREATE POLICY arise_guild_insert ON guilds
  FOR INSERT
  WITH CHECK ("ownerId" = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS arise_guild_update ON guilds;
CREATE POLICY arise_guild_update ON guilds
  FOR UPDATE
  USING ("ownerId" = current_setting('app.current_user_id', true))
  WITH CHECK ("ownerId" = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS arise_guild_delete ON guilds;
CREATE POLICY arise_guild_delete ON guilds
  FOR DELETE
  USING ("ownerId" = current_setting('app.current_user_id', true));

-- Challenges: readable by guild members; writable by creator
DROP POLICY IF EXISTS arise_challenge_select ON guild_challenges;
CREATE POLICY arise_challenge_select ON guild_challenges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM guild_members gm
      WHERE gm."guildId" = guild_challenges."guildId"
        AND gm."userId" = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS arise_challenge_write ON guild_challenges;
CREATE POLICY arise_challenge_write ON guild_challenges
  FOR ALL
  USING ("createdById" = current_setting('app.current_user_id', true))
  WITH CHECK ("createdById" = current_setting('app.current_user_id', true));

-- Circles / classrooms: mentor owns the circle; members read circles they joined.
-- Membership rows are owner-scoped ("userId").
SELECT arise_owner_policy('circle_members');

DROP POLICY IF EXISTS arise_circle_select ON circles;
CREATE POLICY arise_circle_select ON circles
  FOR SELECT
  USING (
    "mentorId" = current_setting('app.current_user_id', true)
    OR EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm."circleId" = circles.id
        AND cm."userId" = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS arise_circle_insert ON circles;
CREATE POLICY arise_circle_insert ON circles
  FOR INSERT
  WITH CHECK ("mentorId" = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS arise_circle_update ON circles;
CREATE POLICY arise_circle_update ON circles
  FOR UPDATE
  USING ("mentorId" = current_setting('app.current_user_id', true))
  WITH CHECK ("mentorId" = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS arise_circle_delete ON circles;
CREATE POLICY arise_circle_delete ON circles
  FOR DELETE
  USING ("mentorId" = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS arise_circle_assignment_select ON circle_assignments;
CREATE POLICY arise_circle_assignment_select ON circle_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm."circleId" = circle_assignments."circleId"
        AND cm."userId" = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS arise_circle_assignment_write ON circle_assignments;
CREATE POLICY arise_circle_assignment_write ON circle_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_assignments."circleId"
        AND c."mentorId" = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM circles c
      WHERE c.id = circle_assignments."circleId"
        AND c."mentorId" = current_setting('app.current_user_id', true)
    )
  );

-- Shared prayer time cache: readable by all authenticated sessions; inserts allowed
ALTER TABLE prayer_time_caches ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_time_caches FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arise_prayer_cache_all ON prayer_time_caches;
CREATE POLICY arise_prayer_cache_all ON prayer_time_caches
  FOR ALL
  USING (current_setting('app.current_user_id', true) IS NOT NULL AND current_setting('app.current_user_id', true) <> '')
  WITH CHECK (current_setting('app.current_user_id', true) IS NOT NULL AND current_setting('app.current_user_id', true) <> '');

-- Leaderboard-safe projection: hunter stats only — NO worship / faith / prayer columns
CREATE OR REPLACE VIEW public_profile_stats AS
SELECT
  p."userId",
  p."hunterName",
  a."equippedTitle",
  pr."hunterXp",
  pr.strength,
  pr.vitality,
  pr.discipline,
  s.current AS "fitnessStreak"
FROM profiles p
JOIN progress pr ON pr."userId" = p."userId"
LEFT JOIN achievement_states a ON a."userId" = p."userId"
LEFT JOIN streak_states s ON s."userId" = p."userId";

COMMENT ON VIEW public_profile_stats IS
  'Public fitness projection only. Never join prayer_days, qada_items, worship_events, or faith.';

DROP FUNCTION IF EXISTS arise_owner_policy(text);
