-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hunterName" TEXT NOT NULL DEFAULT 'Hunter',
    "calorieGoal" INTEGER NOT NULL DEFAULT 2200,
    "proteinGoal" INTEGER NOT NULL DEFAULT 140,
    "waterGoalMl" INTEGER NOT NULL DEFAULT 2500,
    "sleepGoalHours" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "stepsGoal" INTEGER NOT NULL DEFAULT 8000,
    "restDays" INTEGER[] DEFAULT ARRAY[5]::INTEGER[],
    "preferRun" BOOLEAN NOT NULL DEFAULT true,
    "prayerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT NOT NULL DEFAULT 'Mecca',
    "country" TEXT NOT NULL DEFAULT 'Saudi Arabia',
    "method" INTEGER NOT NULL DEFAULT 4,
    "school" INTEGER NOT NULL DEFAULT 0,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sex" TEXT,
    "age" INTEGER,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "activityLevel" TEXT NOT NULL DEFAULT 'sedentary',
    "goal" TEXT NOT NULL DEFAULT 'maintain',
    "onboardedAt" TIMESTAMP(3),
    "localMigratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hunterXp" INTEGER NOT NULL DEFAULT 0,
    "worshipXp" INTEGER NOT NULL DEFAULT 0,
    "strength" INTEGER NOT NULL DEFAULT 10,
    "vitality" INTEGER NOT NULL DEFAULT 10,
    "discipline" INTEGER NOT NULL DEFAULT 10,
    "faith" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exerciseId" TEXT,
    "type" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "durationMin" INTEGER,
    "estKcal" INTEGER,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "foodId" TEXT,
    "multiplier" DOUBLE PRECISION,
    "calories" INTEGER NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "waterMl" INTEGER NOT NULL DEFAULT 0,
    "sleepHours" DOUBLE PRECISION,
    "steps" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "isRest" BOOLEAN NOT NULL DEFAULT false,
    "quests" JSONB NOT NULL,
    "bonusAwarded" BOOLEAN NOT NULL DEFAULT false,
    "rolled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_totals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "totals" JSONB NOT NULL,

    CONSTRAINT "day_totals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streak_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "freezes" INTEGER NOT NULL DEFAULT 2,
    "lastRollover" TEXT NOT NULL DEFAULT '',
    "redemption" JSONB,
    "reducedBonus" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streak_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "difficulty_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modifiers" JSONB NOT NULL DEFAULT '{}',
    "lastAdjusted" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "difficulty_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "earned" JSONB NOT NULL DEFAULT '{}',
    "counters" JSONB NOT NULL DEFAULT '{}',
    "equippedTitle" TEXT NOT NULL DEFAULT 'novice-hunter',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_awards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "keys" TEXT[],

    CONSTRAINT "daily_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_notices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "fajr" TEXT,
    "dhuhr" TEXT,
    "asr" TEXT,
    "maghrib" TEXT,
    "isha" TEXT,
    "awards" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prayer_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qada_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "prayer" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qada_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worship_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worship_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_time_caches" (
    "id" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "method" INTEGER NOT NULL,
    "school" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "timings" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prayer_time_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_members" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_challenges" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_challenge_entries" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_challenge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_queue_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "sync_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "profiles_userId_idx" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "progress_userId_key" ON "progress"("userId");

-- CreateIndex
CREATE INDEX "progress_userId_idx" ON "progress"("userId");

-- CreateIndex
CREATE INDEX "progress_hunterXp_idx" ON "progress"("hunterXp");

-- CreateIndex
CREATE INDEX "workouts_userId_date_idx" ON "workouts"("userId", "date");

-- CreateIndex
CREATE INDEX "meals_userId_date_idx" ON "meals"("userId", "date");

-- CreateIndex
CREATE INDEX "health_logs_userId_idx" ON "health_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "health_logs_userId_date_key" ON "health_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "quest_days_userId_idx" ON "quest_days"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "quest_days_userId_date_key" ON "quest_days"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "day_totals_userId_date_key" ON "day_totals"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "streak_states_userId_key" ON "streak_states"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "difficulty_states_userId_key" ON "difficulty_states"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_states_userId_key" ON "achievement_states"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_awards_userId_date_key" ON "daily_awards"("userId", "date");

-- CreateIndex
CREATE INDEX "system_notices_userId_createdAt_idx" ON "system_notices"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "prayer_days_userId_idx" ON "prayer_days"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_days_userId_date_key" ON "prayer_days"("userId", "date");

-- CreateIndex
CREATE INDEX "qada_items_userId_completedAt_idx" ON "qada_items"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "worship_events_userId_createdAt_idx" ON "worship_events"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_time_caches_dateKey_city_country_method_school_key" ON "prayer_time_caches"("dateKey", "city", "country", "method", "school");

-- CreateIndex
CREATE UNIQUE INDEX "guilds_inviteCode_key" ON "guilds"("inviteCode");

-- CreateIndex
CREATE INDEX "guilds_ownerId_idx" ON "guilds"("ownerId");

-- CreateIndex
CREATE INDEX "guild_members_userId_idx" ON "guild_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_members_guildId_userId_key" ON "guild_members"("guildId", "userId");

-- CreateIndex
CREATE INDEX "guild_challenges_guildId_idx" ON "guild_challenges"("guildId");

-- CreateIndex
CREATE INDEX "guild_challenge_entries_userId_idx" ON "guild_challenge_entries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_challenge_entries_challengeId_userId_key" ON "guild_challenge_entries"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "sync_queue_items_userId_syncedAt_idx" ON "sync_queue_items"("userId", "syncedAt");

-- AddForeignKey
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_challenges" ADD CONSTRAINT "guild_challenges_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_challenge_entries" ADD CONSTRAINT "guild_challenge_entries_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "guild_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

