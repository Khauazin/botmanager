-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable: add new columns to leads
ALTER TABLE "leads" ADD COLUMN "tags"     TEXT,
                    ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
                    ADD COLUMN "origin"   TEXT;

-- CreateTable: lead_history
CREATE TABLE "lead_history" (
    "id"         TEXT NOT NULL,
    "leadId"     TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "fromStage"  TEXT,
    "toStage"    TEXT,
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
