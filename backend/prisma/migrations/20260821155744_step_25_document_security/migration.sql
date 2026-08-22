-- CreateEnum
CREATE TYPE "DocumentSecurityStatus" AS ENUM ('PENDING_SCAN', 'CLEAN', 'INFECTED', 'SCAN_FAILED');

-- AlterTable
ALTER TABLE "MedicalDocument" ADD COLUMN     "scanCompletedAt" TIMESTAMP(3),
ADD COLUMN     "scanResult" TEXT,
ADD COLUMN     "securityStatus" "DocumentSecurityStatus" NOT NULL DEFAULT 'PENDING_SCAN';
