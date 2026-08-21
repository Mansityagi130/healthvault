-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'QR_SCAN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_QR_SCAN';
ALTER TYPE "AuditAction" ADD VALUE 'SHARED_RECORD_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'SHARED_DOCUMENT_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'SHARING_ACCESS_DENIED';
