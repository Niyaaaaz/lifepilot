-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DurationUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GamingSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "displayName" VARCHAR(120),
    "authSubject" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "durationAmount" DOUBLE PRECISION,
    "durationUnit" "DurationUnit",
    "startsAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" VARCHAR(80),
    "currentLevel" VARCHAR(120),
    "availableMinutes" INTEGER,
    "preferredDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_milestones" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "targetDate" DATE,
    "completedAt" TIMESTAMPTZ(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goal_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_objectives" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weekNumber" INTEGER NOT NULL,
    "startsOn" DATE,
    "endsOn" DATE,
    "successCriteria" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "weekly_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_tasks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID,
    "weeklyObjectiveId" UUID,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "estimatedMinutes" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isGoalRepetition" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_schedules" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "supersedesId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "task_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'UTC',
    "wakeTime" VARCHAR(5),
    "sleepTime" VARCHAR(5),
    "availableDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_training_games" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "category" VARCHAR(80) NOT NULL,
    "gameUrl" VARCHAR(2048) NOT NULL,
    "thumbnailUrl" VARCHAR(2048),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "brain_training_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gaming_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gameId" UUID,
    "title" VARCHAR(160) NOT NULL,
    "status" "GamingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "durationSeconds" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "gaming_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_authSubject_key" ON "users"("authSubject");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "goals_userId_status_targetDate_idx" ON "goals"("userId", "status", "targetDate");

-- CreateIndex
CREATE INDEX "goals_userId_createdAt_idx" ON "goals"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "goals_id_userId_key" ON "goals"("id", "userId");

-- CreateIndex
CREATE INDEX "goal_milestones_userId_goalId_targetDate_idx" ON "goal_milestones"("userId", "goalId", "targetDate");

-- CreateIndex
CREATE INDEX "weekly_objectives_userId_goalId_startsOn_idx" ON "weekly_objectives"("userId", "goalId", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_objectives_id_userId_key" ON "weekly_objectives"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_objectives_goalId_weekNumber_key" ON "weekly_objectives"("goalId", "weekNumber");

-- CreateIndex
CREATE INDEX "daily_tasks_userId_status_updatedAt_idx" ON "daily_tasks"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "daily_tasks_userId_goalId_status_idx" ON "daily_tasks"("userId", "goalId", "status");

-- CreateIndex
CREATE INDEX "daily_tasks_weeklyObjectiveId_idx" ON "daily_tasks"("weeklyObjectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_tasks_id_userId_key" ON "daily_tasks"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "task_schedules_supersedesId_key" ON "task_schedules"("supersedesId");

-- CreateIndex
CREATE INDEX "task_schedules_userId_scheduledDate_status_idx" ON "task_schedules"("userId", "scheduledDate", "status");

-- CreateIndex
CREATE INDEX "task_schedules_taskId_createdAt_idx" ON "task_schedules"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "task_completions_userId_completedAt_idx" ON "task_completions"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "task_completions_taskId_completedAt_idx" ON "task_completions"("taskId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "brain_training_games_userId_category_idx" ON "brain_training_games"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "brain_training_games_userId_gameUrl_key" ON "brain_training_games"("userId", "gameUrl");

-- CreateIndex
CREATE INDEX "gaming_sessions_userId_startedAt_idx" ON "gaming_sessions"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "gaming_sessions_userId_status_idx" ON "gaming_sessions"("userId", "status");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goalId_userId_fkey" FOREIGN KEY ("goalId", "userId") REFERENCES "goals"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_objectives" ADD CONSTRAINT "weekly_objectives_goalId_userId_fkey" FOREIGN KEY ("goalId", "userId") REFERENCES "goals"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_goalId_userId_fkey" FOREIGN KEY ("goalId", "userId") REFERENCES "goals"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_weeklyObjectiveId_userId_fkey" FOREIGN KEY ("weeklyObjectiveId", "userId") REFERENCES "weekly_objectives"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "daily_tasks"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "task_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "daily_tasks"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_training_games" ADD CONSTRAINT "brain_training_games_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gaming_sessions" ADD CONSTRAINT "gaming_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gaming_sessions" ADD CONSTRAINT "gaming_sessions_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "brain_training_games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add domain constraints not expressible in the Prisma schema.
ALTER TABLE "users" ADD CONSTRAINT "users_email_nonempty_check" CHECK (length(trim("email")) > 0);
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));

ALTER TABLE "goals" ADD CONSTRAINT "goals_duration_positive_check" CHECK ("durationAmount" IS NULL OR "durationAmount" > 0);
ALTER TABLE "goals" ADD CONSTRAINT "goals_duration_unit_pair_check" CHECK (("durationAmount" IS NULL) = ("durationUnit" IS NULL));
ALTER TABLE "goals" ADD CONSTRAINT "goals_available_minutes_positive_check" CHECK ("availableMinutes" IS NULL OR "availableMinutes" > 0);
ALTER TABLE "goals" ADD CONSTRAINT "goals_preferred_days_range_check" CHECK ("preferredDays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[]);

ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_sort_order_nonnegative_check" CHECK ("sortOrder" >= 0);
ALTER TABLE "weekly_objectives" ADD CONSTRAINT "weekly_objectives_week_number_positive_check" CHECK ("weekNumber" > 0);
ALTER TABLE "weekly_objectives" ADD CONSTRAINT "weekly_objectives_date_order_check" CHECK ("startsOn" IS NULL OR "endsOn" IS NULL OR "endsOn" >= "startsOn");
ALTER TABLE "weekly_objectives" ADD CONSTRAINT "weekly_objectives_sort_order_nonnegative_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_estimated_minutes_positive_check" CHECK ("estimatedMinutes" > 0);
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_completed_timestamp_check" CHECK ("status" <> 'COMPLETED' OR "completedAt" IS NOT NULL);
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_time_order_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt");
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_wake_time_format_check" CHECK ("wakeTime" IS NULL OR "wakeTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_sleep_time_format_check" CHECK ("sleepTime" IS NULL OR "sleepTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_available_days_range_check" CHECK ("availableDays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[]);

ALTER TABLE "gaming_sessions" ADD CONSTRAINT "gaming_sessions_duration_nonnegative_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0);
ALTER TABLE "gaming_sessions" ADD CONSTRAINT "gaming_sessions_end_after_start_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");
ALTER TABLE "gaming_sessions" ADD CONSTRAINT "gaming_sessions_completed_timestamp_check" CHECK ("status" <> 'COMPLETED' OR "endedAt" IS NOT NULL);
