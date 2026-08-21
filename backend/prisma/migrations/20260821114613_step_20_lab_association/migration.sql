-- CreateEnum
CREATE TYPE "AssociationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LAB_ASSOCIATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LAB_ASSOCIATION_QR_RESOLVED';
ALTER TYPE "AuditAction" ADD VALUE 'LAB_ASSOCIATION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'LAB_ASSOCIATION_REVOKED';
ALTER TYPE "AuditAction" ADD VALUE 'LAB_ASSOCIATION_EXPIRED';

-- CreateTable
CREATE TABLE "PatientLabAssociation" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "labId" UUID NOT NULL,
    "status" "AssociationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientLabAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabPairingToken" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "selector" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabPairingToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientLabAssociation_labId_status_idx" ON "PatientLabAssociation"("labId", "status");

-- CreateIndex
CREATE INDEX "PatientLabAssociation_patientId_status_idx" ON "PatientLabAssociation"("patientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientLabAssociation_patientId_labId_key" ON "PatientLabAssociation"("patientId", "labId");

-- CreateIndex
CREATE UNIQUE INDEX "LabPairingToken_selector_key" ON "LabPairingToken"("selector");

-- AddForeignKey
ALTER TABLE "PatientLabAssociation" ADD CONSTRAINT "PatientLabAssociation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientLabAssociation" ADD CONSTRAINT "PatientLabAssociation_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabPairingToken" ADD CONSTRAINT "LabPairingToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
