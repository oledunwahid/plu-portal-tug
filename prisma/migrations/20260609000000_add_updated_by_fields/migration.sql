-- AlterTable
ALTER TABLE "PLURequest" ADD COLUMN "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "RequestBatch" ADD COLUMN "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "DiscountRequest" ADD COLUMN "updatedBy" TEXT;
