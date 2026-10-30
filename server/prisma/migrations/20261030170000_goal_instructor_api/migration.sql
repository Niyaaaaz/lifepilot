ALTER TABLE "goals"
ADD COLUMN "legacyId" VARCHAR(120),
ADD COLUMN "availableStartTime" VARCHAR(5),
ADD COLUMN "availableEndTime" VARCHAR(5),
ADD COLUMN "roadmapData" JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX "goals_userId_legacyId_key" ON "goals"("userId", "legacyId");

CREATE TABLE "monthly_objectives" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsOn" DATE,
    "endsOn" DATE,
    "successCriteria" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "monthly_objectives_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "monthly_objectives"
ADD CONSTRAINT "monthly_objectives_goalId_userId_fkey"
FOREIGN KEY ("goalId", "userId") REFERENCES "goals"("id", "userId")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "monthly_objectives_goalId_monthNumber_key"
ON "monthly_objectives"("goalId", "monthNumber");
CREATE UNIQUE INDEX "monthly_objectives_id_userId_key"
ON "monthly_objectives"("id", "userId");
CREATE INDEX "monthly_objectives_userId_goalId_startsOn_idx"
ON "monthly_objectives"("userId", "goalId", "startsOn");

ALTER TABLE "weekly_objectives"
ADD COLUMN "monthlyObjectiveId" UUID;

ALTER TABLE "weekly_objectives"
ADD CONSTRAINT "weekly_objectives_monthlyObjectiveId_userId_fkey"
FOREIGN KEY ("monthlyObjectiveId", "userId") REFERENCES "monthly_objectives"("id", "userId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goal_milestones" ADD COLUMN "sourceKey" VARCHAR(80);
CREATE UNIQUE INDEX "goal_milestones_goalId_sourceKey_key"
ON "goal_milestones"("goalId", "sourceKey");

ALTER TABLE "daily_tasks" ADD COLUMN "sourceKey" VARCHAR(120);
CREATE UNIQUE INDEX "daily_tasks_goalId_sourceKey_key"
ON "daily_tasks"("goalId", "sourceKey");

ALTER TABLE "task_schedules"
ADD COLUMN "startTime" VARCHAR(5),
ADD COLUMN "endTime" VARCHAR(5);
