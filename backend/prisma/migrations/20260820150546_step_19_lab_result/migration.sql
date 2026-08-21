-- CreateEnum
CREATE TYPE "LabReportStatus" AS ENUM ('DRAFT', 'FINALIZED', 'AMENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LabResultValueType" AS ENUM ('NUMERIC', 'TEXT', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "LabResultStatus" AS ENUM ('NORMAL', 'HIGH', 'LOW', 'CRITICAL', 'ABNORMAL', 'UNSPECIFIED');

-- AlterTable
ALTER TABLE "LabReport" ADD COLUMN     "status" "LabReportStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "LabResult" (
    "id" UUID NOT NULL,
    "labReportId" UUID NOT NULL,
    "testName" TEXT NOT NULL,
    "testCode" TEXT,
    "value" TEXT NOT NULL,
    "valueType" "LabResultValueType" NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "status" "LabResultStatus" NOT NULL DEFAULT 'UNSPECIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabResult_labReportId_idx" ON "LabResult"("labReportId");

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_labReportId_fkey" FOREIGN KEY ("labReportId") REFERENCES "LabReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
