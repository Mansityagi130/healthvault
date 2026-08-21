-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ENCOUNTER_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'ENCOUNTER_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'LAB_REPORT_FINALIZED';
ALTER TYPE "NotificationType" ADD VALUE 'LAB_ASSOCIATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LAB_ASSOCIATION_REVOKED';
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_UPLOADED';
ALTER TYPE "NotificationType" ADD VALUE 'PRESCRIPTION_ADDED';
