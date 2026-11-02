ALTER TABLE "daily_tasks"
ADD COLUMN "category" VARCHAR(80) NOT NULL DEFAULT 'Personal',
ADD COLUMN "retakeInProgress" BOOLEAN NOT NULL DEFAULT false;
