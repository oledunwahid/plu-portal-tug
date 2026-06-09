-- AlterTable
ALTER TABLE "PLURequest" ADD COLUMN "exportCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PLURequest" ADD COLUMN "lastExportedAt" DATETIME;
ALTER TABLE "PLURequest" ADD COLUMN "lastExportedBy" TEXT;

-- AlterTable
ALTER TABLE "RequestBatch" ADD COLUMN "exportCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RequestBatch" ADD COLUMN "lastExportedAt" DATETIME;
ALTER TABLE "RequestBatch" ADD COLUMN "lastExportedBy" TEXT;
