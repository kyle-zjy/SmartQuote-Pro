ALTER TABLE "staff_users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "auth_sessions" (
  "tokenHash" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
CREATE TABLE "workspace_records" (
  "id" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "workspace_clock" (
  "id" TEXT PRIMARY KEY DEFAULT 'main',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "quoteSequence" INTEGER NOT NULL DEFAULT 33020
);
INSERT INTO "workspace_clock" ("id") VALUES ('main');
